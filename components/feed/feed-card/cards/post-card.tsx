"use client";

import { renderCommentHtml } from "@/components/comment-composer/render-comment-html";
import type { PostFeedItem } from "@/lib/feed/types";
import { Route } from "next";
import Link from "next/link";
import { FeedCardShell } from "./feed-card-shell";

/** Отзыв пользователя (Post) о книге или персонаже. */
export function PostCard({ item }: { item: PostFeedItem }) {
  const character = item.post.character;
  const href = (
    character
      ? `/books/${item.book.id}/${character.id}`
      : `/books/${item.book.id}`
  ) as Route;
  const html = item.post.contentHtml;

  return (
    <FeedCardShell actor={item.actor} createdAt={item.createdAt} label="Review">
      <Link
        href={href}
        className="line-clamp-1 font-heading text-base font-medium leading-snug transition-colors hover:text-primary"
      >
        {character ? `${character.name} · ${item.book.title}` : item.book.title}
      </Link>
      <Link
        href={`/books/${item.book.id}`}
        className="line-clamp-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        {item.book.title} · {item.book.authors}
      </Link>
      <div className="line-clamp-4 text-sm text-muted-foreground">
        {html.trimStart().startsWith("<") ? (
          renderCommentHtml(html, item.book.id)
        ) : (
          <p className="whitespace-pre-wrap">{html}</p>
        )}
      </div>
      <Link
        href={href}
        className="mt-auto text-xs font-medium text-primary transition-colors hover:underline"
      >
        Join the discussion
      </Link>
    </FeedCardShell>
  );
}
