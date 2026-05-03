"use client";

import {
  Comments,
  CommentsCountButton,
} from "@/components/feed/feed-card/components/comments";
import { CommentsProvider } from "@/components/feed/feed-card/context/comments";
import { CharacterLike } from "@/components/gallery/components/character-like";
import { CoverLike } from "@/components/gallery/components/cover-like";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { UserAvatar } from "@/components/user-avatar";
import type { FeedItem } from "@/lib/feed/types";
import { Route } from "next";
import Image from "next/image";
import Link from "next/link";

type Props = {
  item: FeedItem;
};

export function FeedCard({ item }: Props) {
  const itemLabel = item.type === "cover" ? "Cover" : "Character";
  const itemHref = (
    item.type === "cover"
      ? `/books/${item.book.id}/gallery`
      : `/books/${item.book.id}/${item.character.id}`
  ) as Route;
  const createdAt = item.createdAt.slice(0, 10);
  const heading = item.type === "cover" ? item.book.title : item.character.name;

  return (
    <Card className="w-full flex-row gap-3 overflow-hidden p-3">
      <Dialog>
        <DialogTrigger className="relative -m-3 mr-0 block w-28 shrink-0 cursor-zoom-in self-stretch overflow-hidden bg-muted/60 sm:w-32">
          <Image
            src={item.blobUrl}
            alt={heading}
            fill
            sizes="(max-width: 768px) 112px, 128px"
            className="object-cover"
          />
        </DialogTrigger>
        <DialogContent className="max-w-fit border-none bg-transparent p-0 ring-0 shadow-none">
          <DialogTitle className="sr-only">{heading}</DialogTitle>
          <Image
            src={item.blobUrl}
            alt={heading}
            width={768}
            height={768}
            className="max-h-[85vh] w-auto rounded-xl object-contain"
          />
        </DialogContent>
      </Dialog>
      <CommentsProvider item={item}>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <UserAvatar user={item.user} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.user.name}</p>
              <p className="text-xs text-muted-foreground">{createdAt}</p>
            </div>
            <Badge variant="outline" className="text-[10px] uppercase">
              {itemLabel}
            </Badge>
          </div>

          <Link
            href={itemHref}
            className="line-clamp-1 font-heading text-base font-medium leading-snug transition-colors hover:text-primary"
          >
            {heading}
          </Link>
          <Link
            href={`/books/${item.book.id}`}
            className="line-clamp-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {item.book.title} · {item.book.authors}
          </Link>
          <div className="mt-auto flex items-center justify-between">
            <CommentsCountButton />

            {item.type === "cover" ? (
              <CoverLike
                coverId={item.id}
                bookId={item.book.id}
                liked={item.isLiked}
                likesCount={item.likesCount}
              />
            ) : (
              <CharacterLike
                characterId={item.id}
                liked={item.isLiked}
                likesCount={item.likesCount}
              />
            )}
          </div>

          <Comments />
        </div>
      </CommentsProvider>
    </Card>
  );
}
