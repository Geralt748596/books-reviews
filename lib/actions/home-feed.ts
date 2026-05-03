"use server";

import { getSession } from "@/lib/actions/session";
import prisma from "@/lib/db";
import {
  HOME_FEED_PAGE_SIZE,
  type FeedCursor,
  type FeedItem,
  type FeedItemType,
  type FeedPage,
} from "@/lib/feed/types";
import { cacheLife } from "next/cache";

export async function getHomeFeedPage(cursor?: FeedCursor): Promise<FeedPage> {
  const publicPage = await getPublicFeedPage(cursor);
  const session = await getSession();
  const userId = session?.user.id;

  if (!userId || !publicPage.items.length) {
    return publicPage;
  }

  const likedIds = await getFeedLikedIds(userId, publicPage.items);

  return {
    ...publicPage,
    items: publicPage.items.map((item) => ({
      ...item,
      isLiked:
        item.type === "cover"
          ? likedIds.coverIds.has(item.id)
          : likedIds.characterImageIds.has(item.id),
    })),
  };
}

async function getPublicFeedPage(cursor?: FeedCursor): Promise<FeedPage> {
  "use cache";
  cacheLife("seconds");

  const [covers, characterImages] = await Promise.all([
    prisma.generatedBookCover.findMany({
      where: getCursorWhere("cover", cursor),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: HOME_FEED_PAGE_SIZE + 1,
      select: {
        id: true,
        prompt: true,
        blobUrl: true,
        createdAt: true,
        user: { select: { id: true, name: true, image: true } },
        book: {
          select: {
            id: true,
            title: true,
            authors: true,
            thumbnailUrl: true,
          },
        },
        _count: { select: { likes: true, comments: true } },
        comments: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            content: true,
            user: { select: { name: true, image: true } },
          },
        },
      },
    }),
    prisma.generatedCharacterImage.findMany({
      where: getCursorWhere("character", cursor),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: HOME_FEED_PAGE_SIZE + 1,
      select: {
        id: true,
        prompt: true,
        blobUrl: true,
        createdAt: true,
        user: { select: { id: true, name: true, image: true } },
        book: {
          select: {
            id: true,
            title: true,
            authors: true,
            thumbnailUrl: true,
          },
        },
        character: { select: { id: true, name: true } },
        _count: { select: { likes: true, comments: true } },
        comments: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            content: true,
            user: { select: { name: true, image: true } },
          },
        },
      },
    }),
  ]);

  const items: FeedItem[] = [
    ...covers.map((cover) => ({
      id: cover.id,
      type: "cover" as const,
      prompt: cover.prompt,
      blobUrl: cover.blobUrl,
      createdAt: cover.createdAt.toISOString(),
      user: cover.user,
      book: cover.book,
      likesCount: cover._count.likes,
      isLiked: false,
      commentsCount: cover._count.comments,
      lastComment: cover.comments[0] ?? null,
    })),
    ...characterImages.map((image) => ({
      id: image.id,
      type: "character" as const,
      prompt: image.prompt,
      blobUrl: image.blobUrl,
      createdAt: image.createdAt.toISOString(),
      user: image.user,
      book: image.book,
      character: image.character,
      likesCount: image._count.likes,
      isLiked: false,
      commentsCount: image._count.comments,
      lastComment: image.comments[0] ?? null,
    })),
  ].sort(compareFeedItems);

  const pageItems = items.slice(0, HOME_FEED_PAGE_SIZE);
  const lastItem = pageItems.at(-1);

  return {
    items: pageItems,
    nextCursor:
      items.length > HOME_FEED_PAGE_SIZE && lastItem
        ? {
            type: lastItem.type,
            id: lastItem.id,
            createdAt: lastItem.createdAt,
          }
        : null,
  };
}

async function getFeedLikedIds(userId: string, items: FeedItem[]) {
  const coverItemIds = items
    .filter((item) => item.type === "cover")
    .map((item) => item.id);
  const characterImageItemIds = items
    .filter((item) => item.type === "character")
    .map((item) => item.id);

  const [coverLikes, characterImageLikes] = await Promise.all([
    coverItemIds.length
      ? prisma.coverLike.findMany({
          where: { userId, coverId: { in: coverItemIds } },
          select: { coverId: true },
        })
      : [],
    characterImageItemIds.length
      ? prisma.characterImageLike.findMany({
          where: { userId, characterId: { in: characterImageItemIds } },
          select: { characterId: true },
        })
      : [],
  ]);

  return {
    coverIds: new Set(coverLikes.map((like) => like.coverId)),
    characterImageIds: new Set(
      characterImageLikes.map((like) => like.characterId),
    ),
  };
}

function getCursorWhere(type: FeedItemType, cursor?: FeedCursor) {
  if (!cursor) return undefined;

  const cursorDate = new Date(cursor.createdAt);
  const sourceRank = getTypeRank(type);
  const cursorRank = getTypeRank(cursor.type);
  const sameCreatedAtClause =
    sourceRank < cursorRank
      ? { createdAt: cursorDate }
      : sourceRank === cursorRank
        ? { createdAt: cursorDate, id: { lt: cursor.id } }
        : null;

  return {
    OR: [
      { createdAt: { lt: cursorDate } },
      ...(sameCreatedAtClause ? [sameCreatedAtClause] : []),
    ],
  };
}

function compareFeedItems(a: FeedItem, b: FeedItem) {
  const createdAtDiff =
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  if (createdAtDiff !== 0) return createdAtDiff;

  const typeDiff = getTypeRank(b.type) - getTypeRank(a.type);
  if (typeDiff !== 0) return typeDiff;

  return b.id.localeCompare(a.id);
}

function getTypeRank(type: FeedItemType) {
  return type === "cover" ? 1 : 0;
}
