"use client";

import portraitPlaceholder from "@/assets/placeholders/portret.png";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getBookCharactersImages,
  type BookCharacterCard,
} from "@/lib/actions/book-characters";
import type { Book } from "@/prisma/generated/client";
import { ChevronRight, GalleryHorizontal, List } from "lucide-react";
import { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type Ref } from "react";
import { toast } from "sonner";
import {
  CharacterCardSkeleton,
  CharacterListRowSkeleton,
} from "./character-card-skeleton";
import { CharacterDeck } from "./character-deck";
import { GenerateCharacterDialog } from "@/components/generate-character";

const LOADING_SKELETON_COUNT = 5;

type View = "deck" | "list";

type Props = {
  bookId: Book["id"];
  initialItems: BookCharacterCard[];
  initialNextOffset: number | null;
};

function characterHref(bookId: Book["id"], characterId: string) {
  return `/books/${bookId}/${characterId}` as Route<"/books/[bookId]/[characterId]">;
}

export function CharactersList({
  bookId,
  initialItems,
  initialNextOffset,
}: Props) {
  const [items, setItems] = useState(initialItems);
  const [nextOffset, setNextOffset] = useState(initialNextOffset);
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<View>("deck");
  const deckScrollerRef = useRef<HTMLDivElement>(null);
  const deckSentinelRef = useRef<HTMLDivElement>(null);
  const listSentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || nextOffset === null) return;

    loadingRef.current = true;
    setIsLoading(true);
    try {
      const page = await getBookCharactersImages(bookId, nextOffset);
      setItems((prev) => [...prev, ...page.items]);
      setNextOffset(page.nextOffset);
    } catch {
      toast.error("Failed to load more characters.");
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
    }
  }, [bookId, nextOffset]);

  useEffect(() => {
    const sentinel =
      view === "deck" ? deckSentinelRef.current : listSentinelRef.current;
    const root = view === "deck" ? deckScrollerRef.current : null;
    if (!sentinel || nextOffset === null) return;
    if (view === "deck" && !root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMore();
        }
      },
      view === "deck"
        ? { root, rootMargin: "0px 160px 0px 0px" }
        : { rootMargin: "0px 0px 240px 0px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, nextOffset, view]);

  return (
    <Tabs
      value={view}
      onValueChange={(value) => setView(value as View)}
      className="w-full"
    >
      <div className="flex items-center gap-2 justify-end">
        <GenerateCharacterDialog bookId={bookId} size="default" />
        <TabsList className="mx-4 m-0">
          <TabsTrigger size="icon" value="deck" aria-label="Deck">
            <GalleryHorizontal />
          </TabsTrigger>
          <TabsTrigger size="icon" value="list" aria-label="List">
            <List />
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="deck">
        <div ref={deckScrollerRef} className="w-full overflow-x-auto px-4 py-2">
          <div className="flex gap-4 md:min-w-max">
            {items.map((group, index) => (
              <div
                key={group.characterId}
                ref={index === items.length - 1 ? deckSentinelRef : undefined}
                className="w-[90%] shrink-0 md:w-72 lg:w-80"
              >
                <CharacterDeck
                  characterName={group.characterName}
                  images={group.images}
                  href={characterHref(bookId, group.characterId)}
                />
              </div>
            ))}
            {isLoading && view === "deck"
              ? Array.from({ length: LOADING_SKELETON_COUNT }, (_, index) => (
                  <CharacterCardSkeleton key={`loading-${index}`} />
                ))
              : null}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="list">
        <div className="flex flex-col gap-3 px-4 py-2">
          {items.map((group, index) => (
            <CharacterListRow
              key={group.characterId}
              ref={index === items.length - 1 ? listSentinelRef : undefined}
              group={group}
              href={characterHref(bookId, group.characterId)}
            />
          ))}
          {isLoading && view === "list"
            ? Array.from({ length: LOADING_SKELETON_COUNT }, (_, index) => (
                <CharacterListRowSkeleton key={`loading-${index}`} />
              ))
            : null}
        </div>
      </TabsContent>
    </Tabs>
  );
}

function CharacterListRow({
  group,
  href,
  ref,
}: {
  group: BookCharacterCard;
  href: Route<"/books/[bookId]/[characterId]">;
  ref?: Ref<HTMLDivElement>;
}) {
  const image = group.images[0];

  return (
    <div ref={ref} className="flex items-center gap-4">
      <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
        <Image
          src={image?.blobUrl ?? portraitPlaceholder}
          alt={group.characterName}
          fill
          sizes="56px"
          className="object-cover"
        />
      </div>
      <p className="min-w-0 flex-1 truncate font-medium">
        {group.characterName}
      </p>
      <Link
        href={href}
        aria-label={`Show more about ${group.characterName}`}
        className={buttonVariants({ variant: "ghost", size: "icon" })}
      >
        <ChevronRight />
      </Link>
    </div>
  );
}
