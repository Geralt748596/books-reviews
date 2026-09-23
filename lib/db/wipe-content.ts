import prisma from "@/lib/db";

export type WipeContentResult = {
  feedItems: number;
  characterImageComments: number;
  characterImageLikes: number;
  coverComments: number;
  coverLikes: number;
  generatedCharacterImages: number;
  generatedBookCovers: number;
  characterDescriptions: number;
  posts: number;
  reviews: number;
  books: number;
  characters: number;
  bookSeries: number;
  sessions: number;
  verifications: number;
};

/**
 * Удаляет содержимое базы, оставляя пользователей и их аккаунты.
 * Сессии и коды верификации тоже удаляются: активные входы сбрасываются.
 */
export async function wipeContent(): Promise<WipeContentResult> {
  const [
    feedItems,
    characterImageComments,
    characterImageLikes,
    coverComments,
    coverLikes,
    generatedCharacterImages,
    generatedBookCovers,
    characterDescriptions,
    posts,
    reviews,
    books,
    characters,
    bookSeries,
    sessions,
    verifications,
  ] = await prisma.$transaction([
    prisma.feedItem.deleteMany(),
    prisma.characterImageComment.deleteMany(),
    prisma.characterImageLike.deleteMany(),
    prisma.coverComment.deleteMany(),
    prisma.coverLike.deleteMany(),
    prisma.generatedCharacterImage.deleteMany(),
    prisma.generatedBookCover.deleteMany(),
    prisma.characterDescription.deleteMany(),
    prisma.post.deleteMany(),
    prisma.review.deleteMany(),
    prisma.book.deleteMany(),
    prisma.character.deleteMany(),
    prisma.bookSeries.deleteMany(),
    prisma.session.deleteMany(),
    prisma.verification.deleteMany(),
  ]);

  return {
    feedItems: feedItems.count,
    characterImageComments: characterImageComments.count,
    characterImageLikes: characterImageLikes.count,
    coverComments: coverComments.count,
    coverLikes: coverLikes.count,
    generatedCharacterImages: generatedCharacterImages.count,
    generatedBookCovers: generatedBookCovers.count,
    characterDescriptions: characterDescriptions.count,
    posts: posts.count,
    reviews: reviews.count,
    books: books.count,
    characters: characters.count,
    bookSeries: bookSeries.count,
    sessions: sessions.count,
    verifications: verifications.count,
  };
}
