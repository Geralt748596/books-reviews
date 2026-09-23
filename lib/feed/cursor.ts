import { z } from "zod";
import type { FeedCursor } from "./types";

/** Курсор из query-параметров GET /api/feed: `after` (ISO-дата) и `afterId`. */
export const feedCursorSchema = z.object({
  createdAt: z.iso.datetime({ offset: true }),
  id: z.string().min(1).max(64),
});

/**
 * Keyset-предикат «строго после курсора» для сортировки (createdAt desc, id desc).
 * Ручной вариант вместо Prisma `cursor` + `skip: 1`: строку-курсор могли удалить
 * каскадом, и Prisma-курсор вернул бы пустую страницу.
 */
export function cursorWhere(cursor?: FeedCursor) {
  if (!cursor) return undefined;
  const createdAt = new Date(cursor.createdAt);
  return {
    OR: [
      { createdAt: { lt: createdAt } },
      { createdAt, id: { lt: cursor.id } },
    ],
  };
}

/** Разбор курсора из URL; отсутствие обоих параметров — первая страница. */
export function parseCursor(
  searchParams: URLSearchParams,
): { cursor: FeedCursor | undefined } | { error: string } {
  const after = searchParams.get("after");
  const afterId = searchParams.get("afterId");
  if (!after && !afterId) return { cursor: undefined };

  const parsed = feedCursorSchema.safeParse({ createdAt: after, id: afterId });
  if (!parsed.success) return { error: "Invalid cursor" };
  return { cursor: parsed.data };
}

export function cursorToSearchParams(cursor: FeedCursor): URLSearchParams {
  return new URLSearchParams({ after: cursor.createdAt, afterId: cursor.id });
}
