"use server";

import { headers } from "next/headers";
import { updateTag } from "next/cache";
import { auth } from "@/lib/auth";
import { uploadImageToBlob } from "@/lib/blob-storage";
import { prisma } from "@/lib/db";
import { HOME_FEED_TAG } from "@/lib/feed/tags";
import {
  createBookCover,
  createCharacterImage,
  saveCharacterImage,
} from "@/lib/images/service";
import {
  GeneratedBookCover,
  GeneratedCharacterImage,
} from "@/prisma/generated/client";

async function resolveUserId(explicit?: string): Promise<string | null> {
  if (explicit) return explicit;
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user.id ?? null;
}

export async function generateBookCover(
  bookId: string,
  options: { userPrompt?: string; userId?: string } = {},
): Promise<{ image: GeneratedBookCover } | { error: string }> {
  const userId = await resolveUserId(options.userId);
  if (!userId) return { error: "Unauthorized" };

  const result = await createBookCover(bookId, userId, options.userPrompt);
  if ("image" in result) updateTag(HOME_FEED_TAG);
  return result;
}

export async function generateCharacterImage(
  bookId: string,
  characterId: string,
  options: { userPrompt?: string; userId?: string } = {},
): Promise<{ image: GeneratedCharacterImage } | { error: string }> {
  const userId = await resolveUserId(options.userId);
  if (!userId) return { error: "Unauthorized" };

  const result = await createCharacterImage(
    bookId,
    characterId,
    userId,
    options.userPrompt,
  );
  if ("image" in result) updateTag(HOME_FEED_TAG);
  return result;
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

    const character = await prisma.character.findUnique({
      where: { id: characterId },
      select: { id: true },
    });
    if (!character) return { error: "Character not found" };

    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const extFromType = file.type.split("/")[1] ?? "png";
    const blobUrl = await uploadImageToBlob(
      base64,
      `books/${bookId}/char-${characterId}-${Date.now()}.${extFromType}`,
      file.type,
    );

    const image = await saveCharacterImage({
      blobUrl,
      userId: session.user.id,
      characterId,
      bookId,
      prompt: "User uploaded image",
    });
    updateTag(HOME_FEED_TAG);
    return { image };
  } catch (err) {
    console.error(err);
    return { error: "Failed to upload image. Please try again." };
  }
}
