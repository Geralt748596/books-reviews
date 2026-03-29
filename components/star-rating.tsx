"use client"

import { cn } from "@/lib/utils"

interface StarRatingProps {
  value: number
  onChange?: (rating: number) => void
  readOnly?: boolean
  size?: "sm" | "default" | "lg"
  className?: string
}

export function StarRating({
  value,
  onChange,
  readOnly = false,
  size = "default",
  className,
}: StarRatingProps) {
  const sizeClass = {
    sm: "text-base",
    default: "text-xl",
    lg: "text-2xl",
  }[size]

  return (
    <div
      className={cn("flex items-center gap-0.5", className)}
      role={readOnly ? "img" : "group"}
      aria-label={`Rating: ${value} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          onClick={() => !readOnly && onChange?.(star)}
          className={cn(
            sizeClass,
            "leading-none transition-colors",
            readOnly
              ? "cursor-default"
              : "cursor-pointer hover:scale-110 transition-transform",
            star <= value
              ? "text-yellow-400"
              : "text-muted-foreground/40"
          )}
          aria-label={`${star} star${star !== 1 ? "s" : ""}`}
        >
          {star <= value ? "★" : "☆"}
        </button>
      ))}
    </div>
  )
}
