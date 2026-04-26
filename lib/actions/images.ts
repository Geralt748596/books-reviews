"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  buildCharacterImagePrompt,
  buildCoverPrompt,
  generateImage,
} from "@/lib/openai";
import { uploadImageToBlob } from "@/lib/blob-storage";
import {
  GeneratedBookCover,
  GeneratedCharacterImage,
} from "@/prisma/generated/client";

export async function generateBookCover(
  bookId: string,
  options: { userPrompt?: string },
): Promise<{ image: GeneratedBookCover } | { error: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Unauthorized" };

  const userId = session.user.id;

  // const today = new Date();
  // today.setHours(0, 0, 0, 0);
  // const count = await prisma.generatedImage.count({
  //   where: { userId, createdAt: { gte: today } },
  // });
  // if (count >= 10) return { error: "Daily limit reached (10 images per day)" };
  const book = await prisma.book.findUnique({ where: { id: bookId } });
  if (!book) return { error: "Book not found" };

  // let character: { name: string } | null = null;
  // if (options.characterId) {
  //   character = await prisma.character.findUnique({
  //     where: { id: options.characterId },
  //     select: { name: true },
  //   });
  // }

  const prompt = buildCoverPrompt(
    book.title,
    book.description,
    options.userPrompt,
  );

  try {
    const imageResult = await generateImage(prompt);

    if ("error" in imageResult) {
      return { error: imageResult.error };
    }

    const { base64, revisedPrompt } = imageResult;

    // const filename = options.characterId
    //   ? `books/${bookId}/char-${options.characterId}-${Date.now()}.png`
    //   : `books/${bookId}/${Date.now()}.png`;

    const blobUrl = await uploadImageToBlob(
      base64,
      `books/${bookId}/${Date.now()}.png`,
    );

    const cover = await prisma.generatedBookCover.create({
      data: {
        blobUrl,
        bookId,
        userId,
        prompt: revisedPrompt || prompt,
      },
    });

    return { image: cover };
  } catch (err) {
    console.error(err);
    return { error: "Failed to generate image. Please try again." };
  }
}

export async function generateCharacterImage(
  bookId: string,
  characterId: string,
  options: { userPrompt?: string },
): Promise<{ image: GeneratedCharacterImage } | { error: string }> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return { error: "Unauthorized" };

    const userId = session.user.id;

    // const today = new Date();
    // today.setHours(0, 0, 0, 0);
    // const count = await prisma.generatedImage.count({
    //   where: { userId, createdAt: { gte: today } },
    // });
    // if (count >= 10) return { error: "Daily limit reached (10 images per day)" };

    const description = await prisma.characterDescription.findUnique({
      where: {
        bookId_characterId: {
          bookId,
          characterId,
        },
      },
    });

    if (!description) return { error: "Character description not found" };

    const prompt = buildCharacterImagePrompt(
      description.description,
      options.userPrompt,
    );

    const imageResult = await generateImage(prompt);

    if ("error" in imageResult) {
      return { error: imageResult.error };
    }

    const { base64, revisedPrompt } = imageResult;

    const filename = `books/${bookId}/char-${characterId}-${Date.now()}.png`;

    const blobUrl = await uploadImageToBlob(base64, filename);

    const characterImage = await prisma.generatedCharacterImage.create({
      data: {
        blobUrl,
        userId,
        characterId,
        prompt: revisedPrompt || prompt,
        bookId,
      },
    });

    return { image: characterImage };
  } catch (err) {
    console.error(err);
    return { error: "Failed to generate image. Please try again." };
  }
}

const MAX_UPLOAD_SIZE = 3 * 1024 * 1024; // 3 MB
const ALLOWED_UPLOAD_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
];

export async function uploadCharacterImage(
  bookId: string,
  formData: FormData,
): Promise<{ image: GeneratedCharacterImage } | { error: string }> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return { error: "Unauthorized" };

    const characterId = formData.get("characterId");
    const file = formData.get("file");

    if (typeof characterId !== "string" || !characterId) {
      return { error: "Character is required" };
    }
    if (!(file instanceof File) || file.size === 0) {
      return { error: "File is required" };
    }
    if (file.size > MAX_UPLOAD_SIZE) {
      return { error: "File must be 3 MB or smaller" };
    }
    if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) {
      return { error: "Only PNG, JPEG or WebP images are allowed" };
    }

    const userId = session.user.id;

    const character = await prisma.character.findUnique({
      where: { id: characterId },
      select: { id: true },
    });
    if (!character) return { error: "Character not found" };

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    const extFromType = file.type.split("/")[1] ?? "png";
    const filename = `books/${bookId}/char-${characterId}-${Date.now()}.${extFromType}`;

    const blobUrl = await uploadImageToBlob(base64, filename, file.type);

    const characterImage = await prisma.generatedCharacterImage.create({
      data: {
        blobUrl,
        userId,
        characterId,
        prompt: "User uploaded image",
        bookId,
      },
    });

    return { image: characterImage };
  } catch (err) {
    console.error(err);
    return { error: "Failed to upload image. Please try again." };
  }
}
