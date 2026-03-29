"use client"

import { useState, useTransition } from "react"
import { deleteReview, type ReviewWithUser } from "@/lib/actions/reviews"
import { StarRating } from "@/components/star-rating"
import { ReviewForm } from "@/components/review-form"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

interface ReviewCardProps {
  review: ReviewWithUser
  currentUserId?: string
}

export function ReviewCard({ review, currentUserId }: ReviewCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const isOwner = currentUserId === review.userId

  const formattedDate = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(review.createdAt))

  const initials = review.user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  function handleDelete() {
    startTransition(async () => {
      await deleteReview(review.id)
    })
  }

  if (isEditing) {
    return (
      <div className="flex flex-col gap-4 py-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-sm">Edit your review</h4>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(false)}
          >
            Cancel
          </Button>
        </div>
        <ReviewForm
          bookId={review.bookId}
          existingReview={{
            id: review.id,
            rating: review.rating,
            title: review.title,
            content: review.content,
          }}
        />
        <Separator />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Avatar>
            {review.user.image && (
              <AvatarImage src={review.user.image} alt={review.user.name} />
            )}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-medium text-sm">{review.user.name}</span>
            <span className="text-xs text-muted-foreground">{formattedDate}</span>
          </div>
        </div>
        <StarRating value={review.rating} readOnly size="sm" />
      </div>

      {review.title && (
        <h4 className="font-semibold text-sm">{review.title}</h4>
      )}

      <p className="text-sm text-muted-foreground leading-relaxed">{review.content}</p>

      {isOwner && (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(true)}
          >
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending ? "Deleting..." : "Delete"}
          </Button>
        </div>
      )}

      <Separator />
    </div>
  )
}
