import Link from "next/link"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { GalleryImageWithRelations } from "@/lib/actions/gallery"

interface GalleryModalProps {
  image: GalleryImageWithRelations | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GalleryModal({ image, open, onOpenChange }: GalleryModalProps) {
  if (!image) return null

  const date = new Date(image.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl border-none bg-transparent shadow-none p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Image generated for {image.book.title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col md:flex-row bg-background rounded-lg overflow-hidden border">
          <div className="md:w-2/3 bg-muted flex items-center justify-center relative min-h-[300px]">
            <img
              src={image.blobUrl}
              alt={image.prompt}
              className="w-full max-h-[80vh] object-contain"
              loading="lazy"
            />
          </div>
          <div className="md:w-1/3 p-6 flex flex-col gap-6 max-h-[80vh] overflow-y-auto">
            <div>
              <Link 
                href={`/book/${image.book.googleBooksId || image.book.id}`}
                className="font-semibold text-lg hover:underline"
              >
                {image.book.title}
              </Link>
              {image.character && (
                <p className="text-muted-foreground mt-1 text-sm">
                  Character: <span className="font-medium">{image.character.name}</span>
                </p>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              <Avatar className="w-8 h-8">
                <AvatarImage src={image.user.image || undefined} />
                <AvatarFallback>{image.user.name[0]}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{image.user.name}</p>
                <p className="text-xs text-muted-foreground">{date}</p>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-medium mb-2">Prompt</h4>
              <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                {image.prompt}
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
