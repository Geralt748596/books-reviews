"use server"

import { prisma } from "@/lib/db"

export type GalleryImageWithRelations = {
  id: string
  prompt: string
  blobUrl: string
  createdAt: Date
  userId: string
  bookId: string
  characterId: string | null
  book: { id: string; title: string; googleBooksId: string | null }
  character: { name: string } | null
  user: { name: string; image: string | null }
}

export async function getGalleryImages({ query, page = 1 }: { query?: string; page?: number }) {
  const where = query ? {
    OR: [
      { book: { title: { contains: query, mode: 'insensitive' as const } } },
      { character: { name: { contains: query, mode: 'insensitive' as const } } },
    ]
  } : {}

  const images = await prisma.generatedImage.findMany({
    where,
    include: {
      book: { select: { id: true, title: true, googleBooksId: true } },
      character: { select: { name: true } },
      user: { select: { name: true, image: true } },
    },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * 20,
    take: 20,
  })

  const total = await prisma.generatedImage.count({ where })
  
  return { 
    images: images as unknown as GalleryImageWithRelations[], 
    total, 
    totalPages: Math.ceil(total / 20) 
  }
}

export async function getBookImages(bookId: string) {
  const images = await prisma.generatedImage.findMany({
    where: { bookId },
    include: {
      book: { select: { id: true, title: true, googleBooksId: true } },
      character: { select: { name: true } },
      user: { select: { name: true, image: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return images as unknown as GalleryImageWithRelations[]
}

export async function getCharacterImages(characterId: string) {
  const images = await prisma.generatedImage.findMany({
    where: { characterId },
    include: {
      book: { select: { id: true, title: true, googleBooksId: true } },
      character: { select: { name: true } },
      user: { select: { name: true, image: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return images as unknown as GalleryImageWithRelations[]
}
