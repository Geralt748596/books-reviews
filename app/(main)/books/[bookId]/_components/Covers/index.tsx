import { CoversCarousel } from "./components/covers-carousel";
import { Skeleton } from "@/components/ui/skeleton";
import prisma from "@/lib/db";
import { Book } from "@/prisma/generated/client";
import { cacheLife } from "next/cache";

type Props = {
  bookId: Book["id"];
};

export async function BookCovers({ bookId }: Props) {
  const covers = await getBookCovers(bookId);

  return (
    <div className="relative w-full flex justify-center md:justify-end">
      {!covers.length ? (
        <BookCoversSkeleton />
      ) : (
        <CoversCarousel covers={covers} />
      )}
    </div>
  );
}

export function BookCoversSkeleton() {
  return <Skeleton className="w-full h-full max-w-[400px] aspect-2/3" />;
}

async function getBookCovers(bookId: Book["id"]) {
  "use cache";
  cacheLife("minutes");

  return await prisma.generatedBookCover.findMany({
    where: {
      bookId,
    },
    take: 3,
    orderBy: {
      createdAt: "desc",
    },
    select: {
      blobUrl: true,
      id: true,
    },
  });
}
