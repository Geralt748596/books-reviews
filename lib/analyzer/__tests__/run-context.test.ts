import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getAbortSignal,
  isInteractive,
  log,
  phase,
  print,
  runWithContext,
  warn,
  type LogLine,
} from "../run-context";

test("внутри контекста строки уходят в emit, а не в консоль", async () => {
  const lines: LogLine[] = [];
  const consoleLines: unknown[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => consoleLines.push(args);
  try {
    await runWithContext({ emit: (l) => lines.push(l) }, async () => {
      log("детали");
      print("заголовок");
      phase("Проход 1: старт");
      warn("осторожно");
    });
  } finally {
    console.log = original;
  }
  assert.equal(lines.length, 4);
  assert.deepEqual(
    lines.map((l) => l.level),
    ["info", "info", "phase", "warn"],
  );
  assert.match(lines[0].text, /^\[\d{2}:\d{2}:\d{2}\] детали$/);
  assert.equal(lines[1].text, "заголовок");
  assert.equal(consoleLines.length, 0);
  for (const l of lines) assert.ok(!Number.isNaN(Date.parse(l.ts)));
});

test("без контекста вывод идёт в консоль", () => {
  const consoleLines: string[] = [];
  const original = console.log;
  console.log = (line: string) => consoleLines.push(line);
  try {
    print("в консоль");
  } finally {
    console.log = original;
  }
  assert.deepEqual(consoleLines, ["в консоль"]);
});

test("параллельные контексты не смешивают строки", async () => {
  const a: LogLine[] = [];
  const b: LogLine[] = [];
  await Promise.all([
    runWithContext({ emit: (l) => a.push(l) }, async () => {
      print("a1");
      await new Promise((r) => setTimeout(r, 5));
      print("a2");
    }),
    runWithContext({ emit: (l) => b.push(l) }, async () => {
      print("b1");
      await new Promise((r) => setTimeout(r, 1));
      print("b2");
    }),
  ]);
  assert.deepEqual(
    a.map((l) => l.text),
    ["a1", "a2"],
  );
  assert.deepEqual(
    b.map((l) => l.text),
    ["b1", "b2"],
  );
});

test("сигнал отмены и интерактивность берутся из контекста", async () => {
  const controller = new AbortController();
  await runWithContext(
    { emit: () => {}, signal: controller.signal, interactive: false },
    async () => {
      assert.equal(getAbortSignal(), controller.signal);
      assert.equal(isInteractive(), false);
      controller.abort();
      assert.equal(getAbortSignal()?.aborted, true);
    },
  );
  assert.equal(getAbortSignal(), undefined);
});
