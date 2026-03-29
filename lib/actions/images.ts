"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { buildImagePrompt, generateImage } from "@/lib/openai"
import { uploadImageToBlob } from "@/lib/blob-storage"

export type GeneratedImageWithRelations = {
  id: string
  prompt: string
  blobUrl: string
  createdAt: Date
  userId: string
  bookId: string
  characterId: string | null
  character: { name: string } | null
  user: { name: string; image: string | null }
}

export async function generateBookImage(
  bookId: string,
  options: { characterId?: string; userPrompt?: string }
): Promise<{ image: GeneratedImageWithRelations } | { error: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { error: "Unauthorized" }

  const userId = session.user.id

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const count = await prisma.generatedImage.count({
    where: { userId, createdAt: { gte: today } },
  })
  if (count >= 10) return { error: "Daily limit reached (10 images per day)" }

  const book = await prisma.book.findUnique({ where: { id: bookId } })
  if (!book) return { error: "Book not found" }

  let character: { name: string; description: string | null } | null = null
  if (options.characterId) {
    character = await prisma.character.findUnique({
      where: { id: options.characterId },
      select: { name: true, description: true },
    })
  }

  const prompt = buildImagePrompt(
    book.title,
    character?.name,
    character?.description ?? undefined,
    options.userPrompt
  )

  try {
    const { base64, revisedPrompt } = await generateImage(prompt)

    const filename = options.characterId
      ? `books/${bookId}/char-${options.characterId}-${Date.now()}.png`
      : `books/${bookId}/${Date.now()}.png`

    const blobUrl = await uploadImageToBlob(base64, filename)

    const image = await prisma.generatedImage.create({
      data: {
        prompt: revisedPrompt || prompt,
        blobUrl,
        userId,
        bookId,
        characterId: options.characterId ?? null,
      },
      include: {
        user: { select: { name: true, image: true } },
        character: { select: { name: true } },
      },
    })

    revalidatePath(`/book/${bookId}`)
    return { image }
  } catch {
    return { error: "Failed to generate image. Please try again." }
  }
}
