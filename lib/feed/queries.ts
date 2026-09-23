import prisma from "@/lib/db";
import { cacheLife, cacheTag } from "next/cache";
import { cursorWhere } from "./cursor";
import { mapFeedRow } from "./map";
import { HOME_FEED_TAG } from "./tags";
import {
  HOME_FEED_PAGE_SIZE,
  type FeedCursor,
  type FeedItem,
  type FeedPage,
} from "./types";

const imageSelect = {
  id: true,
  blobUrl: true,
  _count: { select: { likes: true, comments: true } },
  comments: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: {
      content: true,
      user: { select: { name: true, image: true } },
    },
  },
};

/**
 * Публичная страница ленты: один запрос по индексу (createdAt desc, id desc),
 * кэш по курсору, инвалидация по тегу при записи событий.
 */
export async function getPublicFeedPage(
  cursor?: FeedCursor,
): Promise<FeedPage> {
  "use cache";
  cacheLife("feed");
  cacheTag(HOME_FEED_TAG);

  const rows = await prisma.feedItem.findMany({
    where: cursorWhere(cursor),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: HOME_FEED_PAGE_SIZE + 1,
    select: {
      id: true,
      type: true,
      createdAt: true,
      actor: { select: { id: true, name: true, image: true } },
      book: {
        select: {
          id: true,
          title: true,
          authors: true,
          thumbnailUrl: true,
          description: true,
        },
      },
      cover: { select: imageSelect },
      characterImage: {
        select: {
          ...imageSelect,
          character: { select: { id: true, name: true } },
        },
      },
      post: {
        select: {
          id: true,
          content: true,
          character: { select: { id: true, name: true } },
        },
      },
    },
  });

  const hasMore = rows.length > HOME_FEED_PAGE_SIZE;
  const pageRows = hasMore ? rows.slice(0, HOME_FEED_PAGE_SIZE) : rows;
  const items: FeedItem[] = [];
  for (const row of pageRows) {
    const item = mapFeedRow(row);
    if (item) items.push(item);
    else
      console.warn(`feed: row ${row.id} (${row.type}) без payload, пропущена`);
  }

  const last = pageRows.at(-1);
  return {
    items,
    nextCursor:
      hasMore && last
        ? { createdAt: last.createdAt.toISOString(), id: last.id }
        : null,
  };
}

/** Страница ленты с лайками пользователя; сами лайки вне кэша. */
export async function getHomeFeedPage(
  cursor: FeedCursor | undefined,
  userId: string | null,
): Promise<FeedPage> {
  const page = await getPublicFeedPage(cursor);
  if (!userId || page.items.length === 0) return page;

  const liked = await getFeedLikedIds(userId, page.items);
  return {
    ...page,
    items: page.items.map((item) => {
      if (item.kind === "cover") {
        return {
          ...item,
          cover: { ...item.cover, isLiked: liked.coverIds.has(item.cover.id) },
        };
      }
      if (item.kind === "character_image") {
        return {
          ...item,
          image: {
            ...item.image,
            isLiked: liked.characterImageIds.has(item.image.id),
          },
        };
      }
      return item;
    }),
  };
}

async function getFeedLikedIds(userId: string, items: FeedItem[]) {
  const coverIds = items.flatMap((i) =>
    i.kind === "cover" ? [i.cover.id] : [],
  );
  const imageIds = items.flatMap((i) =>
    i.kind === "character_image" ? [i.image.id] : [],
  );

  const [coverLikes, imageLikes] = await Promise.all([
    coverIds.length
      ? prisma.coverLike.findMany({
          where: { userId, coverId: { in: coverIds } },
          select: { coverId: true },
        })
      : [],
    imageIds.length
      ? // CharacterImageLike.characterId хранит id GeneratedCharacterImage
        prisma.characterImageLike.findMany({
          where: { userId, characterId: { in: imageIds } },
          select: { characterId: true },
        })
      : [],
  ]);

  return {
    coverIds: new Set(coverLikes.map((l) => l.coverId)),
    characterImageIds: new Set(imageLikes.map((l) => l.characterId)),
  };
}
