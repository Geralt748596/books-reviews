"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { extractCharacters, type CharacterSuggestion } from "@/lib/openai";

const CharacterSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});

export type CharacterData = {
  id: string;
  name: string;
  createdAt: Date;
};

export async function suggestCharacters(
  bookId: string,
): Promise<CharacterSuggestion[] | { error: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Unauthorized" };

  const book = await prisma.book.findUnique({ where: { id: bookId } });
  if (!book) return { error: "Book not found" };

  if (!book.description) return [];

  return extractCharacters(book.title, book.description);
}

export async function addCharacter(
  bookId: string,
  data: { name: string; description?: string },
): Promise<{ character: CharacterData } | { error: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Unauthorized" };

  const parsed = CharacterSchema.safeParse(data);
  if (!parsed.success) {
    try {
      const issues = JSON.parse(parsed.error.message) as Array<{
        message: string;
      }>;
      return { error: issues[0]?.message ?? "Invalid data" };
    } catch {
      return { error: "Invalid data" };
    }
  }

  const existing = await prisma.character.findFirst({
    where: {
      books: { some: { id: bookId } },
      name: { equals: parsed.data.name, mode: "insensitive" },
    },
  });
  if (existing) return { error: "Character already exists" };

  try {
    const character = await prisma.character.create({
      data: {
        name: parsed.data.name,
        books: { connect: { id: bookId } },
        ...(parsed.data.description
          ? {
              characterDescriptions: {
                create: {
                  description: parsed.data.description,
                  bookId,
                },
              },
            }
          : {}),
      },
    });

    revalidatePath(`/book/${bookId}`);
    return {
      character: {
        id: character.id,
        name: character.name,
        createdAt: character.createdAt,
      },
    };
  } catch {
    return { error: "Failed to add character" };
  }
}

export async function updateCharacter(
  characterId: string,
  data: { name?: string; description?: string },
): Promise<{ character: CharacterData } | { error: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Unauthorized" };

  const existing = await prisma.character.findUnique({
    where: { id: characterId },
  });
  if (!existing) return { error: "Character not found" };

  try {
    const character = await prisma.character.update({
      where: { id: characterId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
      },
    });

    const books = await prisma.book.findMany({
      where: { characters: { some: { id: characterId } } },
      select: { id: true },
    });

    for (const book of books) {
      revalidatePath(`/book/${book.id}`);
    }
    return {
      character: {
        id: character.id,
        name: character.name,
        createdAt: character.createdAt,
      },
    };
  } catch {
    return { error: "Failed to update character" };
  }
}

export async function deleteCharacter(
  characterId: string,
): Promise<{ success: true } | { error: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Unauthorized" };

  const existing = await prisma.character.findUnique({
    where: { id: characterId },
  });
  if (!existing) return { error: "Character not found" };

  const books = await prisma.book.findMany({
    where: { characters: { some: { id: characterId } } },
    select: { id: true },
  });

  try {
    await prisma.character.delete({ where: { id: characterId } });
    for (const book of books) {
      revalidatePath(`/book/${book.id}`);
    }
    return { success: true };
  } catch {
    return { error: "Failed to delete character" };
  }
}

export async function getBookCharacters(
  bookId: string,
): Promise<CharacterData[]> {
  return prisma.character.findMany({
    where: { books: { some: { id: bookId } } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      createdAt: true,
    },
  });
}
