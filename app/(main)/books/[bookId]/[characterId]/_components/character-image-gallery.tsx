"use client";

import { CharacterLike } from "@/components/gallery/components/character-like";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TypographyH2, TypographyP } from "@/components/ui/typography";
import { UserAvatar } from "@/components/user-avatar";
import { getCharacterGalleryImages } from "@/lib/actions/character-gallery";
import type { Book, Character } from "@/prisma/generated/client";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

const CHARACTER_GALLERY_PAGE_SIZE = 14;

type CharacterGalleryImage = Awaited<
  ReturnType<typeof getCharacterGalleryImages>
>["items"][number];

type Props = {
  bookId: Book["id"];
  characterId: Character["id"];
  characterName: Character["name"];
};

export function CharacterImageGallery({
  bookId,
  characterId,
  characterName,
}: Props) {
  const [items, setItems] = useState<CharacterGalleryImage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(
    async (offset: number) => {
      const page = await getCharacterGalleryImages({
        bookId,
        characterId,
        offset,
      });

      setItems((prev) =>
        offset === 0 ? page.items : [...prev, ...page.items],
      );
      setHasMore(page.hasMore);
      setError(null);
    },
    [bookId, characterId],
  );

  useEffect(() => {
    let ignore = false;

    async function initialize() {
      setIsInitialized(false);
      setItems([]);
      setHasMore(false);
      setError(null);

      try {
        const page = await getCharacterGalleryImages({
          bookId,
          characterId,
          offset: 0,
        });

        if (ignore) return;
        setItems(page.items);
        setHasMore(page.hasMore);
      } catch {
        if (ignore) return;
        setError("Failed to load character images.");
      } finally {
        if (!ignore) setIsInitialized(true);
      }
    }

    initialize();

    return () => {
      ignore = true;
    };
  }, [bookId, characterId]);

  const handleLoadMore = async () => {
    setIsLoadingMore(true);
    try {
      await loadPage(items.length);
    } catch {
      setError("Failed to load more images.");
    } finally {
      setIsLoadingMore(false);
    }
  };

  if (!isInitialized) {
    return <CharacterImageGallerySkeleton />;
  }

  return (
    <div className="w-full">
      <div className="mb-8 flex flex-col gap-2">
        <p className="text-xs font-bold tracking-[0.2em] text-primary uppercase">
          Gallery
        </p>
        <TypographyH2>All {characterName} Images</TypographyH2>
        <TypographyP className="text-muted-foreground">
          Generated images for this character in this book.
        </TypographyP>
      </div>

      {error ? (
        <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {items.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {items.map((item, index) => (
            <Card
              className="gap-0 overflow-hidden p-0 pt-0 group"
              key={item.id}
            >
              <CardContent className="relative aspect-2/3 w-full p-0">
                <Image
                  src={item.blobUrl}
                  alt={characterName}
                  fill
                  loading={
                    index < CHARACTER_GALLERY_PAGE_SIZE ? "eager" : "lazy"
                  }
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 25vw, 14vw"
                />
              </CardContent>
              <CardFooter className="gap-2 bg-background/60 py-4 backdrop-blur-md border-t border-border/50">
                <UserAvatar user={item.user} />
                <TypographyP className="flex-1 truncate font-medium">
                  {item.user.name}
                </TypographyP>
                <CharacterLike
                  characterId={item.id}
                  liked={item.isLiked}
                  likesCount={item._count.likes}
                />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border/70 bg-muted/30 p-8 text-center text-muted-foreground">
          No generated images for this character yet.
        </div>
      )}

      {hasMore ? (
        <div className="mt-10 flex justify-center">
          <Button
            type="button"
            size="lg"
            variant="outline"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? "Loading..." : "Load more"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function CharacterImageGallerySkeleton() {
  return (
    <div className="w-full">
      <div className="mb-8 flex flex-col gap-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {Array.from({ length: CHARACTER_GALLERY_PAGE_SIZE }).map((_, index) => (
          <Card className="gap-0 overflow-hidden p-0 pt-0" key={index}>
            <CardContent className="relative aspect-2/3 w-full p-0">
              <Skeleton className="absolute inset-0 rounded-none" />
            </CardContent>
            <CardFooter className="gap-2 py-4">
              <Skeleton className="size-10 rounded-full" />
              <Skeleton className="h-5 flex-1" />
              <Skeleton className="h-8 w-12" />
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
