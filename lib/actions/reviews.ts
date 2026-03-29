"use server"

import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const ReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().optional(),
  content: z.string().min(10, "Review must be at least 10 characters"),
})

export type ReviewWithUser = {
  id: string
  rating: number
  title: string | null
  content: string
  createdAt: Date
  updatedAt: Date
  userId: string
  bookId: string
  user: {
    name: string
    image: string | null
  }
}

export async function createReview(
  bookId: string,
  data: { rating: number; title?: string; content: string }
): Promise<{ review: ReviewWithUser } | { error: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { error: "Unauthorized" }

  const parsed = ReviewSchema.safeParse(data)
  if (!parsed.success) {
    try {
      const issues = JSON.parse(parsed.error.message) as Array<{ message: string }>
      return { error: issues[0]?.message ?? "Invalid data" }
    } catch {
      return { error: "Invalid data" }
    }
  }

  try {
    const review = await prisma.review.create({
      data: {
        rating: parsed.data.rating,
        title: parsed.data.title || null,
        content: parsed.data.content,
        userId: session.user.id,
        bookId,
      },
      include: {
        user: {
          select: { name: true, image: true },
        },
      },
    })

    revalidatePath(`/book/${bookId}`)
    return { review }
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return { error: "You already reviewed this book" }
    }
    return { error: "Failed to create review" }
  }
}

export async function updateReview(
  reviewId: string,
  data: { rating: number; title?: string; content: string }
): Promise<{ review: ReviewWithUser } | { error: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { error: "Unauthorized" }

  const parsed = ReviewSchema.safeParse(data)
  if (!parsed.success) {
    try {
      const issues = JSON.parse(parsed.error.message) as Array<{ message: string }>
      return { error: issues[0]?.message ?? "Invalid data" }
    } catch {
      return { error: "Invalid data" }
    }
  }

  const existing = await prisma.review.findUnique({ where: { id: reviewId } })
  if (!existing) return { error: "Review not found" }
  if (existing.userId !== session.user.id) return { error: "Unauthorized" }

  try {
    const review = await prisma.review.update({
      where: { id: reviewId },
      data: {
        rating: parsed.data.rating,
        title: parsed.data.title || null,
        content: parsed.data.content,
      },
      include: {
        user: {
          select: { name: true, image: true },
        },
      },
    })

    revalidatePath(`/book/${review.bookId}`)
    return { review }
  } catch {
    return { error: "Failed to update review" }
  }
}

export async function deleteReview(
  reviewId: string
): Promise<{ success: true } | { error: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { error: "Unauthorized" }

  const existing = await prisma.review.findUnique({ where: { id: reviewId } })
  if (!existing) return { error: "Review not found" }
  if (existing.userId !== session.user.id) return { error: "Unauthorized" }

  try {
    await prisma.review.delete({ where: { id: reviewId } })
    revalidatePath(`/book/${existing.bookId}`)
    return { success: true }
  } catch {
    return { error: "Failed to delete review" }
  }
}

export async function getBookReviews(bookId: string): Promise<ReviewWithUser[]> {
  const reviews = await prisma.review.findMany({
    where: { bookId },
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: { name: true, image: true },
      },
    },
  })

  return reviews
}
