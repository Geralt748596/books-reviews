import "dotenv/config";
import prisma from "../lib/db";
import type { FeedItemType, Prisma } from "../prisma/generated/client";

/**
 * Заполняет feed_item событиями для уже существующих обложек, картинок
 * персонажей, постов и книг. Идемпотентен: дубликаты по (type, sourceId)
 * пропускаются, повторный запуск ничего не добавляет.
 */

const BATCH = 500;

type Row = Prisma.FeedItemCreateManyInput;

async function backfill(
  type: FeedItemType,
  fetchPage: (cursor: string | null) => Promise<Row[]>,
): Promise<number> {
  let cursor: string | null = null;
  let inserted = 0;
  for (;;) {
    const page = await fetchPage(cursor);
    if (page.length === 0) break;
    const result = await prisma.feedItem.createMany({
      data: page,
      skipDuplicates: true,
    });
    inserted += result.count;
    cursor = page.at(-1)!.sourceId;
    if (page.length < BATCH) break;
  }
  console.log(`${type.padEnd(16)} добавлено ${inserted}`);
  return inserted;
}

async function main() {
  const totals: number[] = [];

  totals.push(
    await backfill("COVER", async (cursor) =>
      (
        await prisma.generatedBookCover.findMany({
          take: BATCH,
          orderBy: { id: "asc" },
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          select: { id: true, bookId: true, userId: true, createdAt: true },
        })
      ).map((c) => ({
        type: "COVER" as const,
        sourceId: c.id,
        createdAt: c.createdAt,
        actorId: c.userId,
        bookId: c.bookId,
        coverId: c.id,
      })),
    ),
  );

  totals.push(
    await backfill("CHARACTER_IMAGE", async (cursor) =>
      (
        await prisma.generatedCharacterImage.findMany({
          take: BATCH,
          orderBy: { id: "asc" },
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          select: { id: true, bookId: true, userId: true, createdAt: true },
        })
      ).map((i) => ({
        type: "CHARACTER_IMAGE" as const,
        sourceId: i.id,
        createdAt: i.createdAt,
        actorId: i.userId,
        bookId: i.bookId,
        characterImageId: i.id,
      })),
    ),
  );

  totals.push(
    await backfill("POST", async (cursor) =>
      (
        await prisma.post.findMany({
          take: BATCH,
          orderBy: { id: "asc" },
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          select: { id: true, bookId: true, userId: true, createdAt: true },
        })
      ).map((p) => ({
        type: "POST" as const,
        sourceId: p.id,
        createdAt: p.createdAt,
        actorId: p.userId,
        bookId: p.bookId,
        postId: p.id,
      })),
    ),
  );

  totals.push(
    await backfill("BOOK_ADDED", async (cursor) =>
      (
        await prisma.book.findMany({
          take: BATCH,
          orderBy: { id: "asc" },
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          select: { id: true, createdAt: true },
        })
      ).map((b) => ({
        type: "BOOK_ADDED" as const,
        sourceId: b.id,
        createdAt: b.createdAt,
        actorId: null,
        bookId: b.id,
      })),
    ),
  );

  console.log(`Итого добавлено: ${totals.reduce((a, b) => a + b, 0)}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
