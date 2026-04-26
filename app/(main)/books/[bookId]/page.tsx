import { Skeleton } from "@/components/ui/skeleton";
import { getBookById } from "@/lib/actions/books";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EyeIcon } from "lucide-react";
import { BookCovers, BookCoversSkeleton } from "./_components/Covers";
import { AddCovers } from "./_components/Covers/components/add-covers";
import Link from "next/link";
import { GenerateCharacterDialog } from "@/components/generate-character";
import { Characters, CharactersSkeleton } from "./_components/Characters";

export default function BooksPage({ params }: PageProps<"/books/[bookId]">) {
  return (
    <Suspense fallback={<Skeleton className="h-full w-full" />}>
      <BookContent params={params} />
    </Suspense>
  );
}

async function BookContent({
  params,
}: Pick<PageProps<"/books/[bookId]">, "params">) {
  const { bookId } = await params;
  const book = await getBookById(bookId);
  if (!book) return notFound();

  return (
    <div className="flex flex-col gap-y-6 lg:gap-y-12">
      {/* Hero Section: Book Detail */}
      <section className="grid grid-cols-12 grid-rows-[auto_auto_auto] md:grid-rows-[auto_auto] gap-y-4 gap-x-6 items-start">
        {/* Asymmetrical The Book Cover */}
        <div className="w-full row-start-2 row-span-1 md:row-start-1 md:row-span-2 col-start-1 col-span-12 md:col-span-5 flex justify-center md:justify-end self-center-safe">
          <Suspense fallback={<BookCoversSkeleton />}>
            <BookCovers bookId={bookId} />
          </Suspense>
        </div>

        {/* Asymmetrical Details & Metadata */}
        <div className="row-start-1 row-span-1 col-start-1 col-span-12 md:col-start-6 md:col-span-7 md:row-start-1 pt-4">
          <div className="flex items-center gap-3 mb-6">
            <Badge
              variant="secondary"
              className="text-xs font-bold tracking-[0.2em] text-primary uppercase bg-primary/10 px-3 py-1 rounded-full border border-primary/20"
            >
              Classic Gothic
            </Badge>
            <span className="text-xs font-medium text-muted-foreground">
              • 14h 20m Read
            </span>
          </div>

          <p className="text-lg text-muted-foreground font-serif italic max-w-xl">
            {book.authors}
          </p>
          <h1 className="text-6xl md:text-7xl font-serif font-bold text-foreground mb-4 leading-tight">
            {book.title}
          </h1>
          <div className="flex flex-wrap gap-4">
            <AddCovers
              bookId={bookId}
              className="hover:bg-primary/80 transition-all flex-1 md:max-w-xs"
            />
            <Link
              href={`/books/${bookId}/gallery`}
              className="flex-1 md:max-w-xs"
            >
              <Button variant="outline" size="lg" className="w-full">
                <EyeIcon className="w-8 h-8" />
                View All Covers
              </Button>
            </Link>
          </div>
        </div>
        {/* Summary */}
        <div className="row-start-3 md:row-start-2 col-span-12 md:col-start-6 md:col-span-7 bg-muted/30 p-8 rounded-xl border border-border/50 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors"></div>
          <h3 className="text-xs font-bold tracking-[0.1em] text-primary uppercase mb-4">
            Summary
          </h3>
          <p className="text-muted-foreground leading-relaxed font-sans text-lg italic">
            {book.description || "No description available for this book."}
          </p>
        </div>
      </section>

      {/* Character Carousel: Restyled for Premium Critique */}
      <section className="mb-24 border-t border-border/50 pt-16">
        <GenerateCharacterDialog bookId={bookId} />

        <Suspense fallback={<CharactersSkeleton />}>
          <Characters bookId={bookId} />
        </Suspense>
      </section>
    </div>
  );
}
