"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import type { GalleryImageWithRelations } from "@/lib/actions/gallery"
import { GalleryModal } from "./gallery-modal"

interface GalleryCardProps {
  image: GalleryImageWithRelations
}

export function GalleryCard({ image }: GalleryCardProps) {
  const [open, setOpen] = useState(false)
  
  const date = new Date(image.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })

  return (
    <>
      <Card 
        className="overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all"
        onClick={() => setOpen(true)}
      >
        <img
          src={image.blobUrl}
          alt={image.prompt}
          className="w-full aspect-square object-cover"
          loading="lazy"
        />
        <CardContent className="p-3 flex flex-col gap-1">
          <p className="text-sm font-medium line-clamp-1">{image.book.title}</p>
          {image.character && (
            <p className="text-xs text-muted-foreground line-clamp-1">
              {image.character.name}
            </p>
          )}
          <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
            <span>{image.user.name}</span>
            <span>{date}</span>
          </div>
        </CardContent>
      </Card>

      <GalleryModal image={image} open={open} onOpenChange={setOpen} />
    </>
  )
}
