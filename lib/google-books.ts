export interface GoogleBooksVolume {
  id: string
  volumeInfo: {
    title: string
    authors?: string[]
    description?: string
    imageLinks?: {
      thumbnail?: string
      smallThumbnail?: string
    }
    language?: string
    publishedDate?: string
  }
}

export interface GoogleBooksSearchResult {
  items?: GoogleBooksVolume[]
  totalItems: number
}

const GOOGLE_BOOKS_API = "https://www.googleapis.com/books/v1"

export async function searchBooks(
  query: string,
  lang?: string
): Promise<GoogleBooksSearchResult> {
  try {
    const params = new URLSearchParams({
      q: query,
      maxResults: "20",
    })
    if (lang) {
      params.set("langRestrict", lang)
    }

    const res = await fetch(`${GOOGLE_BOOKS_API}/volumes?${params.toString()}`)

    if (!res.ok) {
      if (process.env.NODE_ENV === "development") {
        console.error(`Google Books API error: ${res.status} ${res.statusText}`)
      }
      return { totalItems: 0 }
    }

    const data: GoogleBooksSearchResult = await res.json()
    return data
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Failed to search books:", error)
    }
    return { totalItems: 0 }
  }
}

export async function getBook(volumeId: string): Promise<GoogleBooksVolume | null> {
  try {
    const res = await fetch(`${GOOGLE_BOOKS_API}/volumes/${volumeId}`)

    if (!res.ok) {
      if (process.env.NODE_ENV === "development") {
        console.error(`Google Books API error: ${res.status} ${res.statusText}`)
      }
      return null
    }

    const data: GoogleBooksVolume = await res.json()
    return data
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Failed to get book:", error)
    }
    return null
  }
}
