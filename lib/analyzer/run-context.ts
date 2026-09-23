import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Контекст выполнения анализа.
 *
 * Весь вывод анализатора идёт через функции этого модуля. Если код выполняется
 * внутри `runWithContext`, строки уходят в `emit` контекста (CLI печатает их в
 * консоль, веб-задача складывает в буфер и шлёт по SSE). Без контекста строки
 * печатаются в консоль напрямую, поэтому старые вызовы продолжают работать.
 */

export type LogLevel = "info" | "phase" | "success" | "warn" | "error";

export interface LogLine {
  /** ISO-время создания строки. */
  ts: string;
  level: LogLevel;
  text: string;
}

export interface RunContext {
  emit(line: LogLine): void;
  /** Сигнал отмены для всех сетевых запросов внутри контекста. */
  signal?: AbortSignal;
  /** Можно ли рисовать спиннеры (интерактивный терминал). По умолчанию false. */
  interactive?: boolean;
}

const storage = new AsyncLocalStorage<RunContext>();

export function runWithContext<T>(
  context: RunContext,
  fn: () => Promise<T>,
): Promise<T> {
  return storage.run(context, fn);
}

export function getRunContext(): RunContext | undefined {
  return storage.getStore();
}

export function getAbortSignal(): AbortSignal | undefined {
  return storage.getStore()?.signal;
}

/** Спиннеры уместны только в интерактивном терминале без перехвата вывода. */
export function isInteractive(): boolean {
  const ctx = storage.getStore();
  if (ctx) return ctx.interactive === true;
  return Boolean(process.stdout.isTTY);
}

// =============================================================================
// Вывод
// =============================================================================

function emitOrPrint(level: LogLevel, text: string): void {
  const line: LogLine = { ts: new Date().toISOString(), level, text };
  const ctx = storage.getStore();
  if (ctx) {
    ctx.emit(line);
  } else {
    printToConsole(line);
  }
}

/** Строка с меткой времени: детали запросов к LLM, тайминги, размеры. */
export function log(text: string): void {
  emitOrPrint("info", `[${clockTime()}] ${text}`);
}

/** Строка без метки времени: заголовки и сводки, как раньше `console.log`. */
export function print(text: string): void {
  emitOrPrint("info", text);
}

/** Начало этапа: «Проход 1», «Классификация» и т.п. Веб показывает как вехи. */
export function phase(text: string): void {
  emitOrPrint("phase", text);
}

export function success(text: string): void {
  emitOrPrint("success", text);
}

export function warn(text: string): void {
  emitOrPrint("warn", text);
}

export function error(text: string): void {
  emitOrPrint("error", text);
}

// =============================================================================
// Консольный вывод (CLI)
// =============================================================================

export function printToConsole(line: LogLine): void {
  switch (line.level) {
    case "success":
      console.log(`✔ ${line.text}`);
      break;
    case "warn":
      console.log(`⚠ ${line.text}`);
      break;
    case "error":
      console.error(`✖ ${line.text}`);
      break;
    default:
      console.log(line.text);
  }
}

/** Готовый контекст для CLI: печать в консоль, спиннеры при TTY, отмена по сигналу. */
export function consoleContext(signal?: AbortSignal): RunContext {
  return {
    emit: printToConsole,
    signal,
    interactive: Boolean(process.stdout.isTTY),
  };
}

function clockTime(): string {
  return new Date().toLocaleTimeString("ru-RU", { hour12: false });
}
