"use server";

import { prisma } from "@/lib/db";
import type { GoogleBooksVolume } from "@/lib/google-books";
import { BookResultType, CharacterResultType } from "@/lib/types/actions";
import { Book } from "@/prisma/generated/client";
import { cacheLife } from "next/cache";

const MAX_RESULTS = 10;

/**
 * Ищет книги в БД по названию (до {@link MAX_RESULTS} штук).
 * Сначала все точные совпадения (без учёта регистра), иначе по подстроке в названии.
 */
export async function findBook(titleQuery: string) {
  const q = titleQuery.trim();
  if (!q) return [];

  return await prisma.book.findMany({
    where: { title: { contains: q, mode: "insensitive" } },
    orderBy: { title: "asc" },
    take: MAX_RESULTS,
    select: {
      id: true,
      title: true,
    },
  });
}

export async function getBookById(bookId: Book["id"]) {
  "use cache";
  cacheLife("minutes");
  return await prisma.book.findUnique({
    where: { id: bookId },
    select: {
      id: true,
      title: true,
      authors: true,
      description: true,
      thumbnailUrl: true,
      publishedDate: true,
      characters: {
        select: {
          id: true,
          name: true,
          characterDescriptions: {
            select: {
              id: true,
              description: true,
            },
          },
        },
      },
    },
  });
}

export async function findBooksOrCharacters(query: string) {
  const q = query.trim();
  if (!q) return [];

  const [books, characters] = await Promise.all([
    prisma.book.findMany({
      where: { title: { contains: q, mode: "insensitive" } },
      orderBy: { title: "asc" },
      take: MAX_RESULTS,
      select: { id: true, title: true, authors: true, thumbnailUrl: true },
    }),
    prisma.character.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      orderBy: { name: "asc" },
      take: MAX_RESULTS,
      select: {
        id: true,
        name: true,
        characterDescriptions: {
          select: {
            id: true,
            description: true,
          },
        },
        books: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    }),
  ]);

  const results: (BookResultType | CharacterResultType)[] = [];

  for (const b of books) results.push({ type: "book", ...b });
  for (const c of characters) results.push({ type: "character", ...c });

  return results.slice(0, MAX_RESULTS);
}

export async function saveBookToDb(volume: GoogleBooksVolume) {
  const info = volume.volumeInfo;
  const authors = info.authors?.join(", ") || "Unknown";

  const book = await prisma.book.upsert({
    where: { googleBooksId: volume.id },
    create: {
      googleBooksId: volume.id,
      title: info.title,
      authors,
      description: info.description ?? null,
      thumbnailUrl:
        info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail ?? null,
      language: info.language ?? null,
      publishedDate: info.publishedDate ?? null,
    },
    update: {
      title: info.title,
      authors,
      description: info.description ?? null,
      thumbnailUrl:
        info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail ?? null,
      language: info.language ?? null,
      publishedDate: info.publishedDate ?? null,
    },
  });

  return book;
}
