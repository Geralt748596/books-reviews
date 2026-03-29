import { getBookReviews } from "@/lib/actions/reviews"
import { ReviewCard } from "@/components/review-card"
import { ReviewForm } from "@/components/review-form"
import { StarRating } from "@/components/star-rating"
import { Separator } from "@/components/ui/separator"

interface ReviewListProps {
  bookId: string
  currentUserId?: string
}

export async function ReviewList({ bookId, currentUserId }: ReviewListProps) {
  const reviews = await getBookReviews(bookId)

  const averageRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0

  const userReview = currentUserId
    ? reviews.find((r) => r.userId === currentUserId)
    : undefined

  return (
    <div className="flex flex-col gap-6">
      {/* Header: average rating + count */}
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold">
          Reviews{" "}
          {reviews.length > 0 && (
            <span className="text-muted-foreground font-normal text-base">
              ({reviews.length})
            </span>
          )}
        </h3>
        {reviews.length > 0 && (
          <div className="flex items-center gap-2">
            <StarRating value={Math.round(averageRating)} readOnly size="default" />
            <span className="text-sm text-muted-foreground">
              {averageRating.toFixed(1)} average
            </span>
          </div>
        )}
      </div>

      <Separator />

      {/* Write / edit review form */}
      {currentUserId && !userReview && (
        <div className="flex flex-col gap-3">
          <h4 className="font-medium">Write a Review</h4>
          <ReviewForm bookId={bookId} />
          <Separator />
        </div>
      )}

      {/* Reviews list */}
      {reviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
          <p className="text-lg">No reviews yet</p>
          <p className="text-sm">Be the first to review!</p>
        </div>
      ) : (
        <div className="flex flex-col">
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}
    </div>
  )
}
