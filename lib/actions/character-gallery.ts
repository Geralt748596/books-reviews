"use server";

import { getSession } from "@/lib/actions/session";
import prisma from "@/lib/db";
import type { Book, Character } from "@/prisma/generated/client";

const CHARACTER_GALLERY_PAGE_SIZE = 14;

type GetCharacterGalleryImagesParams = {
  bookId: Book["id"];
  characterId: Character["id"];
  offset?: number;
};

export async function getCharacterGalleryImages({
  bookId,
  characterId,
  offset = 0,
}: GetCharacterGalleryImagesParams): Promise<{
  items: {
    id: string;
    blobUrl: string;
    user: {
      id: string;
      name: string;
      image: string | null;
    };
    _count: {
      likes: number;
    };
    isLiked: boolean;
  }[];
  hasMore: boolean;
}> {
  const safeOffset = Math.max(0, offset);
  const rows = await prisma.generatedCharacterImage.findMany({
    where: { bookId, characterId },
    skip: safeOffset,
    take: CHARACTER_GALLERY_PAGE_SIZE + 1,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      blobUrl: true,
      user: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
      _count: { select: { likes: true } },
    },
  });

  const pageRows = rows.slice(0, CHARACTER_GALLERY_PAGE_SIZE);
  const session = await getSession();
  const userId = session?.user.id;
  const likedImageIds =
    userId && pageRows.length
      ? new Set(
          (
            await prisma.characterImageLike.findMany({
              where: {
                userId,
                characterId: { in: pageRows.map((image) => image.id) },
              },
              select: { characterId: true },
            })
          ).map((like) => like.characterId),
        )
      : new Set<string>();

  return {
    items: pageRows.map((image) => ({
      ...image,
      isLiked: likedImageIds.has(image.id),
    })),
    hasMore: rows.length > CHARACTER_GALLERY_PAGE_SIZE,
  };
}
