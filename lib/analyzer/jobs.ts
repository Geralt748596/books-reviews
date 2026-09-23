import { randomUUID } from "node:crypto";
import type { UsageTotals } from "./llm-client";
import { runWithContext, type LogLine } from "./run-context";
import { runAnalysis, type RunAnalysisResult } from "./run";

/**
 * Реестр фоновых задач анализа.
 *
 * Задача запускается в процессе сервера и живёт независимо от HTTP-запроса:
 * события копятся в кольцевом буфере, подписчик (SSE) получает повтор с нужного
 * места и дальше живые события. Одновременно выполняется одна задача, остальные
 * ждут в очереди. Реестр лежит на `globalThis`, чтобы пережить HMR в dev.
 */

export type JobStatus = "queued" | "running" | "done" | "error" | "cancelled";

export interface JobParams {
  pdfPath: string;
  model: string;
  chunkTokens?: number;
  title?: string;
  /** Серия для последующей публикации; на анализ не влияет. */
  bookSeriesId?: string;
  fresh?: boolean;
  batch?: boolean;
  outputPath?: string;
}

export interface JobResultSummary {
  outputPath: string;
  title: string;
  authors: string;
  language: string;
  characters: { main: number; secondary: number; minor: number };
  events: number;
  usage: UsageTotals[];
  elapsedMs: number;
  reused: boolean;
}

export type JobEventPayload =
  | { type: "log"; line: LogLine }
  | { type: "status"; status: JobStatus }
  | { type: "done"; result: JobResultSummary }
  | { type: "error"; message: string };

export type JobEvent = { seq: number; ts: string } & JobEventPayload;

/** Публичное представление задачи: без контроллера отмены и подписчиков. */
export interface JobView {
  id: string;
  params: JobParams;
  status: JobStatus;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  result?: JobResultSummary;
  error?: string;
  /** Номер последнего события; клиент передаёт его для повтора. */
  lastSeq: number;
  /** Сколько ранних событий вытеснено из буфера. */
  droppedEvents: number;
}

type Subscriber = (event: JobEvent) => void;

interface Job extends Omit<JobView, "lastSeq" | "droppedEvents"> {
  events: JobEvent[];
  firstSeq: number;
  nextSeq: number;
  abort: AbortController;
  subscribers: Set<Subscriber>;
}

export type JobRunner = (params: JobParams) => Promise<RunAnalysisResult>;

interface Registry {
  jobs: Map<string, Job>;
  queue: string[];
  runningId: string | null;
  runner: JobRunner;
}

export const MAX_EVENTS_PER_JOB = 5_000;
export const MAX_FINISHED_JOBS = 20;

const FINISHED: ReadonlySet<JobStatus> = new Set([
  "done",
  "error",
  "cancelled",
]);

const globalRegistry = globalThis as unknown as {
  __analyzerJobs?: Registry;
};

function defaultRunner(params: JobParams): Promise<RunAnalysisResult> {
  return runAnalysis(params);
}

function registry(): Registry {
  globalRegistry.__analyzerJobs ??= {
    jobs: new Map(),
    queue: [],
    runningId: null,
    runner: defaultRunner,
  };
  return globalRegistry.__analyzerJobs;
}

// =============================================================================
// Публичный API
// =============================================================================

export function createJob(params: JobParams): JobView {
  const reg = registry();
  const now = new Date().toISOString();
  const job: Job = {
    id: randomUUID(),
    params,
    status: "queued",
    createdAt: now,
    events: [],
    firstSeq: 1,
    nextSeq: 1,
    abort: new AbortController(),
    subscribers: new Set(),
  };
  reg.jobs.set(job.id, job);
  reg.queue.push(job.id);
  pushEvent(job, { type: "status", status: "queued" });
  pruneFinished(reg);
  pumpQueue(reg);
  return toView(job);
}

export function getJob(id: string): JobView | undefined {
  const job = registry().jobs.get(id);
  return job ? toView(job) : undefined;
}

/** Задачи от новых к старым. */
export function listJobs(): JobView[] {
  return Array.from(registry().jobs.values())
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map(toView);
}

/**
 * События задачи с номером больше `afterSeq`. Если запрошенные события уже
 * вытеснены из буфера, возвращает всё, что осталось, и `truncated: true`.
 */
export function getEvents(
  id: string,
  afterSeq = 0,
): { events: JobEvent[]; truncated: boolean } | undefined {
  const job = registry().jobs.get(id);
  if (!job) return undefined;
  const truncated = afterSeq + 1 < job.firstSeq;
  return {
    events: job.events.filter((e) => e.seq > afterSeq),
    truncated,
  };
}

/**
 * Подписка на живые события. Сначала синхронно повторяются накопленные события
 * после `afterSeq`, затем приходят новые. Возвращает функцию отписки.
 */
export function subscribe(
  id: string,
  afterSeq: number,
  cb: Subscriber,
): (() => void) | undefined {
  const job = registry().jobs.get(id);
  if (!job) return undefined;
  for (const event of job.events) {
    if (event.seq > afterSeq) cb(event);
  }
  if (FINISHED.has(job.status)) return () => {};
  job.subscribers.add(cb);
  return () => job.subscribers.delete(cb);
}

export function cancelJob(id: string): JobView | undefined {
  const reg = registry();
  const job = reg.jobs.get(id);
  if (!job) return undefined;

  if (job.status === "queued") {
    reg.queue = reg.queue.filter((q) => q !== id);
    finish(reg, job, "cancelled");
  } else if (job.status === "running") {
    // Статус сменится, когда раннер отработает сигнал и завершится
    job.abort.abort();
    pushEvent(job, { type: "log", line: logLine("warn", "Запрошена отмена…") });
  }
  return toView(job);
}

/** Для тестов: подменить раннер и очистить реестр. */
export function configureJobsForTests(
  options: { runner?: JobRunner } = {},
): void {
  const reg = registry();
  reg.jobs.clear();
  reg.queue = [];
  reg.runningId = null;
  reg.runner = options.runner ?? defaultRunner;
}

// =============================================================================
// Внутреннее
// =============================================================================

function pumpQueue(reg: Registry): void {
  if (reg.runningId !== null) return;
  const nextId = reg.queue.shift();
  if (!nextId) return;
  const job = reg.jobs.get(nextId);
  if (!job || job.status !== "queued") {
    pumpQueue(reg);
    return;
  }
  reg.runningId = job.id;
  void execute(reg, job);
}

async function execute(reg: Registry, job: Job): Promise<void> {
  job.status = "running";
  job.startedAt = new Date().toISOString();
  pushEvent(job, { type: "status", status: "running" });

  try {
    const run = await runWithContext(
      {
        emit: (line) => pushEvent(job, { type: "log", line }),
        signal: job.abort.signal,
        interactive: false,
      },
      () => reg.runner(job.params),
    );
    if (job.abort.signal.aborted) {
      finish(reg, job, "cancelled");
    } else {
      job.result = summarize(run);
      pushEvent(job, { type: "done", result: job.result });
      finish(reg, job, "done");
    }
  } catch (error) {
    if (job.abort.signal.aborted) {
      finish(reg, job, "cancelled");
    } else {
      job.error = error instanceof Error ? error.message : String(error);
      pushEvent(job, { type: "error", message: job.error });
      finish(reg, job, "error");
    }
  } finally {
    if (reg.runningId === job.id) reg.runningId = null;
    pumpQueue(reg);
  }
}

function finish(reg: Registry, job: Job, status: JobStatus): void {
  if (FINISHED.has(job.status)) return;
  job.status = status;
  job.finishedAt = new Date().toISOString();
  pushEvent(job, { type: "status", status });
  job.subscribers.clear();
  pruneFinished(reg);
}

function pushEvent(job: Job, payload: JobEventPayload): void {
  const event: JobEvent = {
    ...payload,
    seq: job.nextSeq++,
    ts: new Date().toISOString(),
  };
  job.events.push(event);
  if (job.events.length > MAX_EVENTS_PER_JOB) {
    job.events.splice(0, job.events.length - MAX_EVENTS_PER_JOB);
    job.firstSeq = job.events[0].seq;
  }
  for (const cb of job.subscribers) {
    try {
      cb(event);
    } catch {
      // подписчик умер (закрытый стрим) — снимаем его
      job.subscribers.delete(cb);
    }
  }
}

/** Держим не больше MAX_FINISHED_JOBS завершённых задач, старые удаляем. */
function pruneFinished(reg: Registry): void {
  const finished = Array.from(reg.jobs.values())
    .filter((j) => FINISHED.has(j.status))
    .sort((a, b) => (a.finishedAt! < b.finishedAt! ? 1 : -1));
  for (const job of finished.slice(MAX_FINISHED_JOBS)) {
    reg.jobs.delete(job.id);
  }
}

function summarize(run: RunAnalysisResult): JobResultSummary {
  const { result } = run;
  return {
    outputPath: run.outputPath,
    title: result.title,
    authors: result.authors,
    language: result.language,
    characters: {
      main: result.characters.main.length,
      secondary: result.characters.secondary.length,
      minor: result.characters.minor.length,
    },
    events: result.plotSummary.keyEvents.length,
    usage: run.usage,
    elapsedMs: run.elapsedMs,
    reused: run.reused,
  };
}

function toView(job: Job): JobView {
  return {
    id: job.id,
    params: job.params,
    status: job.status,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    result: job.result,
    error: job.error,
    lastSeq: job.nextSeq - 1,
    droppedEvents: job.firstSeq - 1,
  };
}

function logLine(level: LogLine["level"], text: string): LogLine {
  return { ts: new Date().toISOString(), level, text };
}
