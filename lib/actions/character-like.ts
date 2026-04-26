"use server";

import { prisma } from "@/lib/db";
import { getSessionOrThrow } from "@/lib/actions/session";

export async function toggleCharacterLike(characterId: string) {
  const session = await getSessionOrThrow();
  const userId = session.user.id;

  const existing = await prisma.characterImageLike.findUnique({
    where: { userId_characterId: { userId, characterId } },
  });

  if (existing) {
    await prisma.characterImageLike.delete({ where: { id: existing.id } });
    return {
      isLiked: false,
    };
  } else {
    await prisma.characterImageLike.create({ data: { userId, characterId } });
    return {
      isLiked: true,
    };
  }
}
