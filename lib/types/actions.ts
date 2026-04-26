import { Book, Character } from "@/prisma/generated/client";

export type BookResultType = Pick<
  Book,
  "id" | "title" | "authors" | "thumbnailUrl"
> & {
  type: "book";
};
export type CharacterResultType = Pick<Character, "id" | "name"> & {
  type: "character";
  books: Pick<Book, "id" | "title">[];
};
