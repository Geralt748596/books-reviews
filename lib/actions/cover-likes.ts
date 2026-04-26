"use server";

import { prisma } from "@/lib/db";
import { getSessionOrThrow } from "@/lib/actions/session";
import { revalidateTag } from "next/cache";
// import { revalidatePath } from "next/cache";

export async function toggleCoverLike(coverId: string, bookId: string) {
  const session = await getSessionOrThrow();
  const userId = session.user.id;

  const existing = await prisma.coverLike.findUnique({
    where: { userId_coverId: { userId, coverId } },
  });

  if (existing) {
    await prisma.coverLike.delete({ where: { id: existing.id } });
    return {
      isLiked: false,
    };
  } else {
    await prisma.coverLike.create({ data: { userId, coverId } });
    return {
      isLiked: true,
    };
  }
}
