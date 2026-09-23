"use client";

import {
  Comments,
  CommentsCountButton,
} from "@/components/feed/feed-card/components/comments";
import { CommentsProvider } from "@/components/feed/feed-card/context/comments";
import { CharacterLike } from "@/components/gallery/components/character-like";
import { CoverLike } from "@/components/gallery/components/cover-like";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { CharacterImageFeedItem, CoverFeedItem } from "@/lib/feed/types";
import { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { FeedCardShell } from "./feed-card-shell";

type Props = { item: CoverFeedItem | CharacterImageFeedItem };

/** Обложка книги или картинка персонажа: зум, лайк, комментарии. */
export function ImageCard({ item }: Props) {
  const isCover = item.kind === "cover";
  const image = isCover ? item.cover : item.image;
  const heading = isCover ? item.book.title : item.image.character.name;
  const href = (
    isCover
      ? `/books/${item.book.id}/gallery`
      : `/books/${item.book.id}/${item.image.character.id}`
  ) as Route;

  return (
    <FeedCardShell
      actor={item.actor}
      createdAt={item.createdAt}
      label={isCover ? "Cover" : "Character"}
      media={
        <Dialog>
          <DialogTrigger className="relative -m-3 mr-0 block w-28 shrink-0 cursor-zoom-in self-stretch overflow-hidden bg-muted/60 sm:w-32">
            <Image
              src={image.blobUrl}
              alt={heading}
              fill
              sizes="auto, 30vw"
              className="object-cover"
            />
          </DialogTrigger>
          <DialogContent className="max-w-fit border-none bg-transparent p-0 ring-0 shadow-none">
            <DialogTitle className="sr-only">{heading}</DialogTitle>
            <Image
              src={image.blobUrl}
              alt={heading}
              width={768}
              height={768}
              className="max-h-[85vh] w-auto rounded-xl object-contain"
            />
          </DialogContent>
        </Dialog>
      }
    >
      <CommentsProvider
        targetId={image.id}
        targetType={isCover ? "cover" : "character"}
        commentsCount={image.commentsCount}
        lastComment={image.lastComment}
      >
        <Link
          href={href}
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
          {isCover ? (
            <CoverLike
              coverId={image.id}
              bookId={item.book.id}
              liked={image.isLiked}
              likesCount={image.likesCount}
            />
          ) : (
            <CharacterLike
              characterId={image.id}
              liked={image.isLiked}
              likesCount={image.likesCount}
            />
          )}
        </div>
        <Comments />
      </CommentsProvider>
    </FeedCardShell>
  );
}
