"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import type { FormattedBook } from "@/app/api/books/search/route"

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "ru", label: "Russian" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "es", label: "Spanish" },
  { value: "it", label: "Italian" },
]

function BookCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="h-48 w-full rounded-none" />
      <CardHeader>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-3 w-full mb-1" />
        <Skeleton className="h-3 w-4/5" />
      </CardContent>
    </Card>
  )
}

function BookCard({ book }: { book: FormattedBook }) {
  return (
    <Link href={`/book/${book.id}`} className="block h-full">
      <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
        <div className="relative h-48 w-full overflow-hidden bg-muted">
          {book.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={book.thumbnail}
              alt={book.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground text-sm">
              No cover
            </div>
          )}
        </div>
        <CardHeader className="pb-2">
          <CardTitle className="line-clamp-2 text-sm">{book.title}</CardTitle>
          <p className="text-xs text-muted-foreground line-clamp-1">
            {book.authors}
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          {book.description && (
            <p className="text-xs text-muted-foreground line-clamp-3 mb-2">
              {book.description.length > 100
                ? book.description.slice(0, 100) + "…"
                : book.description}
            </p>
          )}
          <div className="flex items-center gap-1 flex-wrap">
            {book.language && (
              <Badge variant="secondary" className="text-xs">
                {book.language.toUpperCase()}
              </Badge>
            )}
            {book.publishedDate && (
              <span className="text-xs text-muted-foreground">
                {book.publishedDate.slice(0, 4)}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export default function SearchPage() {
  const [query, setQuery] = useState("")
  const [lang, setLang] = useState("en")
  const [books, setBooks] = useState<FormattedBook[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (!query.trim()) {
      setBooks([])
      setHasSearched(false)
      setIsLoading(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true)
      setHasSearched(true)
      try {
        const params = new URLSearchParams({ q: query.trim(), lang })
        const res = await fetch(`/api/books/search?${params.toString()}`)
        if (!res.ok) {
          setBooks([])
          return
        }
        const data: { books: FormattedBook[] } = await res.json()
        setBooks(data.books)
      } catch {
        setBooks([])
      } finally {
        setIsLoading(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [query, lang])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-4">Search Books</h1>
        <div className="flex gap-2 items-center">
          <div className="flex-1">
            <Input
              type="search"
              placeholder="Search for books…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-10"
            />
          </div>
          <Select value={lang} onValueChange={(v) => setLang(v ?? "en")}>
            <SelectTrigger className="w-36 h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (
                <SelectItem key={l.value} value={l.value}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <BookCardSkeleton key={i} />
          ))}
        </div>
      )}

      {!isLoading && hasSearched && books.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <p className="text-lg">No books found</p>
          <p className="text-sm mt-1">Try a different search term or language</p>
        </div>
      )}

      {!isLoading && !hasSearched && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <p className="text-lg">Search for a book to get started</p>
          <p className="text-sm mt-1">Enter a title, author, or keyword above</p>
        </div>
      )}

      {!isLoading && books.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {books.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      )}
    </div>
  )
}
