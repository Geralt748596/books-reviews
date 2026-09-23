import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { Ollama } from "ollama";
import type { ZodSchema } from "zod/v3";
import { zodToJsonSchema } from "zod-to-json-schema";
import { getAbortSignal, log } from "./run-context";

// Обратная совместимость: раньше `log` жил здесь
export { log } from "./run-context";

// =============================================================================
// Провайдеры
// =============================================================================

export type LlmProvider = "ollama" | "claude";

export function detectProvider(model: string): LlmProvider {
  return model.startsWith("claude-") ? "claude" : "ollama";
}

/** Хост Ollama: локальный/LAN сервер или https://ollama.com для прямого доступа к облаку. */
const ollamaHost = process.env.OLLAMA_HOST ?? "http://192.168.1.138:11434";
const directOllamaCloud = /(^|\/\/)ollama\.com/i.test(ollamaHost);

export function getOllamaHost(): string {
  return ollamaHost;
}

export function isDirectOllamaCloud(): boolean {
  return directOllamaCloud;
}

export function hasOllamaApiKey(): boolean {
  return Boolean(process.env.OLLAMA_API_KEY);
}

export function isOllamaCloud(model: string): boolean {
  // Через локальный сервер облачные модели называются `name:cloud`;
  // при прямом подключении к ollama.com облачной является любая модель.
  return (
    directOllamaCloud || model.endsWith(":cloud") || model.endsWith("-cloud")
  );
}

// Два способа работать с облачными моделями Ollama (`*:cloud`):
//  1) через локальный/LAN сервер Ollama, на котором выполнен `ollama signin` —
//     ключ в приложении не нужен, OLLAMA_HOST указывает на этот сервер;
//  2) напрямую в https://ollama.com — нужен OLLAMA_API_KEY (ollama.com/settings/keys).
const ollamaApiKey = process.env.OLLAMA_API_KEY;

const ollama = new Ollama({
  host: ollamaHost,
  headers: ollamaApiKey
    ? { Authorization: `Bearer ${ollamaApiKey}` }
    : undefined,
});

/** Разворачивает `fetch failed` в причину (ECONNREFUSED, ENOTFOUND, ...) и хост. */
function describeNetworkError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  const cause = (error as { cause?: { code?: string; message?: string } })
    ?.cause;
  if (msg === "fetch failed" || cause) {
    const detail = cause?.code ?? cause?.message ?? "";
    return `${msg}${detail ? ` (${detail})` : ""} — хост Ollama: ${ollamaHost}`;
  }
  if (/unauthorized/i.test(msg)) {
    return `${msg} — ollama.com отклонил OLLAMA_API_KEY, проверьте ключ на ollama.com/settings/keys`;
  }
  return msg;
}

let anthropicClient: Anthropic | undefined;

export function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    // Ключ читается SDK из переменной окружения ANTHROPIC_API_KEY (см. .env).
    anthropicClient = new Anthropic({ maxRetries: 3 });
  }
  return anthropicClient;
}

// =============================================================================
// Размер фрагмента зависит от модели
// =============================================================================

export interface ModelChunkOptions {
  maxTokens: number;
  overlapTokens: number;
}

export function getChunkOptionsForModel(model: string): ModelChunkOptions {
  const provider = detectProvider(model);
  if (provider === "claude") {
    // Окно 1M: крупные фрагменты дают связные описания и меньше ошибок merge.
    return { maxTokens: 120_000, overlapTokens: 4_000 };
  }
  if (isOllamaCloud(model)) {
    // Проверено на deepseek-v4.1-flash: 100k даёт полнее извлечение, чем вся книга разом.
    return { maxTokens: 100_000, overlapTokens: 4_000 };
  }
  // Локальные модели деградируют на длинных входах.
  return { maxTokens: 20_000, overlapTokens: 2_000 };
}

/** Сколько независимых запросов слать одновременно (локальный сервер обслуживает по одному). */
export function getConcurrencyForModel(model: string): number {
  if (detectProvider(model) === "claude" || isOllamaCloud(model)) return 4;
  return 1;
}

// =============================================================================
// Учёт токенов и стоимости
// =============================================================================

interface Price {
  input: number; // $ за 1M токенов
  output: number;
}

const CLAUDE_PRICES: Array<[prefix: string, price: Price]> = [
  ["claude-fable-5", { input: 10, output: 50 }],
  ["claude-mythos-5", { input: 10, output: 50 }],
  ["claude-opus-5", { input: 5, output: 25 }],
  ["claude-opus-4", { input: 5, output: 25 }],
  ["claude-sonnet-5", { input: 2, output: 10 }],
  ["claude-sonnet-4", { input: 3, output: 15 }],
  ["claude-haiku-4", { input: 1, output: 5 }],
];

function priceFor(model: string): Price | null {
  const hit = CLAUDE_PRICES.find(([prefix]) => model.startsWith(prefix));
  return hit ? hit[1] : null;
}

export interface UsageTotals {
  model: string;
  requests: number;
  inputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
  batchRequests: number;
  estimatedCostUsd: number | null;
}

const usageTotals = new Map<string, UsageTotals>();

export function recordUsage(
  model: string,
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
  },
  opts: { batch?: boolean } = {},
): void {
  const totals = usageTotals.get(model) ?? {
    model,
    requests: 0,
    inputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: 0,
    batchRequests: 0,
    estimatedCostUsd: null,
  };

  totals.requests += 1;
  if (opts.batch) totals.batchRequests += 1;
  totals.inputTokens += usage.input_tokens;
  totals.outputTokens += usage.output_tokens;
  totals.cacheReadTokens += usage.cache_read_input_tokens ?? 0;
  totals.cacheWriteTokens += usage.cache_creation_input_tokens ?? 0;

  const price = priceFor(model);
  if (price) {
    const multiplier = opts.batch ? 0.5 : 1;
    const cost =
      ((usage.input_tokens * price.input +
        (usage.cache_creation_input_tokens ?? 0) * price.input * 1.25 +
        (usage.cache_read_input_tokens ?? 0) * price.input * 0.1 +
        usage.output_tokens * price.output) /
        1_000_000) *
      multiplier;
    totals.estimatedCostUsd = (totals.estimatedCostUsd ?? 0) + cost;
  }

  usageTotals.set(model, totals);
}

export function getUsageReport(): UsageTotals[] {
  return Array.from(usageTotals.values());
}

// =============================================================================
// Структурированный запрос (общий интерфейс)
// =============================================================================

export interface LlmRequestOptions {
  model: string;
  prompt: string;
  schema: ZodSchema;
  /** Включить рассуждения модели: Ollama `think`, Claude effort high. */
  reasoning?: boolean;
  maxOutputTokens?: number;
  maxRetries?: number;
  temperature?: number;
  timeoutMs?: number;
}

export async function llmStructuredRequest<T>(
  options: LlmRequestOptions,
): Promise<T> {
  return detectProvider(options.model) === "claude"
    ? claudeStructuredRequest<T>(options)
    : ollamaStructuredRequest<T>(options);
}

/** Разбор + валидация ответа модели. Используется и для прямых, и для batch-ответов. */
export function parseStructuredContent<T>(
  content: string,
  schema: ZodSchema,
): T {
  const parsed = parseJsonResponse(content);
  const preprocessed = coerceArraysToStrings(parsed);
  return schema.parse(preprocessed) as T;
}

// =============================================================================
// Claude
// =============================================================================

const DEFAULT_CLAUDE_MAX_OUTPUT = 32_000;

export function buildClaudeParams(
  options: Pick<
    LlmRequestOptions,
    "model" | "prompt" | "schema" | "reasoning" | "maxOutputTokens"
  >,
): Anthropic.MessageCreateParamsNonStreaming {
  const jsonSchema = stripSchemaMeta(zodToJsonSchema(options.schema));
  const format = jsonSchemaOutputFormat(
    jsonSchema as Parameters<typeof jsonSchemaOutputFormat>[0],
  );

  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model: options.model,
    max_tokens: options.maxOutputTokens ?? DEFAULT_CLAUDE_MAX_OUTPUT,
    messages: [{ role: "user", content: options.prompt }],
    output_config: {
      format: { type: "json_schema", schema: format.schema },
      effort: options.reasoning ? "high" : "low",
    },
  };

  // Haiku 4.5 не поддерживает adaptive thinking; на остальных актуальных
  // моделях это единственный режим рассуждений.
  if (!options.model.startsWith("claude-haiku")) {
    params.thinking = { type: "adaptive" };
  }

  return params;
}

export function extractClaudeText(message: Anthropic.Message): string {
  if (message.stop_reason === "refusal") {
    const details = message.stop_details;
    throw new Error(
      `Claude отклонил запрос (refusal${details?.category ? `: ${details.category}` : ""})`,
    );
  }
  if (message.stop_reason === "max_tokens") {
    throw new Error(
      "Claude упёрся в max_tokens — ответ обрезан, увеличьте maxOutputTokens или уменьшите фрагмент",
    );
  }
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

async function claudeStructuredRequest<T>(
  options: LlmRequestOptions,
): Promise<T> {
  const { model, schema, maxRetries = 3 } = options;
  const client = getAnthropicClient();
  const params = buildClaudeParams(options);

  log(
    `Промпт: ~${estimatePromptTokens(options.prompt).toLocaleString()} токенов, модель: ${model}, reasoning: ${options.reasoning ? "on" : "off"}`,
  );

  let lastError = "";
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const startTime = Date.now();
    log(`Попытка ${attempt}/${maxRetries}...`);
    try {
      // Стриминг снимает HTTP-таймауты на длинных ответах.
      const message = await client.messages
        .stream(params, { signal: getAbortSignal() })
        .finalMessage();

      recordUsage(model, message.usage);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      log(
        `Ответ за ${elapsed}с: ${message.usage.input_tokens.toLocaleString()} in / ${message.usage.output_tokens.toLocaleString()} out`,
      );

      const content = extractClaudeText(message);
      return parseStructuredContent<T>(content, schema);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      log(`Ошибка: ${lastError}`);

      if (
        error instanceof Anthropic.BadRequestError ||
        error instanceof Anthropic.AuthenticationError
      ) {
        throw error; // повтор не поможет
      }
      if (attempt >= maxRetries) break;

      const delayMs =
        error instanceof Anthropic.RateLimitError
          ? 30_000
          : Math.min(1000 * 2 ** attempt, 30_000);
      log(`Ожидание ${(delayMs / 1000).toFixed(0)}с перед повтором...`);
      await sleep(delayMs);
    }
  }

  throw new Error(
    `Claude запрос не удался после ${maxRetries} попыток. Модель: ${model}. Последняя ошибка: ${lastError}`,
  );
}

// =============================================================================
// Ollama
// =============================================================================

const DEFAULT_OLLAMA_MAX_OUTPUT = 32_000;
/** num_predict в Ollama считает и токены рассуждений, поэтому даём им отдельный запас. */
const OLLAMA_THINKING_ALLOWANCE = 16_000;

export class OutputTruncatedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutputTruncatedError";
  }
}

interface RetryState {
  attempt: number;
  lastError?: string;
}

async function ollamaStructuredRequest<T>(
  options: LlmRequestOptions,
): Promise<T> {
  const {
    model,
    prompt,
    schema,
    maxRetries = 3,
    temperature = 0.1,
    maxOutputTokens = DEFAULT_OLLAMA_MAX_OUTPUT,
  } = options;
  // Может быть выключен по ходу попыток, если рассуждения съели весь лимит вывода
  let reasoning = options.reasoning ?? false;

  const isCloud = isOllamaCloud(model);
  const jsonSchema = stripSchemaMeta(zodToJsonSchema(schema));

  log(
    `Промпт: ~${estimatePromptTokens(prompt).toLocaleString()} токенов, модель: ${model}, cloud: ${isCloud}, reasoning: ${reasoning ? "on" : "off"}`,
  );

  const state: RetryState = { attempt: 0 };

  while (state.attempt < maxRetries) {
    state.attempt++;
    const startTime = Date.now();

    log(`Попытка ${state.attempt}/${maxRetries}...`);

    try {
      // Стриминг: заголовки приходят сразу, длинные рассуждения не упираются
      // в таймаут заголовков fetch (UND_ERR_HEADERS_TIMEOUT, 5 минут).
      const stream = await ollama.chat({
        model,
        messages: [{ role: "user", content: prompt }],
        format: isCloud ? undefined : jsonSchema,
        think: reasoning,
        stream: true,
        options: {
          temperature,
          top_p: 0.9,
          top_k: 40,
          num_predict: reasoning
            ? maxOutputTokens + OLLAMA_THINKING_ALLOWANCE
            : maxOutputTokens,
        },
        signal: getAbortSignal(),
      } as Parameters<typeof ollama.chat>[0] & {
        stream: true;
        signal: AbortSignal;
      });

      let content = "";
      let promptTokens: number | undefined;
      let outputTokens: number | undefined;
      let doneReason = "";
      for await (const chunk of stream) {
        content += chunk.message.content ?? "";
        if (chunk.done) {
          promptTokens = chunk.prompt_eval_count;
          outputTokens = chunk.eval_count;
          doneReason = chunk.done_reason ?? "";
        }
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      log(
        `Ответ получен за ${elapsed}с, ${content.length} символов` +
          (outputTokens !== undefined
            ? `, ${outputTokens} токенов вывода`
            : ""),
      );

      if (
        typeof promptTokens === "number" &&
        typeof outputTokens === "number"
      ) {
        recordUsage(model, {
          input_tokens: promptTokens,
          output_tokens: outputTokens,
        });
      }

      if (doneReason === "length") {
        throw new OutputTruncatedError(
          `Ответ обрезан по лимиту вывода (${outputTokens ?? "?"} токенов, ` +
            `num_predict=${reasoning ? maxOutputTokens + OLLAMA_THINKING_ALLOWANCE : maxOutputTokens}` +
            `${reasoning ? ", включая рассуждения" : ""}). ` +
            "Уменьшите объём запрашиваемого вывода или размер фрагмента.",
        );
      }

      let parsed: unknown;
      try {
        parsed = parseJsonResponse(content);
      } catch (parseErr) {
        log(`Ошибка парсинга JSON. Начало ответа: ${content.slice(0, 200)}`);
        throw parseErr;
      }

      try {
        const preprocessed = coerceArraysToStrings(parsed);
        return schema.parse(preprocessed) as T;
      } catch (validationErr) {
        const keys =
          parsed && typeof parsed === "object" ? Object.keys(parsed) : [];
        log(`Ошибка валидации Zod. Ключи ответа: [${keys.join(", ")}]`);
        log(`Начало ответа: ${JSON.stringify(parsed).slice(0, 300)}`);
        log(
          `Zod: ${validationErr instanceof Error ? validationErr.message : validationErr}`,
        );
        throw validationErr;
      }
    } catch (error) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const errorMsg = describeNetworkError(error);
      const errorName = error instanceof Error ? error.name : "Unknown";

      state.lastError = errorMsg;
      log(`Ошибка (${errorName}) через ${elapsed}с: ${errorMsg}`);

      if (error instanceof OutputTruncatedError) {
        if (reasoning && state.attempt < maxRetries) {
          // Рассуждения съели лимит: повторяем без них, ответ всё равно лучше отказа
          reasoning = false;
          log("Повтор без reasoning: рассуждения исчерпали лимит вывода");
          continue;
        }
        throw error; // без рассуждений повтор даст тот же обрезанный ответ
      }
      if (state.attempt >= maxRetries) {
        throw new Error(
          `LLM запрос не удался после ${maxRetries} попыток. ` +
            `Модель: ${model}. Последняя ошибка: ${state.lastError}`,
        );
      }

      const delayMs = Math.min(1000 * 2 ** state.attempt, 30_000);
      log(`Ожидание ${(delayMs / 1000).toFixed(0)}с перед повтором...`);
      await sleep(delayMs);
    }
  }

  throw new Error("Unreachable");
}

// =============================================================================
// Поиск года публикации
// =============================================================================

export async function searchPublishedDate(
  title: string,
  authors: string,
  model: string,
): Promise<string | null> {
  const question = `When was "${title}" by ${authors} first published? Return ONLY the year (4 digits). If unknown, return "unknown".`;

  try {
    let content: string;

    if (detectProvider(model) === "claude") {
      const message = await getAnthropicClient().messages.create(
        {
          model,
          max_tokens: 256,
          messages: [{ role: "user", content: question }],
          output_config: { effort: "low" },
        },
        { signal: getAbortSignal() },
      );
      recordUsage(model, message.usage);
      content = extractClaudeText(message).trim();
    } else {
      const response = await ollama.chat({
        model,
        messages: [{ role: "user", content: question }],
        think: false,
        options: { temperature: 0.1 },
        signal: getAbortSignal(),
      } as Parameters<typeof ollama.chat>[0] & { signal: AbortSignal });
      content = response.message.content.trim();
    }

    const yearMatch = content.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
    return yearMatch ? yearMatch[1] : null;
  } catch {
    return null;
  }
}

// =============================================================================
// Вспомогательные функции
// =============================================================================

function stripSchemaMeta(
  schema: ReturnType<typeof zodToJsonSchema>,
): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...schema };
  delete copy.$schema;
  return copy;
}

function estimatePromptTokens(prompt: string): number {
  return Math.ceil(prompt.length / 3);
}

function parseJsonResponse(content: string): unknown {
  const candidates = [
    content,
    content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)?.[1],
    content.match(/\{[\s\S]*\}/)?.[0],
  ].filter(Boolean) as string[];

  for (const raw of candidates) {
    try {
      return JSON.parse(raw);
    } catch {
      // try repairing
    }
    try {
      return JSON.parse(repairJson(raw));
    } catch {
      // try next candidate
    }
  }

  throw new SyntaxError(
    `Cannot extract JSON from response: ${content.slice(0, 100)}`,
  );
}

function repairJson(raw: string): string {
  let s = raw;

  // Fix unescaped newlines/tabs inside string values
  s = s.replace(/"(?:[^"\\]|\\.)*"/g, (match) =>
    match
      .replace(/(?<!\\)\n/g, "\\n")
      .replace(/(?<!\\)\r/g, "\\r")
      .replace(/(?<!\\)\t/g, "\\t"),
  );

  // Remove trailing commas before ] or }
  s = s.replace(/,\s*([}\]])/g, "$1");

  // Try to close unclosed structures
  const opens = (s.match(/[{[]/g) || []).length;
  const closes = (s.match(/[}\]]/g) || []).length;
  if (opens > closes) {
    const stack: string[] = [];
    for (const ch of s) {
      if (ch === "{" || ch === "[") stack.push(ch === "{" ? "}" : "]");
      else if (ch === "}" || ch === "]") stack.pop();
    }
    s += stack.reverse().join("");
  }

  return s;
}

const STRING_FIELDS = [
  "appearance",
  "personality",
  "description",
  "significance",
  "summary",
  "overview",
  "role",
];

function coerceArraysToStrings(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    if (obj.length > 0 && obj.every((item) => typeof item === "string")) {
      return obj;
    }
    return obj.map(coerceArraysToStrings);
  }
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (STRING_FIELDS.includes(key) && Array.isArray(value)) {
        result[key] = value.filter((v) => typeof v === "string").join(". ");
      } else {
        result[key] = coerceArraysToStrings(value);
      }
    }
    return result;
  }
  return obj;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
