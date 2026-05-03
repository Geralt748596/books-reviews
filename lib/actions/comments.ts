"use server";

import { getSessionOrThrow } from "@/lib/actions/session";
import prisma from "@/lib/db";
import type { FeedItemType } from "@/lib/feed/types";

const MAX_COMMENT_LENGTH = 500;
const COMMENTS_PAGE_SIZE = 10;

export type PaginatedComment = {
  id: string;
  content: string;
  createdAt: string;
  user: { name: string; image: string | null };
};

export async function getComments(
  targetId: string,
  type: FeedItemType,
  cursor?: string,
) {
  const where =
    type === "cover" ? { coverId: targetId } : { characterImageId: targetId };

  const model =
    type === "cover" ? prisma.coverComment : prisma.characterImageComment;

  const comments = await (model as typeof prisma.coverComment).findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: COMMENTS_PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      content: true,
      createdAt: true,
      user: { select: { name: true, image: true } },
    },
  });

  const hasMore = comments.length > COMMENTS_PAGE_SIZE;
  const items: PaginatedComment[] = (hasMore ? comments.slice(0, -1) : comments).map(
    (c) => ({ ...c, createdAt: c.createdAt.toISOString() }),
  );

  return {
    items,
    nextCursor: hasMore ? items[items.length - 1].id : null,
  };
}

export async function addCoverComment(coverId: string, content: string) {
  const session = await getSessionOrThrow();
  const trimmed = content.trim();

  if (!trimmed || trimmed.length > MAX_COMMENT_LENGTH) {
    throw new Error("Comment must be between 1 and 500 characters.");
  }

  const comment = await prisma.coverComment.create({
    data: {
      content: trimmed,
      userId: session.user.id,
      coverId,
    },
    select: {
      content: true,
      user: { select: { name: true, image: true } },
    },
  });

  return comment;
}

export async function addCharacterImageComment(
  characterImageId: string,
  content: string,
) {
  const session = await getSessionOrThrow();
  const trimmed = content.trim();

  if (!trimmed || trimmed.length > MAX_COMMENT_LENGTH) {
    throw new Error("Comment must be between 1 and 500 characters.");
  }

  const comment = await prisma.characterImageComment.create({
    data: {
      content: trimmed,
      userId: session.user.id,
      characterImageId,
    },
    select: {
      content: true,
      user: { select: { name: true, image: true } },
    },
  });

  return comment;
}
