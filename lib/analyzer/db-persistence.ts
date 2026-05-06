import { prisma } from "@/lib/db";
import type { BookAnalysis } from "./types";

export interface PersistOptions {
  bookSeriesId?: string;
  publishedDate?: string | null;
  language?: string | null;
  thumbnailUrl?: string | null;
}

export async function persistAnalysis(
  analysis: BookAnalysis,
  options: PersistOptions = {},
): Promise<{ bookId: string }> {
  const { bookSeriesId, publishedDate, language, thumbnailUrl } = options;

  const book = await prisma.book.create({
    data: {
      title: analysis.title,
      authors: analysis.authors,
      description: analysis.plotSummary.overview || null,
      language: language ?? null,
      publishedDate: publishedDate ?? null,
      thumbnailUrl: thumbnailUrl ?? null,
      bookSeriesId: bookSeriesId ?? null,
    },
  });

  const allCharacters = [
    ...analysis.characters.main,
    ...analysis.characters.secondary,
    ...analysis.characters.minor,
  ];

  let existingSeriesCharacters: Array<{
    id: string;
    name: string;
    aliases: string[];
  }> = [];

  if (bookSeriesId) {
    existingSeriesCharacters = await prisma.character.findMany({
      where: {
        books: {
          some: { bookSeriesId },
        },
      },
      select: { id: true, name: true, aliases: true },
    });
  }

  for (const char of allCharacters) {
    let characterId: string;

    if (bookSeriesId && existingSeriesCharacters.length > 0) {
      const charNameLower = char.name.toLowerCase();
      const charAliasesLower = char.aliases.map((a) => a.toLowerCase());

      const existing = existingSeriesCharacters.find((ec) => {
        if (ec.name.toLowerCase() === charNameLower) return true;
        if (ec.aliases.some((a) => a.toLowerCase() === charNameLower))
          return true;
        if (charAliasesLower.some((a) => ec.name.toLowerCase() === a))
          return true;
        if (
          charAliasesLower.some((a) =>
            ec.aliases.some((ea) => ea.toLowerCase() === a),
          )
        )
          return true;
        return false;
      });

      if (existing) {
        await prisma.character.update({
          where: { id: existing.id },
          data: { books: { connect: { id: book.id } } },
        });
        characterId = existing.id;
      } else {
        const newChar = await prisma.character.create({
          data: {
            name: char.name,
            aliases: char.aliases,
            books: { connect: { id: book.id } },
          },
        });
        characterId = newChar.id;
        existingSeriesCharacters.push({
          id: characterId,
          name: char.name,
          aliases: char.aliases,
        });
      }
    } else {
      const newChar = await prisma.character.create({
        data: {
          name: char.name,
          aliases: char.aliases,
          books: { connect: { id: book.id } },
        },
      });
      characterId = newChar.id;
    }

    if (char.description) {
      await prisma.characterDescription.create({
        data: {
          description: char.description,
          characterId,
          bookId: book.id,
        },
      });
    }
  }

  return { bookId: book.id };
}
