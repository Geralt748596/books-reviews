import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { getBook } from "@/lib/google-books"
import { saveBookToDb } from "@/lib/actions/books"
import { ReviewList } from "@/components/review-list"
import { CharacterList } from "@/components/character-list"
import { ImageGenerator } from "@/components/image-generator"
import { ImageCard } from "@/components/image-card"
import { Card } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { prisma } from "@/lib/db"
import type { GeneratedImageWithRelations } from "@/lib/actions/images"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const volume = await getBook(id)
  return { title: volume?.volumeInfo.title ?? "Book Details" }
}

interface AiImagesTabProps {
  bookId: string
}

async function AiImagesTab({ bookId }: AiImagesTabProps) {
  const [rawImages, characters] = await Promise.all([
    prisma.generatedImage.findMany({
      where: { bookId },
      include: {
        user: { select: { name: true, image: true } },
        character: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.character.findMany({
      where: { bookId },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    }),
  ])
  const images: GeneratedImageWithRelations[] = rawImages

  return (
    <div className="flex flex-col gap-6">
      <ImageGenerator bookId={bookId} characters={characters} />

      {images.length > 0 && (
        <>
          <Separator />
          <div className="flex flex-col gap-3">
            <h4 className="font-medium text-sm">
              Generated Images{" "}
              <span className="text-muted-foreground font-normal">({images.length})</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {images.map((image) => (
                <ImageCard key={image.id} image={image} />
              ))}
            </div>
          </div>
        </>
      )}

      {images.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
          <p className="text-sm">No AI images yet. Generate one above!</p>
        </div>
      )}
    </div>
  )
}

export default async function BookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [volume, session] = await Promise.all([
    getBook(id),
    auth.api.getSession({ headers: await headers() }),
  ])

  if (!volume) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-2">
        <h1 className="text-2xl font-bold">Book not found</h1>
        <p className="text-muted-foreground">The book you are looking for does not exist.</p>
      </div>
    )
  }

  let dbBook: { id: string } | null = null
  try {
    dbBook = await saveBookToDb(volume)
  } catch {
    // Ignore DB errors to ensure page renders
  }

  const info = volume.volumeInfo
  const authors = info.authors?.join(", ") || "Unknown Author"
  
  let thumbnailUrl = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || ""
  if (thumbnailUrl.startsWith("http://")) {
    thumbnailUrl = thumbnailUrl.replace("http://", "https://")
  }

  return (
    <div className="flex flex-col gap-8">
      <Card className="overflow-hidden">
        <div className="flex flex-col sm:flex-row gap-6 p-6">
          <div className="shrink-0 mx-auto sm:mx-0">
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt={`Cover of ${info.title}`}
                className="w-48 h-auto object-cover rounded shadow-md"
              />
            ) : (
              <div className="w-48 h-72 bg-muted rounded flex items-center justify-center text-muted-foreground shadow-md">
                No Cover
              </div>
            )}
          </div>
          
          <div className="flex flex-col gap-4 flex-1">
            <div>
              <h1 className="text-3xl font-bold leading-tight">{info.title}</h1>
              <p className="text-xl text-muted-foreground mt-1">{authors}</p>
            </div>
            
            <div className="flex flex-wrap gap-2 items-center">
              {info.publishedDate && (
                <Badge variant="secondary">
                  Published: {info.publishedDate}
                </Badge>
              )}
              {info.language && (
                <Badge variant="outline" className="uppercase">
                  {info.language}
                </Badge>
              )}
            </div>

            {info.description && (
              <div className="mt-2 prose prose-sm dark:prose-invert max-w-none">
                <p className="line-clamp-6 text-sm leading-relaxed text-muted-foreground">
                  {info.description}
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>

      <Tabs defaultValue="reviews" className="w-full">
        <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:inline-grid">
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
          <TabsTrigger value="characters">Characters</TabsTrigger>
          <TabsTrigger value="ai-images">AI Images</TabsTrigger>
        </TabsList>
        
        <Card className="mt-6 p-6 min-h-[300px]">
          <TabsContent value="reviews" className="mt-0">
            {dbBook ? (
              <ReviewList
                bookId={dbBook.id}
                currentUserId={session?.user?.id}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground py-12">
                Reviews unavailable
              </div>
            )}
          </TabsContent>
          <TabsContent value="characters" className="mt-0">
            {dbBook ? (
              <CharacterList bookId={dbBook.id} currentUserId={session?.user?.id} />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground py-12">
                Characters unavailable
              </div>
            )}
          </TabsContent>
          <TabsContent value="ai-images" className="mt-0">
            {dbBook ? (
              <AiImagesTab bookId={dbBook.id} />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground py-12">
                AI Images unavailable
              </div>
            )}
          </TabsContent>
        </Card>
      </Tabs>
    </div>
  )
}
