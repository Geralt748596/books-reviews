"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { updateTag } from "next/cache";
import { HOME_FEED_TAG } from "@/lib/feed/tags";
import { recordPostAdded } from "@/lib/feed/write";

const ALLOWED_COMMENT_TAGS = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "s",
  "strike",
  "code",
  "pre",
  "blockquote",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "hr",
]);

function commentPlainText(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeCommentHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(
      /<\/?([a-z0-9-]+)(\s[^>]*)?>/gi,
      (match, tag: string, rawAttrs = "") => {
        const name = tag.toLowerCase();
        if (match.startsWith("</")) {
          if (name === "span" || ALLOWED_COMMENT_TAGS.has(name)) {
            return `</${name}>`;
          }
          return "";
        }
        if (name === "span") return sanitizeMentionTag(rawAttrs);
        if (!ALLOWED_COMMENT_TAGS.has(name)) return "";
        if (name === "br" || name === "hr") return `<${name}>`;
        return `<${name}>`;
      },
    );
}

function sanitizeMentionTag(rawAttrs: string) {
  if (!/data-type\s*=\s*"mention"/i.test(rawAttrs)) return "";
  const id = attrValue(rawAttrs, "data-id");
  const label = attrValue(rawAttrs, "data-label");
  if (!id) return "";
  return `<span data-type="mention" data-id="${id}" data-label="${label}" data-mention-suggestion-char="@">`;
}

function attrValue(rawAttrs: string, name: string) {
  const match = rawAttrs.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i"));
  return (match?.[1] ?? "").replace(/[<>"']/g, "");
}

const CreatePostSchema = z.object({
  content: z
    .string()
    .max(8000)
    .transform(sanitizeCommentHtml)
    .refine((value) => {
      const length = commentPlainText(value).length;
      return length >= 1 && length <= 2000;
    }, "Write a comment up to 2000 characters"),
  bookId: z.string().min(1, "Book is required"),
  characterId: z.string().optional(),
});

export type CreatePostInput = z.infer<typeof CreatePostSchema>;

export type DiscussionPost = {
  id: string;
  content: string;
  createdAt: string;
  character: { id: string; name: string } | null;
  user: { name: string; image: string | null };
};

export async function getDiscussionPosts(
  bookId: string,
  characterId?: string,
): Promise<DiscussionPost[]> {
  const posts = await prisma.post.findMany({
    where: {
      bookId,
      ...(characterId ? { characterId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      content: true,
      createdAt: true,
      character: { select: { id: true, name: true } },
      user: { select: { name: true, image: true } },
    },
  });

  return posts.map((post) => ({
    ...post,
    createdAt: post.createdAt.toISOString(),
  }));
}

export async function createPost(
  data: CreatePostInput,
): Promise<{ postId: string } | { error: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Unauthorized" };

  const parsed = CreatePostSchema.safeParse(data);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid data";
    return { error: msg };
  }

  const book = await prisma.book.findUnique({
    where: { id: parsed.data.bookId },
  });
  if (!book) return { error: "Book not found" };

  if (parsed.data.characterId) {
    const character = await prisma.character.findFirst({
      where: {
        id: parsed.data.characterId,
        books: { some: { id: parsed.data.bookId } },
      },
    });
    if (!character) return { error: "Character not found for this book" };
  }

  try {
    const post = await prisma.$transaction(async (tx) => {
      const created = await tx.post.create({
        data: {
          content: parsed.data.content,
          userId: session.user.id,
          bookId: parsed.data.bookId,
          characterId: parsed.data.characterId || null,
        },
      });
      await recordPostAdded(tx, created);
      return created;
    });

    updateTag(HOME_FEED_TAG);
    return { postId: post.id };
  } catch {
    return { error: "Failed to create post" };
  }
}
