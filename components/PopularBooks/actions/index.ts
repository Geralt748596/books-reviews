import prisma from "@/lib/db";

export async function getPopularBooks() {
  return await prisma.book.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: 10,
  });
}
