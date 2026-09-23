import type {
  JobEvent,
  JobResultSummary,
  JobStatus,
  JobView,
} from "@/lib/analyzer/jobs";
import type { ModelOption, ProviderAvailability } from "@/lib/analyzer/models";
import type { BookEstimate } from "@/lib/analyzer/run";

export type {
  JobEvent,
  JobResultSummary,
  JobStatus,
  JobView,
  ModelOption,
  ProviderAvailability,
  BookEstimate,
};

export interface PdfFile {
  filename: string;
  sizeBytes: number;
  modifiedAt: string;
}

export interface SeriesOption {
  id: string;
  name: string;
  booksCount?: number;
}

export interface ModelsResponse {
  defaultModel: string;
  models: ModelOption[];
  availability: ProviderAvailability;
}

/** Параметры, которые мастер собирает на шагах 1 и 2. */
export interface WizardSettings {
  pdf: string;
  title: string;
  bookSeriesId: string | null;
  chunkTokens: number;
  model: string;
  fresh: boolean;
}

export const DEFAULT_CHUNK_TOKENS = 100_000;

export async function apiFetch<T>(
  input: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      body &&
      typeof body === "object" &&
      "error" in body &&
      typeof body.error === "string"
        ? body.error
        : `HTTP ${res.status}`;
    throw new Error(message);
  }
  return body as T;
}

export function formatTokens(n: number): string {
  return n.toLocaleString("ru-RU");
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} с`;
  const m = Math.floor(s / 60);
  return `${m} мин ${s % 60} с`;
}

/** Эквивалентная CLI-команда, чтобы админ видел, что именно запускается. */
export function cliPreview(settings: WizardSettings): string {
  const parts = [
    "pnpm analyze",
    JSON.stringify(`lib/analyzer/books/${settings.pdf}`),
    `-m ${settings.model}`,
    `--chunk-tokens ${settings.chunkTokens}`,
  ];
  if (settings.title.trim())
    parts.push(`--title ${JSON.stringify(settings.title.trim())}`);
  if (settings.fresh) parts.push("--fresh");
  return parts.join(" ");
}
