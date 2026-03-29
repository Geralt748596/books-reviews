import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-20 text-center">
      <h1 className="text-4xl font-bold">Books Reviews</h1>
      <p className="text-xl text-muted-foreground max-w-md">
        Search for books, leave reviews, manage characters, and generate AI illustrations.
      </p>
      <div className="flex gap-4">
        <Button render={<Link href="/search" />} size="lg">
          Search Books
        </Button>
        <Button render={<Link href="/gallery" />} variant="outline" size="lg">
          Browse Gallery
        </Button>
      </div>
    </div>
  )
}
