import type { FeedItemType } from "@/prisma/generated/client";
import type { FeedComment, FeedItem, FeedUser, ImagePayload } from "./types";

const EXCERPT_LENGTH = 240;

/** Форма строки FeedItem с нужными связями; совпадает с select в queries.ts. */
export interface FeedRow {
  id: string;
  type: FeedItemType;
  createdAt: Date;
  actor: FeedUser | null;
  book: {
    id: string;
    title: string;
    authors: string;
    thumbnailUrl: string | null;
    description: string | null;
  };
  cover: ImageRow | null;
  characterImage:
    (ImageRow & { character: { id: string; name: string } }) | null;
  post: {
    id: string;
    content: string;
    character: { id: string; name: string } | null;
  } | null;
}

interface ImageRow {
  id: string;
  blobUrl: string;
  _count: { likes: number; comments: number };
  comments: FeedComment[];
}

/** Строка без payload (не должно случаться) даёт null и пропускается. */
export function mapFeedRow(row: FeedRow): FeedItem | null {
  const base = {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    actor: row.actor,
    book: {
      id: row.book.id,
      title: row.book.title,
      authors: row.book.authors,
      thumbnailUrl: row.book.thumbnailUrl,
    },
  };

  switch (row.type) {
    case "COVER":
      if (!row.cover) return null;
      return { ...base, kind: "cover", cover: imagePayload(row.cover) };
    case "CHARACTER_IMAGE":
      if (!row.characterImage) return null;
      return {
        ...base,
        kind: "character_image",
        image: {
          ...imagePayload(row.characterImage),
          character: row.characterImage.character,
        },
      };
    case "BOOK_ADDED":
      return {
        ...base,
        kind: "book_added",
        excerpt: excerpt(row.book.description),
      };
    case "POST":
      if (!row.post) return null;
      return {
        ...base,
        kind: "post",
        post: {
          id: row.post.id,
          contentHtml: row.post.content,
          character: row.post.character,
        },
      };
    default:
      return null;
  }
}

function imagePayload(image: ImageRow): ImagePayload {
  return {
    id: image.id,
    blobUrl: image.blobUrl,
    likesCount: image._count.likes,
    isLiked: false,
    commentsCount: image._count.comments,
    lastComment: image.comments[0] ?? null,
  };
}

export function excerpt(text: string | null | undefined): string | null {
  const trimmed = text?.trim() ?? "";
  if (!trimmed) return null;
  if (trimmed.length <= EXCERPT_LENGTH) return trimmed;
  const cut = trimmed.slice(0, EXCERPT_LENGTH);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > EXCERPT_LENGTH / 2 ? lastSpace : EXCERPT_LENGTH).trimEnd()}…`;
}
