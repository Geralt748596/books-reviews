import { existsSync } from "node:fs";
import { basename, resolve, sep } from "node:path";
import { z } from "zod";
import { BOOKS_ROOT, GENERATED_ROOT } from "./run";

/**
 * Схемы и проверки входных данных API админки. Вынесены отдельно от route
 * handlers, чтобы их можно было тестировать без Next.
 */

/** Имя модели: буквы, цифры, точка, дефис, двоеточие, слэш, подчёркивание. */
export const MODEL_NAME_PATTERN = /^[a-z0-9][a-z0-9._:/-]{0,63}$/i;

export const modelNameSchema = z
  .string()
  .trim()
  .regex(MODEL_NAME_PATTERN, "Недопустимое имя модели");

/** Только имя файла внутри lib/analyzer/books, без путей. */
export const pdfFilenameSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .refine((v) => v.toLowerCase().endsWith(".pdf"), "Нужен файл .pdf")
  .refine(
    (v) => !v.includes("/") && !v.includes("\\") && v !== "." && v !== "..",
    "Укажите имя файла, а не путь",
  );

export const chunkTokensSchema = z
  .number()
  .int()
  .min(5_000, "Минимум 5 000 токенов")
  .max(1_000_000, "Максимум 1 000 000 токенов");

export const estimateRequestSchema = z.object({
  pdf: pdfFilenameSchema,
  model: modelNameSchema.optional(),
});

export const createJobRequestSchema = z.object({
  pdf: pdfFilenameSchema,
  model: modelNameSchema,
  chunkTokens: chunkTokensSchema.optional(),
  title: z.string().trim().max(300).optional(),
  bookSeriesId: z.string().trim().min(1).max(64).optional(),
  fresh: z.boolean().optional(),
  batch: z.boolean().optional(),
});

export const createSeriesRequestSchema = z.object({
  name: z.string().trim().min(1, "Введите название").max(200),
});

export const publishRequestSchema = z.object({
  /** Путь к .analysis.json относительно корня проекта или абсолютный. */
  jsonPath: z.string().trim().min(1),
  bookSeriesId: z.string().trim().min(1).max(64).optional(),
  publishedDate: z.string().trim().max(32).optional(),
  model: modelNameSchema.optional(),
  skipImages: z.boolean().optional(),
  dryRun: z.boolean().optional(),
});

export type CreateJobRequest = z.infer<typeof createJobRequestSchema>;

// =============================================================================
// Пути
// =============================================================================

function isInside(root: string, absolutePath: string): boolean {
  const normalizedRoot = resolve(root) + sep;
  const normalized = resolve(absolutePath);
  return normalized === resolve(root) || normalized.startsWith(normalizedRoot);
}

/** Абсолютный путь к PDF в каталоге книг. Бросает, если файл вне каталога или не существует. */
export function resolveBookPdf(filename: string): string {
  const absolutePath = resolve(BOOKS_ROOT, basename(filename));
  if (!isInside(BOOKS_ROOT, absolutePath)) {
    throw new Error("Путь вне каталога книг");
  }
  if (!existsSync(absolutePath)) {
    throw new Error(`Файл не найден: ${filename}`);
  }
  return absolutePath;
}

/** Абсолютный путь к JSON анализа внутри lib/analyzer/generated. */
export function resolveGeneratedJson(jsonPath: string): string {
  const absolutePath = resolve(process.cwd(), jsonPath);
  if (!isInside(GENERATED_ROOT, absolutePath)) {
    throw new Error("Путь вне каталога результатов");
  }
  if (!absolutePath.endsWith(".analysis.json")) {
    throw new Error("Ожидается файл .analysis.json");
  }
  return absolutePath;
}

/** Ответ 400 из ошибки zod: первое сообщение как текст, остальное в details. */
export function zodMessage(error: z.ZodError): string {
  const first = error.issues[0];
  const path = first?.path?.join(".");
  return path
    ? `${path}: ${first.message}`
    : (first?.message ?? "Некорректный запрос");
}
