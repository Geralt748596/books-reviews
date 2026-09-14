import Anthropic from "@anthropic-ai/sdk";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import ora from "ora";
import type { ZodSchema } from "zod/v3";
import {
  abortController,
  buildClaudeParams,
  detectProvider,
  extractClaudeText,
  getAnthropicClient,
  llmStructuredRequest,
  log,
  parseStructuredContent,
  recordUsage,
  sleep,
} from "./llm-client";

// =============================================================================
// Общий интерфейс исполнителя фаз
// =============================================================================

export interface StructuredRequest {
  id: string;
  prompt: string;
  schema: ZodSchema;
  reasoning?: boolean;
  maxOutputTokens?: number;
  /** Подпись для прогресса в терминале. */
  label?: string;
}

export interface PhaseContext {
  /** Уже готовые результаты этой фазы (в последовательном режиме — предыдущие). */
  previous: Map<string, unknown>;
}

export interface PhaseOutcome<T> {
  results: Map<string, T>;
  errors: Map<string, Error>;
}

export interface RunOptions {
  /**
   * Сколько запросов выполнять одновременно. Больше 1 имеет смысл только для
   * независимых запросов: ctx.previous при этом не гарантирует полноты.
   */
  concurrency?: number;
}

export interface Executor {
  readonly mode: "sequential" | "batch";
  run<T>(
    phase: string,
    ids: string[],
    build: (id: string, ctx: PhaseContext) => StructuredRequest,
    options?: RunOptions,
  ): Promise<PhaseOutcome<T>>;
}

export interface ExecutorOptions {
  model: string;
  /** Параметры, при смене которых кэш фаз недействителен (например, размер фрагмента). */
  variant: string;
  /** Каталог для промежуточных результатов и состояния batch. */
  workDir: string;
  /** Игнорировать сохранённые промежуточные результаты. */
  fresh?: boolean;
}

export function createExecutor(
  opts: ExecutorOptions & { batch: boolean },
): Executor {
  if (opts.batch) {
    if (detectProvider(opts.model) !== "claude") {
      throw new Error(
        `Batch-режим доступен только для моделей Claude, получено: ${opts.model}`,
      );
    }
    return new BatchExecutor(opts);
  }
  return new SequentialExecutor(opts);
}

// =============================================================================
// Кэш фазы на диске: позволяет продолжить после сбоя
// =============================================================================

interface PhaseCacheFile {
  phase: string;
  model: string;
  variant: string;
  updatedAt: string;
  results: Record<string, unknown>;
}

class PhaseCache {
  private data: Record<string, unknown> = {};
  private readonly path: string;

  constructor(
    private readonly workDir: string,
    private readonly phase: string,
    private readonly model: string,
    private readonly variant: string,
  ) {
    this.path = resolve(workDir, `${phase}.json`);
  }

  async load(fresh: boolean | undefined): Promise<void> {
    await mkdir(this.workDir, { recursive: true });
    if (fresh || !existsSync(this.path)) return;
    try {
      const parsed = JSON.parse(
        await readFile(this.path, "utf-8"),
      ) as PhaseCacheFile;
      if (
        parsed.model === this.model &&
        parsed.variant === this.variant &&
        parsed.results
      ) {
        this.data = parsed.results;
      } else if (parsed.results) {
        console.log(
          `  ↩ ${this.phase}: кэш от другого запуска (${parsed.model}, ${parsed.variant}) пропущен`,
        );
      }
    } catch {
      this.data = {};
    }
  }

  get<T>(id: string, schema: ZodSchema): T | undefined {
    if (!(id in this.data)) return undefined;
    const check = schema.safeParse(this.data[id]);
    return check.success ? (check.data as T) : undefined;
  }

  async set(id: string, value: unknown): Promise<void> {
    this.data[id] = value;
    await this.flush();
  }

  async setMany(entries: Iterable<[string, unknown]>): Promise<void> {
    for (const [id, value] of entries) this.data[id] = value;
    await this.flush();
  }

  private async flush(): Promise<void> {
    const file: PhaseCacheFile = {
      phase: this.phase,
      model: this.model,
      variant: this.variant,
      updatedAt: new Date().toISOString(),
      results: this.data,
    };
    await writeFile(this.path, JSON.stringify(file, null, 2), "utf-8");
  }
}

async function loadCached<T>(
  cache: PhaseCache,
  ids: string[],
  build: (id: string, ctx: PhaseContext) => StructuredRequest,
): Promise<{ results: Map<string, T>; pending: string[] }> {
  const results = new Map<string, T>();
  const pending: string[] = [];
  const emptyCtx: PhaseContext = { previous: new Map() };

  for (const id of ids) {
    const req = build(id, emptyCtx);
    const hit = cache.get<T>(id, req.schema);
    if (hit !== undefined) results.set(id, hit);
    else pending.push(id);
  }

  return { results, pending };
}

// =============================================================================
// Последовательный исполнитель (Ollama или Claude напрямую)
// =============================================================================

class SequentialExecutor implements Executor {
  readonly mode = "sequential" as const;

  constructor(private readonly opts: ExecutorOptions) {}

  async run<T>(
    phase: string,
    ids: string[],
    build: (id: string, ctx: PhaseContext) => StructuredRequest,
    options: RunOptions = {},
  ): Promise<PhaseOutcome<T>> {
    const cache = new PhaseCache(
      this.opts.workDir,
      phase,
      this.opts.model,
      this.opts.variant,
    );
    await cache.load(this.opts.fresh);

    const { results, pending } = await loadCached<T>(cache, ids, build);
    const errors = new Map<string, Error>();

    if (results.size > 0) {
      console.log(
        `  ↩ ${phase}: ${results.size} из ${ids.length} взято из кэша (${this.opts.workDir})`,
      );
    }

    const concurrency = Math.max(1, options.concurrency ?? 1);
    if (concurrency === 1 || pending.length <= 1) {
      for (const id of pending) {
        await this.runOne(
          phase,
          id,
          build(id, { previous: results }),
          results,
          errors,
          cache,
          true,
        );
      }
      return { results, errors };
    }

    console.log(
      `  ${phase}: ${pending.length} запросов, параллельно ${concurrency}`,
    );
    const queue = [...pending];
    const workers = Array.from({ length: concurrency }, async () => {
      for (;;) {
        const id = queue.shift();
        if (id === undefined) return;
        await this.runOne(
          phase,
          id,
          build(id, { previous: results }),
          results,
          errors,
          cache,
          false,
        );
      }
    });
    await Promise.all(workers);

    return { results, errors };
  }

  private async runOne<T>(
    phase: string,
    id: string,
    req: StructuredRequest,
    results: Map<string, T>,
    errors: Map<string, Error>,
    cache: PhaseCache,
    useSpinner: boolean,
  ): Promise<void> {
    const label = req.label ?? `${phase}: ${id}`;
    const spinner = useSpinner ? ora(label).start() : null;
    try {
      const value = await llmStructuredRequest<T>({
        model: this.opts.model,
        prompt: req.prompt,
        schema: req.schema,
        reasoning: req.reasoning,
        maxOutputTokens: req.maxOutputTokens,
      });
      results.set(id, value);
      await cache.set(id, value);
      if (spinner) spinner.succeed(label);
      else console.log(`  ✔ ${label}`);
    } catch (error) {
      if (spinner) spinner.fail(`${label}: ошибка`);
      else console.log(`  ✖ ${label}: ошибка`);
      errors.set(id, error instanceof Error ? error : new Error(String(error)));
    }
  }
}

// =============================================================================
// Batch-исполнитель (Claude Message Batches API, скидка 50%)
// =============================================================================

interface BatchStateFile {
  batchId: string;
  variant: string;
  ids: string[];
  createdAt: string;
}

const POLL_INTERVAL_MS = 30_000;

class BatchExecutor implements Executor {
  readonly mode = "batch" as const;

  constructor(private readonly opts: ExecutorOptions) {}

  async run<T>(
    phase: string,
    ids: string[],
    build: (id: string, ctx: PhaseContext) => StructuredRequest,
  ): Promise<PhaseOutcome<T>> {
    const cache = new PhaseCache(
      this.opts.workDir,
      phase,
      this.opts.model,
      this.opts.variant,
    );
    await cache.load(this.opts.fresh);

    const { results, pending } = await loadCached<T>(cache, ids, build);
    const errors = new Map<string, Error>();

    if (results.size > 0) {
      console.log(
        `  ↩ ${phase}: ${results.size} из ${ids.length} взято из кэша (${this.opts.workDir})`,
      );
    }
    if (pending.length === 0) return { results, errors };

    const emptyCtx: PhaseContext = { previous: new Map() };
    const requests = new Map<string, StructuredRequest>(
      pending.map((id) => [id, build(id, emptyCtx)]),
    );

    const client = getAnthropicClient();
    const statePath = resolve(this.opts.workDir, `${phase}.batch.json`);
    const batchId = await this.getOrCreateBatch(
      client,
      statePath,
      phase,
      requests,
    );

    const batch = await this.waitForBatch(client, batchId, phase);

    // Разбор результатов; порядок произвольный, сопоставляем по custom_id
    const failed: string[] = [];
    const done: Array<[string, unknown]> = [];

    for await (const item of await client.messages.batches.results(batchId)) {
      const req = requests.get(item.custom_id);
      if (!req) continue;

      if (item.result.type !== "succeeded") {
        const reason =
          item.result.type === "errored"
            ? `${item.result.error.type}: ${JSON.stringify(item.result.error.error)}`
            : item.result.type;
        log(`${phase}/${item.custom_id}: ${reason}`);
        failed.push(item.custom_id);
        continue;
      }

      recordUsage(this.opts.model, item.result.message.usage, { batch: true });
      try {
        const text = extractClaudeText(item.result.message);
        const value = parseStructuredContent<T>(text, req.schema);
        results.set(item.custom_id, value);
        done.push([item.custom_id, value]);
      } catch (error) {
        log(
          `${phase}/${item.custom_id}: невалидный ответ — ${error instanceof Error ? error.message : error}`,
        );
        failed.push(item.custom_id);
      }
    }

    await cache.setMany(done);
    await rm(statePath, { force: true });

    console.log(
      `  Batch ${batchId}: ${batch.request_counts.succeeded} ок, ` +
        `${batch.request_counts.errored} ошибок, ${batch.request_counts.expired} истекло`,
    );

    // Неудачные запросы повторяем напрямую, без batch
    if (failed.length > 0) {
      console.log(
        `  Повтор ${failed.length} запрос(ов) напрямую (без скидки batch)...`,
      );
      const direct = new SequentialExecutor(this.opts);
      const retry = await direct.run<T>(phase, failed, (id) =>
        requests.get(id)!,
      );
      for (const [id, value] of retry.results) results.set(id, value);
      for (const [id, err] of retry.errors) errors.set(id, err);
    }

    return { results, errors };
  }

  private async getOrCreateBatch(
    client: Anthropic,
    statePath: string,
    phase: string,
    requests: Map<string, StructuredRequest>,
  ): Promise<string> {
    const pendingIds = Array.from(requests.keys()).sort();

    if (!this.opts.fresh && existsSync(statePath)) {
      try {
        const state = JSON.parse(
          await readFile(statePath, "utf-8"),
        ) as BatchStateFile;
        const sameIds =
          state.variant === this.opts.variant &&
          state.ids.length === pendingIds.length &&
          [...state.ids].sort().every((id, i) => id === pendingIds[i]);
        if (sameIds) {
          console.log(
            `  ↩ ${phase}: продолжаю ожидание batch ${state.batchId} (создан ${state.createdAt})`,
          );
          return state.batchId;
        }
      } catch {
        // состояние повреждено — создаём новый batch
      }
    }

    const batchRequests: Anthropic.Messages.Batches.BatchCreateParams.Request[] =
      Array.from(requests.values()).map((req) => ({
        custom_id: req.id,
        params: buildClaudeParams({
          model: this.opts.model,
          prompt: req.prompt,
          schema: req.schema,
          reasoning: req.reasoning,
          maxOutputTokens: req.maxOutputTokens,
        }),
      }));

    const promptChars = batchRequests.reduce((sum, r) => {
      const content = r.params.messages[0]?.content;
      return sum + (typeof content === "string" ? content.length : 0);
    }, 0);
    console.log(
      `  Отправка batch "${phase}": ${batchRequests.length} запрос(ов), ~${Math.ceil(promptChars / 3).toLocaleString()} токенов входа`,
    );

    const batch = await client.messages.batches.create(
      { requests: batchRequests },
      { signal: abortController.signal },
    );

    const state: BatchStateFile = {
      batchId: batch.id,
      variant: this.opts.variant,
      ids: pendingIds,
      createdAt: new Date().toISOString(),
    };
    await writeFile(statePath, JSON.stringify(state, null, 2), "utf-8");
    console.log(`  Batch создан: ${batch.id}`);

    return batch.id;
  }

  private async waitForBatch(
    client: Anthropic,
    batchId: string,
    phase: string,
  ): Promise<Anthropic.Messages.Batches.MessageBatch> {
    const spinner = ora(`Ожидание batch "${phase}" (${batchId})...`).start();
    const startedAt = Date.now();

    for (;;) {
      const batch = await client.messages.batches.retrieve(batchId, undefined, {
        signal: abortController.signal,
      });
      const c = batch.request_counts;
      const elapsedMin = Math.floor((Date.now() - startedAt) / 60_000);
      spinner.text =
        `Batch "${phase}": ${c.succeeded} ок, ${c.processing} в работе, ` +
        `${c.errored} ошибок · ${elapsedMin} мин`;

      if (batch.processing_status === "ended") {
        spinner.succeed(
          `Batch "${phase}" завершён за ${elapsedMin} мин (${c.succeeded} ок, ${c.errored} ошибок, ${c.expired} истекло)`,
        );
        return batch;
      }
      await sleep(POLL_INTERVAL_MS);
    }
  }
}
