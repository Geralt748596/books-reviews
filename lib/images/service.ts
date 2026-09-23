import { uploadImageToBlob } from "@/lib/blob-storage";
import { prisma } from "@/lib/db";
import { recordCharacterImageAdded, recordCoverAdded } from "@/lib/feed/write";
import {
  buildCharacterImagePrompt,
  buildCoverPrompt,
  generateImage,
} from "@/lib/openai";
import type {
  GeneratedBookCover,
  GeneratedCharacterImage,
} from "@/prisma/generated/client";

/**
 * Создание обложек и картинок персонажей без привязки к контексту запроса.
 * Используется и server actions, и публикацией из CLI/админки. Событие ленты
 * пишется в одной транзакции с записью картинки.
 */

export type ImageResult<T> = { image: T } | { error: string };

export async function createBookCover(
  bookId: string,
  userId: string,
  userPrompt?: string,
): Promise<ImageResult<GeneratedBookCover>> {
  const book = await prisma.book.findUnique({ where: { id: bookId } });
  if (!book) return { error: "Book not found" };

  const prompt = buildCoverPrompt(book.title, book.description, userPrompt);

  try {
    const imageResult = await generateImage(prompt);
    if ("error" in imageResult) return { error: imageResult.error };

    const { base64, revisedPrompt } = imageResult;
    const blobUrl = await uploadImageToBlob(
      base64,
      `books/${bookId}/${Date.now()}.png`,
    );

    const cover = await prisma.$transaction(async (tx) => {
      const created = await tx.generatedBookCover.create({
        data: { blobUrl, bookId, userId, prompt: revisedPrompt || prompt },
      });
      await recordCoverAdded(tx, created);
      return created;
    });

    return { image: cover };
  } catch (err) {
    console.error(err);
    return { error: "Failed to generate image. Please try again." };
  }
}

export async function createCharacterImage(
  bookId: string,
  characterId: string,
  userId: string,
  userPrompt?: string,
): Promise<ImageResult<GeneratedCharacterImage>> {
  try {
    const description = await prisma.characterDescription.findUnique({
      where: { bookId_characterId: { bookId, characterId } },
      include: { character: { select: { name: true } } },
    });
    if (!description) return { error: "Character description not found" };

    const prompt = buildCharacterImagePrompt(
      {
        name: description.character.name,
        appearance: description.appearance,
        description: description.description,
      },
      userPrompt,
    );

    const imageResult = await generateImage(prompt);
    if ("error" in imageResult) return { error: imageResult.error };

    const { base64, revisedPrompt } = imageResult;
    const blobUrl = await uploadImageToBlob(
      base64,
      `books/${bookId}/char-${characterId}-${Date.now()}.png`,
    );

    const image = await saveCharacterImage({
      blobUrl,
      userId,
      characterId,
      bookId,
      prompt: revisedPrompt || prompt,
    });
    return { image };
  } catch (err) {
    console.error(err);
    return { error: "Failed to generate image. Please try again." };
  }
}

/** Запись уже загруженной картинки персонажа плюс событие ленты. */
export async function saveCharacterImage(data: {
  blobUrl: string;
  userId: string;
  characterId: string;
  bookId: string;
  prompt: string;
}): Promise<GeneratedCharacterImage> {
  return prisma.$transaction(async (tx) => {
    const created = await tx.generatedCharacterImage.create({ data });
    await recordCharacterImageAdded(tx, created);
    return created;
  });
}
