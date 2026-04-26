import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { TypographyH1, TypographyP } from "@/components/ui/typography";
import { UserAvatar } from "@/components/user-avatar";
import { User } from "@/prisma/generated/browser";
import Image from "next/image";
import { GalleryType } from "@/components/gallery/types";
import { CoverLike } from "@/components/gallery/components/cover-like";
import { CharacterLike } from "@/components/gallery/components/character-like";
import { Suspense, ViewTransition } from "react";
import Link from "next/link";
import {
  GalleryControls,
  GalleryControlsSkeleton,
} from "@/app/(main)/books/[bookId]/_components/filters";
import { ChevronLeftIcon } from "lucide-react";

type GalleryItem = {
  id: string;
  blobUrl: string;
  description?: string;
  user: Pick<User, "id" | "name" | "image">;
  _count?: { likes: number };
  isLiked?: boolean;
};

type Props = {
  items: GalleryItem[];
  title: string;
  type: GalleryType;
  bookId: string;
};

export function Gallery({ items, title, type, bookId }: Props) {
  function renderLikeButton(item: GalleryItem) {
    if (item._count == null) return null;
    if (type === "covers") {
      return (
        <CoverLike
          coverId={item.id}
          liked={item.isLiked ?? false}
          likesCount={item._count.likes}
          bookId={bookId}
        />
      );
    }
    if (type === "characters") {
      return (
        <CharacterLike
          characterId={item.id}
          liked={item.isLiked ?? false}
          likesCount={item._count.likes}
        />
      );
    }
    return null;
  }

  return (
    <div className="w-full">
      <div className="flex justify-between mb-8 flex-col md:flex-row md:items-center flex-wrap gap-4">
        <Link
          href={`/books/${bookId}`}
          transitionTypes={["nav-back"]}
          className="flex items-center gap-2 group"
        >
          <ChevronLeftIcon className="w-6 h-6 text-primary/50 group-hover:text-primary transition-colors" />
          <TypographyH1 className="text-white group-hover:border-primary">
            {title}
          </TypographyH1>
        </Link>
        <div className="self-end-safe md:self-auto">
          <Suspense fallback={<GalleryControlsSkeleton />}>
            <GalleryControls />
          </Suspense>
        </div>
      </div>
      <div className="flex flex-wrap gap-4">
        {items.map((item) => (
          <ViewTransition
            name={`gallery-item-${item.id}`}
            share="morph"
            key={item.id}
          >
            <Card
              className="w-full sm:w-fit p-0 gap-0 overflow-hidden pt-0 group"
              key={item.id}
            >
              <CardContent className="relative aspect-2/3 h-auto sm:h-100 w-full sm:w-66 p-0">
                <Image
                  src={item.blobUrl}
                  alt={item.user.name}
                  fill
                  loading="eager"
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
              </CardContent>
              <CardFooter className="gap-2 bg-background/60 backdrop-blur-md border-t border-border/50 py-4">
                <UserAvatar user={item.user} />
                <TypographyP className="font-medium flex-1 truncate">
                  {item.user.name}
                </TypographyP>
                {renderLikeButton(item)}
              </CardFooter>
            </Card>
          </ViewTransition>
        ))}
      </div>
    </div>
  );
}
