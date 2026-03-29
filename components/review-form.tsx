"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { createReview, updateReview } from "@/lib/actions/reviews"
import { StarRating } from "@/components/star-rating"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

const ReviewFormSchema = z.object({
  title: z.string().optional(),
  content: z.string().min(10, "Review must be at least 10 characters"),
})

type ReviewFormValues = z.infer<typeof ReviewFormSchema>

interface ReviewFormProps {
  bookId: string
  existingReview?: {
    id: string
    rating: number
    title: string | null
    content: string
  }
}

export function ReviewForm({ bookId, existingReview }: ReviewFormProps) {
  const [rating, setRating] = useState(existingReview?.rating ?? 0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ReviewFormValues>({
    resolver: zodResolver(ReviewFormSchema),
    defaultValues: {
      title: existingReview?.title ?? "",
      content: existingReview?.content ?? "",
    },
  })

  const isEditing = !!existingReview

  function onSubmit(values: ReviewFormValues) {
    if (rating === 0) {
      setErrorMsg("Please select a star rating")
      return
    }

    setErrorMsg(null)

    startTransition(async () => {
      const payload = {
        rating,
        title: values.title || undefined,
        content: values.content,
      }

      const result = isEditing
        ? await updateReview(existingReview.id, payload)
        : await createReview(bookId, payload)

      if ("error" in result) {
        setErrorMsg(result.error)
        toast.error(result.error)
      } else {
        toast.success(isEditing ? "Review updated!" : "Review submitted!")
        if (!isEditing) {
          reset()
          setRating(0)
        }
      }
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label>Your Rating</Label>
        <StarRating value={rating} onChange={setRating} readOnly={false} size="lg" />
        {rating === 0 && errorMsg === "Please select a star rating" && (
          <p className="text-sm text-destructive">Please select a star rating</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="review-title">Title (optional)</Label>
        <Input
          id="review-title"
          placeholder="Summarize your review"
          {...register("title")}
          disabled={isPending}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="review-content">Review</Label>
        <Textarea
          id="review-content"
          placeholder="Write your review here... (min 10 characters)"
          rows={4}
          {...register("content")}
          disabled={isPending}
          aria-invalid={!!errors.content}
        />
        {errors.content && (
          <p className="text-sm text-destructive">{errors.content.message}</p>
        )}
      </div>

      {errorMsg && errorMsg !== "Please select a star rating" && (
        <p className="text-sm text-destructive">{errorMsg}</p>
      )}

      <Button type="submit" disabled={isPending} className="self-start">
        {isPending
          ? isEditing
            ? "Updating..."
            : "Submitting..."
          : isEditing
            ? "Update Review"
            : "Submit Review"}
      </Button>
    </form>
  )
}
