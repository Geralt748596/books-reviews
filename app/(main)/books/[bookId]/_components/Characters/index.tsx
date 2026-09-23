import { getBookCharactersImages } from "@/lib/actions/book-characters";
import { Book } from "@/prisma/generated/client";
import { CharactersList } from "./components/characters-list";

export { CharactersSkeleton } from "./components/character-card-skeleton";

export async function Characters({ bookId }: { bookId: Book["id"] }) {
  const page = await getBookCharactersImages(bookId);
  if (!page.items.length) return null;

  return (
    <CharactersList
      bookId={bookId}
      initialItems={page.items}
      initialNextOffset={page.nextOffset}
    />
  );
}
