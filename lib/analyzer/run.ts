import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { analyzeBook, workDirFor } from "./analyzer";
import {
  getChunkOptionsForModel,
  getUsageReport,
  type UsageTotals,
} from "./llm-client";
import { extractTextFromPdf } from "./pdf-extractor";
import { print } from "./run-context";
import {
  detectLanguage,
  estimateTokens,
  splitIntoChunks,
} from "./text-chunker";
import type { BookAnalysis } from "./types";

/**
 * Общий раннер анализа для CLI и веб-админки. Вся логика «проверить готовый
 * результат → извлечь текст → analyzeBook → записать JSON» живёт здесь, чтобы
 * оба входа вели себя одинаково.
 */

export const GENERATED_ROOT = resolve(process.cwd(), "lib/analyzer/generated");
export const BOOKS_ROOT = resolve(process.cwd(), "lib/analyzer/books");

export interface RunAnalysisParams {
  pdfPath: string;
  model: string;
  /** Размер фрагмента в токенах; без него берётся значение по модели. */
  chunkTokens?: number;
  /** Название книги, если известно; отключает извлечение метаданных LLM. */
  title?: string;
  /** Игнорировать промежуточные результаты предыдущего запуска. */
  fresh?: boolean;
  /** Claude Message Batches API. */
  batch?: boolean;
  /** Явный путь выходного файла; по умолчанию см. `defaultOutputPath`. */
  outputPath?: string;
  /** Серия для последующей публикации; сохраняется в сайдкар `.meta.json`. */
  bookSeriesId?: string;
}

/** Параметры запуска рядом с результатом: `<basename>.meta.json`. */
export interface AnalysisMeta {
  pdfPath: string;
  model: string;
  chunkTokens?: number;
  title?: string;
  bookSeriesId?: string;
  createdAt: string;
  elapsedMs: number;
  usage: UsageTotals[];
}

export interface RunAnalysisResult {
  outputPath: string;
  result: BookAnalysis;
  /** Использование LLM только за этот запуск. */
  usage: UsageTotals[];
  elapsedMs: number;
  /** true, если готовый JSON уже существовал и анализ не запускался. */
  reused: boolean;
}

export function modelSlug(model: string): string {
  return model.replace(/[/:]/g, "-");
}

/**
 * `lib/analyzer/generated/<model>/<basename>[.c<N>k].analysis.json`.
 * Суффикс размера фрагмента добавляется только при явном `chunkTokens`, чтобы
 * старые файлы без суффикса продолжали находиться.
 */
export function defaultOutputPath(
  pdfPath: string,
  model: string,
  chunkTokens?: number,
): string {
  const name = basename(pdfPath, ".pdf");
  const suffix = chunkTokens ? `.c${Math.round(chunkTokens / 1000)}k` : "";
  return resolve(
    GENERATED_ROOT,
    modelSlug(model),
    `${name}${suffix}.analysis.json`,
  );
}

export function validatePdfPath(pdfPath: string): string {
  const absolutePath = resolve(pdfPath);
  if (!existsSync(absolutePath)) {
    throw new Error(`Файл не найден: ${absolutePath}`);
  }
  if (!absolutePath.toLowerCase().endsWith(".pdf")) {
    throw new Error("Файл должен быть в формате PDF");
  }
  return absolutePath;
}

export function validateChunkTokens(value: number | undefined): void {
  if (value === undefined) return;
  if (!Number.isFinite(value) || value < 5_000 || value > 1_000_000) {
    throw new Error(
      "Размер фрагмента должен быть числом от 5 000 до 1 000 000 токенов",
    );
  }
}

export async function runAnalysis(
  params: RunAnalysisParams,
): Promise<RunAnalysisResult> {
  const startedAt = Date.now();
  const pdfPath = validatePdfPath(params.pdfPath);
  validateChunkTokens(params.chunkTokens);

  const outputPath = params.outputPath
    ? resolve(params.outputPath)
    : defaultOutputPath(pdfPath, params.model, params.chunkTokens);
  await mkdir(dirname(outputPath), { recursive: true });

  const usageBefore = snapshotUsage();

  if (existsSync(outputPath) && !params.fresh) {
    print(`✅ Найден готовый анализ: ${outputPath}`);
    const result = JSON.parse(
      await readFile(outputPath, "utf-8"),
    ) as BookAnalysis;
    // Старые результаты без сайдкара получают его при первом обращении
    if (!existsSync(metaPathFor(outputPath))) {
      await writeAnalysisMeta(outputPath, params, [], Date.now() - startedAt);
    }
    return {
      outputPath,
      result,
      usage: [],
      elapsedMs: Date.now() - startedAt,
      reused: true,
    };
  }

  print("📄 Извлечение текста из PDF...");
  const { text, totalPages } = await extractTextFromPdf(pdfPath);
  print(`   Извлечено ${totalPages} страниц(ы)`);

  const result = await analyzeBook({
    text,
    model: params.model,
    outputPath,
    title: params.title,
    batch: params.batch,
    fresh: params.fresh,
    chunkTokens: params.chunkTokens,
  });

  await writeFile(outputPath, JSON.stringify(result, null, 2), "utf-8");

  const usage = diffUsage(usageBefore, snapshotUsage());
  const elapsedMs = Date.now() - startedAt;
  await writeAnalysisMeta(outputPath, params, usage, elapsedMs);

  return { outputPath, result, usage, elapsedMs, reused: false };
}

// =============================================================================
// Сайдкар с параметрами запуска
// =============================================================================

export function metaPathFor(outputPath: string): string {
  return resolve(outputPath).replace(/\.analysis\.json$/i, "") + ".meta.json";
}

export async function writeAnalysisMeta(
  outputPath: string,
  params: RunAnalysisParams,
  usage: UsageTotals[],
  elapsedMs: number,
): Promise<AnalysisMeta> {
  const meta: AnalysisMeta = {
    pdfPath: resolve(params.pdfPath),
    model: params.model,
    chunkTokens: params.chunkTokens,
    title: params.title,
    bookSeriesId: params.bookSeriesId,
    createdAt: new Date().toISOString(),
    elapsedMs,
    usage,
  };
  await writeFile(
    metaPathFor(outputPath),
    JSON.stringify(meta, null, 2),
    "utf-8",
  );
  return meta;
}

export async function readAnalysisMeta(
  outputPath: string,
): Promise<AnalysisMeta | null> {
  const path = metaPathFor(outputPath);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(await readFile(path, "utf-8")) as AnalysisMeta;
  } catch {
    return null;
  }
}

// =============================================================================
// Оценка объёма книги (шаг 2 мастера)
// =============================================================================

export const CHUNK_SIZE_PRESETS = [50_000, 100_000, 150_000, 250_000] as const;

export interface BookEstimate {
  pages: number;
  chars: number;
  /** Оценка по 3 символам на токен; для английского завышена примерно на четверть. */
  estimatedTokens: number;
  language: "russian" | "english" | "other";
  /** Число фрагментов для каждого размера из CHUNK_SIZE_PRESETS плюс «вся книга». */
  chunkCounts: Record<string, number>;
  /** Размер фрагмента, при котором книга помещается целиком. */
  wholeBookChunkTokens: number;
  recommendedChunkTokens: number;
  /** Каталог промежуточных результатов, если он уже есть для этой пары модель/размер. */
  workDir?: string;
}

export async function estimateBook(
  pdfPath: string,
  model?: string,
): Promise<BookEstimate> {
  const absolutePath = validatePdfPath(pdfPath);
  const { text, totalPages } = await extractTextFromPdf(absolutePath);

  const chunkCounts: Record<string, number> = {};
  for (const size of CHUNK_SIZE_PRESETS) {
    chunkCounts[String(size)] = splitIntoChunks(text, {
      maxTokens: size,
      overlapTokens: Math.round(size * 0.05),
    }).length;
  }

  const estimatedTokens = estimateTokens(text);
  const wholeBookChunkTokens =
    Math.ceil((estimatedTokens * 1.05) / 10_000) * 10_000;
  chunkCounts[String(wholeBookChunkTokens)] = 1;

  const recommended = model
    ? getChunkOptionsForModel(model).maxTokens
    : 100_000;

  return {
    pages: totalPages,
    chars: text.length,
    estimatedTokens,
    language: detectLanguage(text),
    chunkCounts,
    wholeBookChunkTokens,
    recommendedChunkTokens: recommended,
    workDir: model
      ? existingWorkDir(defaultOutputPath(absolutePath, model, recommended))
      : undefined,
  };
}

function existingWorkDir(outputPath: string): string | undefined {
  const dir = workDirFor(outputPath);
  return existsSync(dir) ? dir : undefined;
}

// =============================================================================
// Использование LLM за один запуск
// =============================================================================

function snapshotUsage(): Map<string, UsageTotals> {
  return new Map(getUsageReport().map((u) => [u.model, { ...u }]));
}

function diffUsage(
  before: Map<string, UsageTotals>,
  after: Map<string, UsageTotals>,
): UsageTotals[] {
  const result: UsageTotals[] = [];
  for (const [model, now] of after) {
    const prev = before.get(model);
    const delta: UsageTotals = {
      model,
      requests: now.requests - (prev?.requests ?? 0),
      inputTokens: now.inputTokens - (prev?.inputTokens ?? 0),
      cacheReadTokens: now.cacheReadTokens - (prev?.cacheReadTokens ?? 0),
      cacheWriteTokens: now.cacheWriteTokens - (prev?.cacheWriteTokens ?? 0),
      outputTokens: now.outputTokens - (prev?.outputTokens ?? 0),
      batchRequests: now.batchRequests - (prev?.batchRequests ?? 0),
      estimatedCostUsd:
        now.estimatedCostUsd === null
          ? null
          : now.estimatedCostUsd - (prev?.estimatedCostUsd ?? 0),
    };
    if (delta.requests > 0) result.push(delta);
  }
  return result;
}
