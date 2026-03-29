"use server"

import { prisma } from "@/lib/db"
import type { GoogleBooksVolume } from "@/lib/google-books"

export async function saveBookToDb(volume: GoogleBooksVolume) {
  const info = volume.volumeInfo
  const authors = info.authors?.join(", ") || "Unknown"

  const book = await prisma.book.upsert({
    where: { googleBooksId: volume.id },
    create: {
      googleBooksId: volume.id,
      title: info.title,
      authors,
      description: info.description ?? null,
      thumbnailUrl:
        info.imageLinks?.thumbnail ??
        info.imageLinks?.smallThumbnail ??
        null,
      language: info.language ?? null,
      publishedDate: info.publishedDate ?? null,
    },
    update: {
      title: info.title,
      authors,
      description: info.description ?? null,
      thumbnailUrl:
        info.imageLinks?.thumbnail ??
        info.imageLinks?.smallThumbnail ??
        null,
      language: info.language ?? null,
      publishedDate: info.publishedDate ?? null,
    },
  })

  return book
}
