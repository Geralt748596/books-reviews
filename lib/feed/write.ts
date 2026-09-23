import type { Prisma, PrismaClient } from "@/prisma/generated/client";

/**
 * Запись событий ленты. Вызывается в той же транзакции, что и создание источника,
 * поэтому принимает и клиент, и TransactionClient. Все функции идемпотентны:
 * upsert по (type, sourceId), createdAt копируется из источника.
 */
export type FeedDb = PrismaClient | Prisma.TransactionClient;

interface SourceWithActor {
  id: string;
  bookId: string;
  userId: string;
  createdAt: Date;
}

export async function recordCoverAdded(db: FeedDb, cover: SourceWithActor) {
  return db.feedItem.upsert({
    where: { type_sourceId: { type: "COVER", sourceId: cover.id } },
    create: {
      type: "COVER",
      sourceId: cover.id,
      createdAt: cover.createdAt,
      actorId: cover.userId,
      bookId: cover.bookId,
      coverId: cover.id,
    },
    update: {},
  });
}

export async function recordCharacterImageAdded(
  db: FeedDb,
  image: SourceWithActor,
) {
  return db.feedItem.upsert({
    where: { type_sourceId: { type: "CHARACTER_IMAGE", sourceId: image.id } },
    create: {
      type: "CHARACTER_IMAGE",
      sourceId: image.id,
      createdAt: image.createdAt,
      actorId: image.userId,
      bookId: image.bookId,
      characterImageId: image.id,
    },
    update: {},
  });
}

export async function recordPostAdded(db: FeedDb, post: SourceWithActor) {
  return db.feedItem.upsert({
    where: { type_sourceId: { type: "POST", sourceId: post.id } },
    create: {
      type: "POST",
      sourceId: post.id,
      createdAt: post.createdAt,
      actorId: post.userId,
      bookId: post.bookId,
      postId: post.id,
    },
    update: {},
  });
}

/** Системное событие: без актора по решению продукта. */
export async function recordBookAdded(
  db: FeedDb,
  book: { id: string; createdAt: Date },
) {
  return db.feedItem.upsert({
    where: { type_sourceId: { type: "BOOK_ADDED", sourceId: book.id } },
    create: {
      type: "BOOK_ADDED",
      sourceId: book.id,
      createdAt: book.createdAt,
      actorId: null,
      bookId: book.id,
    },
    update: {},
  });
}
