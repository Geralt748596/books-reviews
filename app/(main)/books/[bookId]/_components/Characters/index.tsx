import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getSession } from "@/lib/actions/session";
import prisma from "@/lib/db";
import { Book } from "@/prisma/generated/client";
import { cacheLife } from "next/cache";
import { cache } from "react";
import { CharacterDeck, CharacterDeckImage } from "./components/character-deck";

type CharacterGroup = {
  characterId: string;
  characterName: string;
  images: CharacterDeckImage[];
};

export async function Characters({ bookId }: { bookId: Book["id"] }) {
  const images = await getBookCharactersImages(bookId);
  if (!images.length) return null;

  const session = await getSession();
  const userId = session?.user.id;

  const likedImageIds = userId
    ? new Set(
        (
          await getLikedCharactersIds(
            userId,
            images.map((i) => i.id),
          )
        ).map((l) => l.characterId),
      )
    : new Set<string>();

  const groups = groupByCharacter(images, likedImageIds);

  return (
    <div className="w-full overflow-x-auto px-4 py-2">
      <div className="flex gap-4 md:min-w-max">
        {groups.map((group) => (
          <div
            key={group.characterId}
            className="shrink-0 w-[90%] md:w-72 lg:w-80"
          >
            <CharacterDeck
              characterName={group.characterName}
              images={group.images}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CharactersSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="w-full overflow-x-auto px-4 py-2">
      <div className="flex gap-4 md:min-w-max">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="shrink-0 w-[90%] md:w-72 lg:w-80">
            <div className="flex flex-col gap-4 h-full w-full">
              <div className="relative w-full aspect-2/3 px-6 pt-4 pb-2">
                <Skeleton className="absolute inset-x-6 inset-y-4 rounded-lg" />
              </div>
              <Card className="flex-1">
                <CardHeader className="gap-2">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
              </Card>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function groupByCharacter(
  images: Awaited<ReturnType<typeof getBookCharactersImages>>,
  likedImageIds: Set<string>,
): CharacterGroup[] {
  const byCharacter = new Map<string, CharacterGroup>();

  for (const img of images) {
    const key = img.character.id;
    let group = byCharacter.get(key);
    if (!group) {
      group = {
        characterId: key,
        characterName: img.character.name,
        images: [],
      };
      byCharacter.set(key, group);
    }
    group.images.push({
      id: img.id,
      blobUrl: img.blobUrl,
      user: { name: img.user.name },
      likesCount: img._count.likes,
      isLiked: likedImageIds.has(img.id),
    });
  }

  return Array.from(byCharacter.values());
}

const getLikedCharactersIds = cache(
  async (userId: string, characterIds: string[]) => {
    return await prisma.characterImageLike.findMany({
      where: { userId, characterId: { in: characterIds } },
      select: { characterId: true },
    });
  },
);

async function getBookCharactersImages(bookId: Book["id"]) {
  "use cache";
  cacheLife("seconds");

  const characters = await prisma.character.findMany({
    where: { books: { some: { id: bookId } } },
    select: { id: true },
    orderBy: { id: "asc" },
  });

  const imagesPerCharacter = await Promise.all(
    characters.map((c) =>
      prisma.generatedCharacterImage.findMany({
        where: { characterId: c.id, bookId },
        take: 3,
        orderBy: [{ likes: { _count: "desc" } }, { createdAt: "desc" }],
        select: {
          blobUrl: true,
          id: true,
          user: {
            select: {
              name: true,
              image: true,
            },
          },
          _count: { select: { likes: true } },
          character: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ),
  );

  return imagesPerCharacter.flat();
}
