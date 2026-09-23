import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import type { BookAnalysis } from "./types";

export interface PublishOptions {
  bookSeriesId?: string;
  publishedDate?: string;
  model?: string;
  /** Только сохранить в БД, без генерации обложки и картинок. */
  skipImages?: boolean;
  /** Проверить сохранение в транзакции с откатом, ничего не записывая. */
  dryRun?: boolean;
  onProgress?: (message: string) => void;
}

// Пользователь, от имени которого создаются картинки при публикации из CLI
const adminUserId =
  process.env.ANALYZER_ADMIN_USER_ID ?? "cWs2jB6cuCIAkeEryxrMlCvej2S1DtDd";

export interface PublishResult {
  bookId: string;
  updated: boolean;
  charactersCreated: number;
  charactersReused: number;
  publishedDate: string | null;
  dryRun: boolean;
}

export async function publishBook(
  analysisPath: string,
  opts: PublishOptions = {},
): Promise<PublishResult> {
  const progress = (message: string) => opts.onProgress?.(message);

  if (!existsSync(analysisPath)) {
    throw new Error(`Файл не найден: ${analysisPath}`);
  }

  progress("Reading analysis file...");
  const result = JSON.parse(
    await readFile(analysisPath, "utf-8"),
  ) as BookAnalysis;

  if (!result.title || !result.characters || !result.plotSummary) {
    throw new Error(
      "Некорректный JSON анализа: missing title/characters/plotSummary",
    );
  }

  const { searchPublishedDate } = await import("./llm-client");
  const { persistAnalysis } = await import("./db-persistence");

  progress("Searching published date...");
  const publishedDate = opts.publishedDate
    ? opts.publishedDate
    : await searchPublishedDate(
        result.title,
        result.authors,
        opts.model ?? "qwen3.5:latest",
      );

  progress("Persisting to database...");
  const persisted = await persistAnalysis(result, {
    bookSeriesId: opts.bookSeriesId,
    publishedDate,
    dryRun: opts.dryRun,
  });
  const { bookId } = persisted;
  const summary: PublishResult = {
    bookId,
    updated: persisted.updated,
    charactersCreated: persisted.charactersCreated,
    charactersReused: persisted.charactersReused,
    publishedDate: publishedDate ?? null,
    dryRun: Boolean(opts.dryRun),
  };

  progress(
    `\n📚 Книга ${persisted.updated ? "обновлена" : "сохранена"} в БД: ${bookId} ` +
      `(персонажей создано ${persisted.charactersCreated}, переиспользовано ${persisted.charactersReused})` +
      (opts.dryRun ? " — DRY RUN, транзакция откачена" : ""),
  );

  if (opts.skipImages || opts.dryRun) {
    progress(`\n✅ Published: ${result.title}`);
    progress(`   JSON: ${analysisPath}`);
    progress(`   Published date: ${publishedDate ?? "unknown"}`);
    return summary;
  }

  progress("\n🎨 Генерация изображений...");

  const { createBookCover, createCharacterImage } =
    await import("@/lib/images/service");
  const prisma = (await import("../db")).default;

  // Обложку и картинки не пересоздаём при повторной публикации
  const existingCover = await prisma.generatedBookCover.findFirst({
    where: { bookId },
    select: { id: true },
  });
  if (existingCover) {
    progress("   Обложка уже есть, пропуск");
  } else {
    progress("Generating book cover...");
    const coverResult = await createBookCover(bookId, adminUserId);
    progress(
      `   Обложка: ${"image" in coverResult ? "✅" : "❌ " + coverResult.error}`,
    );
  }

  progress("Generating character images...");
  // Главные персонажи первыми, затем второстепенные; tier хранится в описании
  const topCharacters = await prisma.characterDescription.findMany({
    where: { bookId, tier: { in: ["MAIN", "SECONDARY"] } },
    orderBy: [{ tier: "asc" }, { createdAt: "asc" }],
    take: 3,
    select: { characterId: true, character: { select: { name: true } } },
  });
  const withImages = new Set(
    (
      await prisma.generatedCharacterImage.findMany({
        where: { bookId },
        select: { characterId: true },
      })
    ).map((img) => img.characterId),
  );

  for (const entry of topCharacters) {
    if (withImages.has(entry.characterId)) {
      progress(`   ${entry.character.name}: картинка уже есть, пропуск`);
      continue;
    }
    const charResult = await createCharacterImage(
      bookId,
      entry.characterId,
      adminUserId,
    );
    progress(
      `   ${entry.character.name}: ${"image" in charResult ? "✅" : "❌ " + charResult.error}`,
    );
  }

  progress(`\n✅ Published: ${result.title}`);
  progress(`   JSON: ${analysisPath}`);
  progress(`   Published date: ${publishedDate ?? "unknown"}`);

  return summary;
}
