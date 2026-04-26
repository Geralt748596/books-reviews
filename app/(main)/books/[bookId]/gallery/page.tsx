import { Gallery } from "@/components/gallery";
import { GalleryType } from "@/components/gallery/types";
import { Skeleton } from "@/components/ui/skeleton";
import { getSession } from "@/lib/actions/session";
import prisma from "@/lib/db";
import { Book } from "@/prisma/generated/client";
import { cache, Suspense } from "react";

type SortKey = "popular" | "recent";

export default function BookCoversPage({
  params,
  searchParams,
}: PageProps<"/books/[bookId]/gallery">) {
  return (
    <main className="relative">
      <Suspense fallback={<Skeleton className="h-60 w-full" />}>
        <BookCoversContent params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function BookCoversContent({
  params,
  searchParams,
}: PageProps<"/books/[bookId]/gallery">) {
  const [{ bookId }, { sort, type }] = await Promise.all([
    params,
    searchParams,
  ]);
  const galleryType: GalleryType =
    type === "characters" ? "characters" : "covers";
  const sortKey: SortKey = sort === "recent" ? "recent" : "popular";

  const [book, session, rows] = await Promise.all([
    prisma.book.findUnique({
      where: { id: bookId },
      select: { title: true },
    }),
    getSession(),
    getItems(bookId, galleryType, sortKey),
  ]);

  if (!book) {
    return (
      <section className="relative">
        <p className="text-muted-foreground">Book not found.</p>
      </section>
    );
  }

  if (!rows.length) {
    return (
      <section className="relative">
        <p className="text-muted-foreground">
          {galleryType === "characters"
            ? "No character images found for this book."
            : "No covers found for this book."}
        </p>
      </section>
    );
  }

  const userId = session?.user.id;
  const likedIds = userId
    ? await getLikes(
        userId,
        galleryType,
        rows.map((r) => r.id),
      )
    : new Set<string>();

  const items = rows.map((row) => ({
    ...row,
    isLiked: likedIds.has(row.id),
  }));

  return (
    <Gallery
      items={items}
      title={book.title}
      type={galleryType}
      bookId={bookId}
    />
  );
}

async function getItems(bookId: Book["id"], type: GalleryType, sort: SortKey) {
  if (type === "characters") {
    return getBookCharacterImages(bookId, sort);
  }
  return getBookCovers(bookId, sort);
}

async function getLikes(
  userId: string,
  type: GalleryType,
  itemIds: string[],
): Promise<Set<string>> {
  if (type === "characters") {
    const rows = await getLikedCharacterImageIds(userId, itemIds);
    return new Set(rows.map((l) => l.characterId));
  }
  const rows = await getLikedCoverIds(userId, itemIds);
  return new Set(rows.map((l) => l.coverId));
}

const getLikedCoverIds = cache(async (userId: string, coverIds: string[]) => {
  return await prisma.coverLike.findMany({
    where: { userId, coverId: { in: coverIds } },
    select: { coverId: true },
  });
});

const getLikedCharacterImageIds = cache(
  async (userId: string, characterImageIds: string[]) => {
    return await prisma.characterImageLike.findMany({
      where: { userId, characterId: { in: characterImageIds } },
      select: { characterId: true },
    });
  },
);

const getBookCovers = cache(async (bookId: Book["id"], sort: SortKey) => {
  return await prisma.generatedBookCover.findMany({
    where: { bookId },
    take: 10,
    orderBy:
      sort === "popular"
        ? { likes: { _count: "desc" } }
        : { createdAt: "desc" },
    select: {
      blobUrl: true,
      id: true,
      _count: { select: { likes: true } },
      book: { select: { id: true, title: true } },
      user: { select: { id: true, name: true, image: true } },
    },
  });
});

const getBookCharacterImages = cache(
  async (bookId: Book["id"], sort: SortKey) => {
    return await prisma.generatedCharacterImage.findMany({
      where: { character: { books: { some: { id: bookId } } } },
      take: 10,
      orderBy:
        sort === "popular"
          ? { likes: { _count: "desc" } }
          : { createdAt: "desc" },
      select: {
        blobUrl: true,
        id: true,
        _count: { select: { likes: true } },
        user: { select: { id: true, name: true, image: true } },
        character: { select: { id: true, name: true } },
      },
    });
  },
);
