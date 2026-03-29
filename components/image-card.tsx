import type { GeneratedImageWithRelations } from "@/lib/actions/images"
import { Card, CardContent } from "@/components/ui/card"

interface ImageCardProps {
  image: GeneratedImageWithRelations
}

export function ImageCard({ image }: ImageCardProps) {
  const date = new Date(image.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })

  return (
    <Card className="overflow-hidden">
      <img
        src={image.blobUrl}
        alt={image.prompt}
        className="w-full aspect-square object-cover"
      />
      <CardContent className="p-3 flex flex-col gap-1">
        <p className="text-sm line-clamp-2 text-foreground">{image.prompt}</p>
        {image.character && (
          <p className="text-xs text-muted-foreground">
            Character: <span className="font-medium">{image.character.name}</span>
          </p>
        )}
        <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
          <span>{image.user.name}</span>
          <span>{date}</span>
        </div>
      </CardContent>
    </Card>
  )
}
