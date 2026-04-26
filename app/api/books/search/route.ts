import { searchBooks } from "@/lib/google-books";
import type { GoogleBooksVolume } from "@/lib/google-books";

export interface FormattedBook {
  id: string;
  title: string;
  authors: string;
  description: string | null;
  thumbnail: string | null;
  language: string | null;
  publishedDate: string | null;
}

function formatVolume(volume: GoogleBooksVolume): FormattedBook {
  const info = volume.volumeInfo;
  return {
    id: volume.id,
    title: info.title,
    authors: info.authors?.join(", ") ?? "Unknown",
    description: info.description ?? null,
    thumbnail:
      info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail ?? null,
    language: info.language ?? null,
    publishedDate: info.publishedDate ?? null,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const lang = searchParams.get("lang") ?? undefined;

  if (!q || q.trim() === "") {
    return Response.json(
      { error: "Query parameter 'q' is required" },
      { status: 400 },
    );
  }

  try {
    const result = await searchBooks(q.trim(), lang);
    const books = (result.items ?? []).map(formatVolume);
    return Response.json({ books });
  } catch {
    return Response.json(
      { error: "Failed to fetch books from Google Books API" },
      { status: 500 },
    );
  }
}
