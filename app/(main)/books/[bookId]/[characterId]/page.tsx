import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getSession } from "@/lib/actions/session";
import prisma from "@/lib/db";
import type { Book, Character } from "@/prisma/generated/client";
import { ArrowLeftIcon } from "lucide-react";
import { cacheLife } from "next/cache";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache, Suspense } from "react";
import {
  CharacterImageGallery,
  CharacterImageGallerySkeleton,
} from "./_components/character-image-gallery";
import {
  CharacterDeck,
  type CharacterDeckImage,
} from "../_components/Characters/components/character-deck";

export default function CharacterPage({
  params,
}: PageProps<"/books/[bookId]/[characterId]">) {
  return (
    <Suspense fallback={<Skeleton className="h-full w-full" />}>
      <CharacterContent params={params} />
    </Suspense>
  );
}

async function CharacterContent({
  params,
}: Pick<PageProps<"/books/[bookId]/[characterId]">, "params">) {
  const { bookId, characterId } = await params;
  const character = await getBookCharacter(bookId, characterId);

  if (!character) return notFound();

  const description = character.characterDescriptions[0]?.description;
  const book = character.books[0];

  return (
    <div className="flex flex-col gap-y-6 lg:gap-y-12">
      <section className="grid grid-cols-12 grid-rows-[auto_auto_auto] md:grid-rows-[auto_auto] gap-y-4 gap-x-6 items-start">
        <div className="w-full row-start-2 row-span-1 md:row-start-1 md:row-span-2 col-start-1 col-span-12 md:col-span-5 flex justify-center md:justify-end self-center-safe">
          <div className="w-full max-w-xs md:max-w-sm">
            <Suspense fallback={<TopCharacterDeckSkeleton />}>
              <TopCharacterDeck
                bookId={bookId}
                characterId={characterId}
                characterName={character.name}
              />
            </Suspense>
          </div>
        </div>

        <div className="row-start-1 row-span-1 col-start-1 col-span-12 md:col-start-6 md:col-span-7 md:row-start-1 pt-4">
          <div className="flex items-center gap-3 mb-6">
            <Badge
              variant="secondary"
              className="text-xs font-bold tracking-[0.2em] text-primary uppercase bg-primary/10 px-3 py-1 rounded-full border border-primary/20"
            >
              Character
            </Badge>
            {book ? (
              <span className="text-xs font-medium text-muted-foreground">
                from {book.title}
              </span>
            ) : null}
          </div>

          {book ? (
            <p className="text-lg text-muted-foreground font-serif italic max-w-xl">
              {book.authors}
            </p>
          ) : null}
          <h1 className="text-6xl md:text-7xl font-serif font-bold text-foreground mb-4 leading-tight">
            {character.name}
          </h1>
          <Link href={`/books/${bookId}`} className="inline-flex">
            <Button variant="outline" size="lg">
              <ArrowLeftIcon className="w-8 h-8" />
              Back to Book
            </Button>
          </Link>
        </div>

        <div className="row-start-3 md:row-start-2 col-span-12 md:col-start-6 md:col-span-7 bg-muted/30 p-8 rounded-xl border border-border/50 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors" />
          <h3 className="text-xs font-bold tracking-[0.1em] text-primary uppercase mb-4">
            Character Description
          </h3>
          <p className="text-muted-foreground leading-relaxed font-sans text-lg italic">
            {description || "No description available for this character."}
          </p>
        </div>
      </section>

      <section className="border-t border-border/50 pt-16">
        <Suspense fallback={<OtherBooksWithCharacterSkeleton />}>
          <OtherBooksWithCharacter
            bookId={bookId}
            characterId={characterId}
            characterName={character.name}
          />
        </Suspense>
      </section>

      <section className="mb-24 border-t border-border/50 pt-16">
        <Suspense fallback={<CharacterImageGallerySkeleton />}>
          <CharacterImageGallery
            bookId={bookId}
            characterId={characterId}
            characterName={character.name}
          />
        </Suspense>
      </section>
    </div>
  );
}

async function TopCharacterDeck({
  bookId,
  characterId,
  characterName,
}: {
  bookId: Book["id"];
  characterId: Character["id"];
  characterName: Character["name"];
}) {
  const [images, session] = await Promise.all([
    getTopCharacterImages(bookId, characterId),
    getSession(),
  ]);
  const userId = session?.user.id;
  const likedImageIds =
    userId && images.length
      ? new Set(
          (
            await getLikedCharacterImageIds(
              userId,
              images.map((image) => image.id),
            )
          ).map((like) => like.characterId),
        )
      : new Set<string>();

  const deckImages: CharacterDeckImage[] = images.map((image) => ({
    id: image.id,
    blobUrl: image.blobUrl,
    user: { name: image.user.name },
    likesCount: image._count.likes,
    isLiked: likedImageIds.has(image.id),
  }));

  if (!deckImages.length) {
    return (
      <div className="flex aspect-2/3 items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/30 p-8 text-center text-muted-foreground">
        No generated images for this character yet.
      </div>
    );
  }

  return (
    <CharacterDeck
      key={characterId}
      characterName={characterName}
      images={deckImages}
    />
  );
}

function TopCharacterDeckSkeleton() {
  return (
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
  );
}

async function OtherBooksWithCharacter({
  bookId,
  characterId,
  characterName,
}: {
  bookId: Book["id"];
  characterId: Character["id"];
  characterName: Character["name"];
}) {
  const books = await getOtherBooksWithCharacter(bookId, characterId);

  return (
    <div className="w-full">
      <div className="mb-8 flex flex-col gap-2">
        <p className="text-xs font-bold tracking-[0.2em] text-primary uppercase">
          Other Books
        </p>
        <h2 className="text-3xl font-serif font-bold text-foreground">
          Where Else {characterName} Appears
        </h2>
        <p className="text-muted-foreground">
          This is the same character shared across books, with descriptions kept
          per book.
        </p>
      </div>

      {books.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {books.map((book) => {
            const description = book.characterDescriptions[0]?.description;

            return (
              <Link
                key={book.id}
                href={`/books/${book.id}`}
                className="block h-full"
              >
                <Card className="h-full flex-row gap-4 p-3 transition-colors hover:bg-muted/50">
                  <CardContent className="p-0">
                    <div className="relative aspect-3/4 w-20 overflow-hidden rounded-md bg-muted">
                      {book.thumbnailUrl ? (
                        <Image
                          src={book.thumbnailUrl}
                          alt={book.title}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                          No cover
                        </div>
                      )}
                    </div>
                  </CardContent>
                  <CardHeader className="min-w-0 flex-1 p-0">
                    {book.bookSeries ? (
                      <Badge variant="outline" className="mb-1 w-fit">
                        {book.bookSeries.name}
                      </Badge>
                    ) : null}
                    <CardTitle className="line-clamp-2">{book.title}</CardTitle>
                    <CardDescription className="line-clamp-1">
                      {book.authors}
                    </CardDescription>
                    {description ? (
                      <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                        {description}
                      </p>
                    ) : null}
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border/70 bg-muted/30 p-8 text-center text-muted-foreground">
          No other books with this character yet.
        </div>
      )}
    </div>
  );
}

function OtherBooksWithCharacterSkeleton() {
  return (
    <div className="w-full">
      <div className="mb-8 flex flex-col gap-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-9 w-80 max-w-full" />
        <Skeleton className="h-5 w-lg max-w-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card className="h-full flex-row gap-4 p-3" key={index}>
            <CardContent className="p-0">
              <Skeleton className="aspect-3/4 w-20 rounded-md" />
            </CardContent>
            <CardHeader className="min-w-0 flex-1 p-0">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}

async function getBookCharacter(
  bookId: Book["id"],
  characterId: Character["id"],
) {
  "use cache";
  cacheLife("minutes");

  return await prisma.character.findFirst({
    where: {
      id: characterId,
      books: { some: { id: bookId } },
    },
    select: {
      id: true,
      name: true,
      books: {
        where: { id: bookId },
        take: 1,
        select: {
          id: true,
          title: true,
          authors: true,
        },
      },
      characterDescriptions: {
        where: { bookId },
        take: 1,
        select: {
          description: true,
        },
      },
    },
  });
}

async function getTopCharacterImages(
  bookId: Book["id"],
  characterId: Character["id"],
) {
  "use cache";
  cacheLife("seconds");

  return await prisma.generatedCharacterImage.findMany({
    where: { bookId, characterId },
    take: 3,
    orderBy: [{ likes: { _count: "desc" } }, { createdAt: "desc" }],
    select: {
      id: true,
      blobUrl: true,
      user: {
        select: {
          name: true,
        },
      },
      _count: { select: { likes: true } },
    },
  });
}

async function getOtherBooksWithCharacter(
  bookId: Book["id"],
  characterId: Character["id"],
) {
  "use cache";
  cacheLife("minutes");

  return await prisma.book.findMany({
    where: {
      id: { not: bookId },
      characters: { some: { id: characterId } },
    },
    orderBy: [{ publishedDate: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      authors: true,
      thumbnailUrl: true,
      publishedDate: true,
      bookSeries: {
        select: {
          name: true,
        },
      },
      characterDescriptions: {
        where: { characterId },
        take: 1,
        select: {
          description: true,
        },
      },
    },
  });
}

const getLikedCharacterImageIds = cache(
  async (userId: string, characterImageIds: string[]) => {
    return await prisma.characterImageLike.findMany({
      where: { userId, characterId: { in: characterImageIds } },
      select: { characterId: true },
    });
  },
);
