import { prisma } from "@/lib/db";
import { CharacterTier, type Prisma } from "@/prisma/generated/client";
import { recordBookAdded } from "@/lib/feed/write";
import { looksLikeProperName, nonEmptyText } from "./names";
import type { BookAnalysis, Character } from "./types";

export interface PersistOptions {
  bookSeriesId?: string;
  publishedDate?: string | null;
  language?: string | null;
  thumbnailUrl?: string | null;
  /** Выполнить всё в транзакции и откатить: проверка без записи в БД. */
  dryRun?: boolean;
}

export interface PersistResult {
  bookId: string;
  /** true, если книга с таким названием и авторами уже была и обновлена. */
  updated: boolean;
  charactersCreated: number;
  charactersReused: number;
}

interface KnownCharacter {
  id: string;
  name: string;
  aliases: string[];
}

interface TieredCharacter extends Character {
  tier: CharacterTier;
}

/**
 * Сохраняет результат анализа в БД.
 *
 * Идемпотентно: повторная публикация той же книги (то же название и авторы)
 * обновляет запись и описания персонажей вместо создания дубликатов.
 * Всё выполняется в одной транзакции: либо книга сохранена целиком, либо никак.
 */
export async function persistAnalysis(
  analysis: BookAnalysis,
  options: PersistOptions = {},
): Promise<PersistResult> {
  const { bookSeriesId, publishedDate, thumbnailUrl } = options;
  const language = options.language ?? nonEmptyText(analysis.language);

  const characters: TieredCharacter[] = [
    ...analysis.characters.main.map((c) => ({
      ...c,
      tier: CharacterTier.MAIN,
    })),
    ...analysis.characters.secondary.map((c) => ({
      ...c,
      tier: CharacterTier.SECONDARY,
    })),
    ...analysis.characters.minor.map((c) => ({
      ...c,
      tier: CharacterTier.MINOR,
    })),
  ];

  const run = (tx: Prisma.TransactionClient) =>
    persistWithin(tx, analysis, characters, {
      bookSeriesId,
      publishedDate,
      thumbnailUrl,
      language,
    });

  try {
    if (options.dryRun) {
      let result: PersistResult | undefined;
      try {
        await prisma.$transaction(
          async (tx) => {
            result = await run(tx);
            throw new DryRunRollback();
          },
          { maxWait: 20_000, timeout: 180_000 },
        );
      } catch (error) {
        if (!(error instanceof DryRunRollback)) throw error;
      }
      return result!;
    }

    return await prisma.$transaction(run, {
      // Сотня персонажей = несколько сотен запросов через пулер, даём запас
      maxWait: 20_000,
      timeout: 180_000,
    });
  } catch (error) {
    console.error("Error persisting analysis:", error);
    throw new Error("Failed to persist analysis", { cause: error });
  }
}

class DryRunRollback extends Error {
  constructor() {
    super("dry run rollback");
    this.name = "DryRunRollback";
  }
}

async function persistWithin(
  tx: Prisma.TransactionClient,
  analysis: BookAnalysis,
  characters: TieredCharacter[],
  {
    bookSeriesId,
    publishedDate,
    thumbnailUrl,
    language,
  }: {
    bookSeriesId?: string;
    publishedDate?: string | null;
    thumbnailUrl?: string | null;
    language: string | null;
  },
): Promise<PersistResult> {
  {
    {
      // --- Книга: найти существующую или создать ---
      const existingBook = await tx.book.findFirst({
        where: {
          title: { equals: analysis.title, mode: "insensitive" },
          authors: { equals: analysis.authors, mode: "insensitive" },
        },
        select: { id: true, publishedDate: true, thumbnailUrl: true },
      });

      const bookData = {
        title: analysis.title,
        authors: analysis.authors,
        description: nonEmptyText(analysis.plotSummary.overview),
        keyEvents: analysis.plotSummary.keyEvents,
        language,
        publishedDate: publishedDate ?? existingBook?.publishedDate ?? null,
        thumbnailUrl: thumbnailUrl ?? existingBook?.thumbnailUrl ?? null,
        bookSeriesId: bookSeriesId ?? null,
      };

      const book = existingBook
        ? await tx.book.update({
            where: { id: existingBook.id },
            data: bookData,
          })
        : await tx.book.create({ data: bookData });

      // Событие ленты только для новой книги; при dry-run откатится с транзакцией
      if (!existingBook) await recordBookAdded(tx, book);

      // --- Пул персонажей, с которыми можно сопоставлять: уже привязанные к книге
      //     и, если задана серия, все персонажи серии ---
      const known: KnownCharacter[] = await tx.character.findMany({
        where: {
          books: {
            some: bookSeriesId
              ? { OR: [{ id: book.id }, { bookSeriesId }] }
              : { id: book.id },
          },
        },
        select: { id: true, name: true, aliases: true },
      });

      let charactersCreated = 0;
      let charactersReused = 0;

      for (const char of characters) {
        const match = findKnownCharacter(known, char);
        let characterId: string;

        if (match) {
          const aliases = mergeAliases(match, char);
          await tx.character.update({
            where: { id: match.id },
            data: { aliases, books: { connect: { id: book.id } } },
          });
          match.aliases = aliases;
          characterId = match.id;
          charactersReused += 1;
        } else {
          const created = await tx.character.create({
            data: {
              name: char.name,
              aliases: char.aliases,
              books: { connect: { id: book.id } },
            },
            select: { id: true },
          });
          characterId = created.id;
          known.push({
            id: characterId,
            name: char.name,
            aliases: char.aliases,
          });
          charactersCreated += 1;
        }

        const descriptionData = {
          description:
            nonEmptyText(char.description) ??
            nonEmptyText(char.role) ??
            char.description,
          appearance: nonEmptyText(char.appearance),
          personality: nonEmptyText(char.personality),
          role: nonEmptyText(char.role),
          tier: char.tier,
        };

        await tx.characterDescription.upsert({
          where: { bookId_characterId: { bookId: book.id, characterId } },
          create: { ...descriptionData, bookId: book.id, characterId },
          update: descriptionData,
        });
      }

      return {
        bookId: book.id,
        updated: Boolean(existingBook),
        charactersCreated,
        charactersReused,
      };
    }
  }
}

// =============================================================================
// Сопоставление персонажей
// =============================================================================

/**
 * Ищет уже известного персонажа. Совпадение по имени или по алиасу, но алиасы
 * учитываются только если похожи на имя собственное: по словам вроде «knight»
 * или «дочь» разных людей склеивать нельзя.
 */
function findKnownCharacter(
  known: KnownCharacter[],
  char: Character,
): KnownCharacter | undefined {
  const name = char.name.trim().toLowerCase();
  const matchableAliases = new Set(
    char.aliases.filter(looksLikeProperName).map((a) => a.trim().toLowerCase()),
  );

  const exact = known.find((k) => k.name.trim().toLowerCase() === name);
  if (exact) return exact;

  return known.find((k) => {
    const knownName = k.name.trim().toLowerCase();
    const knownAliases = k.aliases
      .filter(looksLikeProperName)
      .map((a) => a.trim().toLowerCase());

    if (knownAliases.includes(name)) return true;
    if (matchableAliases.has(knownName)) return true;
    return knownAliases.some((a) => matchableAliases.has(a));
  });
}

function mergeAliases(known: KnownCharacter, char: Character): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  const canonical = known.name.trim().toLowerCase();

  for (const alias of [...known.aliases, ...char.aliases, char.name]) {
    const key = alias.trim().toLowerCase();
    if (!key || key === canonical || seen.has(key)) continue;
    seen.add(key);
    result.push(alias.trim());
  }
  return result;
}
