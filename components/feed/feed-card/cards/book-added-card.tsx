"use client";

import type { BookAddedFeedItem } from "@/lib/feed/types";
import { BookOpenIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { FeedCardShell } from "./feed-card-shell";

/** Системная карточка: на сайт добавлена новая книга. */
export function BookAddedCard({ item }: { item: BookAddedFeedItem }) {
  const href = `/books/${item.book.id}` as const;

  return (
    <FeedCardShell
      actor={null}
      createdAt={item.createdAt}
      label="New book"
      media={
        <Link
          href={href}
          className="relative -m-3 mr-0 flex w-28 shrink-0 items-center justify-center self-stretch overflow-hidden bg-muted/60 sm:w-32"
        >
          {item.book.thumbnailUrl ? (
            <Image
              src={item.book.thumbnailUrl}
              alt={item.book.title}
              fill
              sizes="auto, 30vw"
              className="object-cover"
            />
          ) : (
            <BookOpenIcon className="size-8 text-muted-foreground" />
          )}
        </Link>
      }
    >
      <Link
        href={href}
        className="line-clamp-1 font-heading text-base font-medium leading-snug transition-colors hover:text-primary"
      >
        {item.book.title}
      </Link>
      <p className="line-clamp-1 text-xs text-muted-foreground">
        {item.book.authors}
      </p>
      {item.excerpt && (
        <p className="line-clamp-3 text-sm text-muted-foreground">
          {item.excerpt}
        </p>
      )}
      <Link
        href={href}
        className="mt-auto text-xs font-medium text-primary transition-colors hover:underline"
      >
        Open the book
      </Link>
    </FeedCardShell>
  );
}
