"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const CreatePostSchema = z.object({
  content: z.string().min(1, "Content is required").max(2000),
  bookId: z.string().min(1, "Book is required"),
  characterId: z.string().optional(),
});

export type CreatePostInput = z.infer<typeof CreatePostSchema>;

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
    const post = await prisma.post.create({
      data: {
        content: parsed.data.content,
        userId: session.user.id,
        bookId: parsed.data.bookId,
        characterId: parsed.data.characterId || null,
      },
    });

    return { postId: post.id };
  } catch {
    return { error: "Failed to create post" };
  }
}
