"use server";

import { getSession } from "@/lib/actions/session";
import prisma from "@/lib/db";
import type { Book } from "@/prisma/generated/client";
import { cacheLife } from "next/cache";

type CharacterImage = {
  id: string;
  blobUrl: string;
  user: { name: string | null };
  likesCount: number;
  isLiked: boolean;
};

const BOOK_CHARACTERS_PAGE_SIZE = 5;

export type BookCharacterCard = {
  characterId: string;
  characterName: string;
  images: CharacterImage[];
};

export type BookCharactersPage = {
  items: BookCharacterCard[];
  nextOffset: number | null;
};

type CachedCharacter = {
  characterId: string;
  characterName: string;
  images: Omit<CharacterImage, "isLiked">[];
};

export async function getBookCharactersImages(
  bookId: Book["id"],
  offset = 0,
): Promise<BookCharactersPage> {
  const safeOffset = Math.max(0, offset);
  const page = await getCachedBookCharacters(bookId, safeOffset);
  const imageIds = page.items.flatMap((item) =>
    item.images.map((image) => image.id),
  );
  const session = await getSession();
  const userId = session?.user.id;
  const likedImageIds =
    userId && imageIds.length
      ? new Set(
          (
            await prisma.characterImageLike.findMany({
              where: { userId, characterId: { in: imageIds } },
              select: { characterId: true },
            })
          ).map((like) => like.characterId),
        )
      : new Set<string>();

  return {
    nextOffset: page.nextOffset,
    items: page.items.map((item) => ({
      ...item,
      images: item.images.map((image) => ({
        ...image,
        isLiked: likedImageIds.has(image.id),
      })),
    })),
  };
}

async function getCachedBookCharacters(
  bookId: Book["id"],
  offset: number,
): Promise<{ items: CachedCharacter[]; nextOffset: number | null }> {
  "use cache";
  cacheLife("seconds");

  const characters = await prisma.character.findMany({
    where: { books: { some: { id: bookId } } },
    select: {
      id: true,
      name: true,
      characterDescriptions: {
        where: { bookId },
        select: { tier: true },
        take: 1,
      },
    },
    orderBy: { id: "asc" },
  });

  const tierRank = { MAIN: 0, SECONDARY: 1, MINOR: 2 } as const;
  characters.sort((a, b) => {
    const byTier =
      tierRank[a.characterDescriptions[0]?.tier ?? "MINOR"] -
      tierRank[b.characterDescriptions[0]?.tier ?? "MINOR"];
    if (byTier !== 0) return byTier;
    return a.id.localeCompare(b.id);
  });

  const page = characters.slice(offset, offset + BOOK_CHARACTERS_PAGE_SIZE);
  const imagesPerCharacter = await Promise.all(
    page.map((character) =>
      prisma.generatedCharacterImage.findMany({
        where: { characterId: character.id, bookId },
        take: 3,
        orderBy: [{ likes: { _count: "desc" } }, { createdAt: "desc" }],
        select: {
          blobUrl: true,
          id: true,
          user: {
            select: {
              name: true,
            },
          },
          _count: { select: { likes: true } },
        },
      }),
    ),
  );

  return {
    nextOffset:
      offset + BOOK_CHARACTERS_PAGE_SIZE < characters.length
        ? offset + BOOK_CHARACTERS_PAGE_SIZE
        : null,
    items: page.map((character, index) => ({
      characterId: character.id,
      characterName: character.name,
      images: imagesPerCharacter[index].map((image) => ({
        id: image.id,
        blobUrl: image.blobUrl,
        user: { name: image.user.name },
        likesCount: image._count.likes,
      })),
    })),
  };
}
