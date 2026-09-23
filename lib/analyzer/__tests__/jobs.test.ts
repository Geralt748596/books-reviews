import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import {
  MAX_EVENTS_PER_JOB,
  cancelJob,
  configureJobsForTests,
  createJob,
  getEvents,
  getJob,
  listJobs,
  subscribe,
  type JobEvent,
  type JobParams,
  type JobStatus,
} from "../jobs";
import { getAbortSignal, print } from "../run-context";
import type { RunAnalysisResult } from "../run";

const params: JobParams = { pdfPath: "book.pdf", model: "test-model" };

function fakeResult(
  overrides: Partial<RunAnalysisResult> = {},
): RunAnalysisResult {
  return {
    outputPath: "/tmp/book.analysis.json",
    result: {
      title: "Книга",
      authors: "Автор",
      language: "russian",
      characters: {
        main: [
          {
            name: "A",
            aliases: [],
            appearance: "",
            personality: "",
            description: "",
            role: "",
          },
        ],
        secondary: [],
        minor: [],
      },
      plotSummary: { overview: "", keyEvents: ["e1", "e2"] },
    },
    usage: [],
    elapsedMs: 1,
    reused: false,
    ...overrides,
  };
}

async function waitForStatus(id: string, status: JobStatus, timeoutMs = 2000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (getJob(id)?.status === status) return getJob(id)!;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error(
    `job ${id} не достигла статуса ${status}, сейчас ${getJob(id)?.status}`,
  );
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => configureJobsForTests());

test("задача проходит queued → running → done, логи и итог попадают в события", async () => {
  configureJobsForTests({
    runner: async () => {
      print("шаг 1");
      print("шаг 2");
      return fakeResult();
    },
  });
  const job = createJob(params);
  // очередь пуста, поэтому задача стартует синхронно ещё внутри createJob
  assert.ok(["queued", "running"].includes(job.status));
  const done = await waitForStatus(job.id, "done");

  const { events } = getEvents(job.id)!;
  const statuses = events
    .filter((e) => e.type === "status")
    .map((e) => (e as { status: JobStatus }).status);
  assert.deepEqual(statuses, ["queued", "running", "done"]);
  const logs = events
    .filter((e) => e.type === "log")
    .map((e) => (e as { line: { text: string } }).line.text);
  assert.deepEqual(logs, ["шаг 1", "шаг 2"]);
  assert.equal(done.result?.characters.main, 1);
  assert.equal(done.result?.events, 2);
  assert.equal(done.lastSeq, events.at(-1)!.seq);
});

test("одновременно выполняется одна задача, вторая ждёт в очереди", async () => {
  const gate = deferred<void>();
  configureJobsForTests({
    runner: async () => {
      await gate.promise;
      return fakeResult();
    },
  });
  const first = createJob(params);
  const second = createJob({ ...params, pdfPath: "other.pdf" });
  await waitForStatus(first.id, "running");
  assert.equal(getJob(second.id)?.status, "queued");

  gate.resolve();
  await waitForStatus(first.id, "done");
  await waitForStatus(second.id, "done");
  assert.equal(
    listJobs()[0].id,
    second.id,
    "listJobs отдаёт от новых к старым",
  );
});

test("кольцевой буфер вытесняет старые события и сообщает об этом", async () => {
  const extra = 100;
  configureJobsForTests({
    runner: async () => {
      for (let i = 0; i < MAX_EVENTS_PER_JOB + extra; i++) print(`строка ${i}`);
      return fakeResult();
    },
  });
  const job = createJob(params);
  const done = await waitForStatus(job.id, "done");

  const replay = getEvents(job.id, 0)!;
  assert.equal(replay.events.length, MAX_EVENTS_PER_JOB);
  assert.equal(replay.truncated, true);
  assert.ok(done.droppedEvents >= extra);
  assert.equal(getEvents(job.id, done.lastSeq - 1)!.truncated, false);
});

test("подписчик получает повтор с нужного места и живые события", async () => {
  const gate = deferred<void>();
  configureJobsForTests({
    runner: async () => {
      print("до подписки");
      await gate.promise;
      print("после подписки");
      return fakeResult();
    },
  });
  const job = createJob(params);
  await waitForStatus(job.id, "running");
  await new Promise((r) => setTimeout(r, 10));

  const received: JobEvent[] = [];
  const unsubscribe = subscribe(job.id, 0, (e) => received.push(e))!;
  const texts = () =>
    received
      .filter((e) => e.type === "log")
      .map((e) => (e as { line: { text: string } }).line.text);
  assert.deepEqual(texts(), ["до подписки"]);

  gate.resolve();
  await waitForStatus(job.id, "done");
  assert.deepEqual(texts(), ["до подписки", "после подписки"]);
  assert.equal(received.at(-1)?.type, "status");
  unsubscribe();

  // повтор только новых событий
  const late: JobEvent[] = [];
  subscribe(job.id, received[1].seq, (e) => late.push(e));
  assert.ok(late.length > 0);
  assert.ok(late.every((e) => e.seq > received[1].seq));
});

test("отмена: из очереди сразу, во время выполнения через сигнал", async () => {
  const gate = deferred<void>();
  configureJobsForTests({
    runner: async () => {
      const signal = getAbortSignal()!;
      await new Promise<void>((resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("aborted")), {
          once: true,
        });
        gate.promise.then(resolve);
      });
      return fakeResult();
    },
  });
  const running = createJob(params);
  const queued = createJob({ ...params, pdfPath: "other.pdf" });
  await waitForStatus(running.id, "running");

  assert.equal(cancelJob(queued.id)?.status, "cancelled");
  cancelJob(running.id);
  const cancelled = await waitForStatus(running.id, "cancelled");
  assert.equal(cancelled.error, undefined);
  gate.resolve();
});

test("ошибка раннера переводит задачу в error с текстом", async () => {
  configureJobsForTests({
    runner: async () => {
      throw new Error("LLM недоступна");
    },
  });
  const job = createJob(params);
  const failed = await waitForStatus(job.id, "error");
  assert.equal(failed.error, "LLM недоступна");
  const last = getEvents(job.id)!.events.filter(
    (e) => e.type === "error",
  )[0] as { message: string };
  assert.equal(last.message, "LLM недоступна");
});
