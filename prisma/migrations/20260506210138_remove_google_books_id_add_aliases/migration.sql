/*
  Warnings:

  - You are about to drop the column `googleBooksId` on the `Book` table. All the data in the column will be lost.
  - You are about to drop the column `bookId` on the `Character` table. All the data in the column will be lost.
  - You are about to drop the column `createdById` on the `Character` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `Character` table. All the data in the column will be lost.
  - You are about to drop the `GeneratedImage` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Character" DROP CONSTRAINT "Character_bookId_fkey";

-- DropForeignKey
ALTER TABLE "Character" DROP CONSTRAINT "Character_createdById_fkey";

-- DropForeignKey
ALTER TABLE "GeneratedImage" DROP CONSTRAINT "GeneratedImage_bookId_fkey";

-- DropForeignKey
ALTER TABLE "GeneratedImage" DROP CONSTRAINT "GeneratedImage_characterId_fkey";

-- DropForeignKey
ALTER TABLE "GeneratedImage" DROP CONSTRAINT "GeneratedImage_userId_fkey";

-- DropIndex
DROP INDEX "Book_googleBooksId_idx";

-- DropIndex
DROP INDEX "Book_googleBooksId_key";

-- DropIndex
DROP INDEX "Character_bookId_idx";

-- AlterTable
ALTER TABLE "Book" DROP COLUMN "googleBooksId",
ADD COLUMN     "bookSeriesId" TEXT;

-- AlterTable
ALTER TABLE "Character" DROP COLUMN "bookId",
DROP COLUMN "createdById",
DROP COLUMN "description",
ADD COLUMN     "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- DropTable
DROP TABLE "GeneratedImage";

-- CreateTable
CREATE TABLE "book_series" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "book_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "characterId" TEXT,

    CONSTRAINT "post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character_description" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "characterId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,

    CONSTRAINT "character_description_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedBookCover" (
    "id" TEXT NOT NULL,
    "blobUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "prompt" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "GeneratedBookCover_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cover_comment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "coverId" TEXT NOT NULL,

    CONSTRAINT "cover_comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cover_like" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "coverId" TEXT NOT NULL,

    CONSTRAINT "cover_like_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character_image_like" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,

    CONSTRAINT "character_image_like_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character_image_comment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "characterImageId" TEXT NOT NULL,

    CONSTRAINT "character_image_comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedCharacterImage" (
    "id" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "blobUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,

    CONSTRAINT "GeneratedCharacterImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_BookToCharacter" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_BookToCharacter_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "book_series_name_idx" ON "book_series"("name");

-- CreateIndex
CREATE INDEX "post_userId_idx" ON "post"("userId");

-- CreateIndex
CREATE INDEX "post_createdAt_idx" ON "post"("createdAt");

-- CreateIndex
CREATE INDEX "character_description_characterId_bookId_idx" ON "character_description"("characterId", "bookId");

-- CreateIndex
CREATE UNIQUE INDEX "character_description_bookId_characterId_key" ON "character_description"("bookId", "characterId");

-- CreateIndex
CREATE INDEX "GeneratedBookCover_bookId_idx" ON "GeneratedBookCover"("bookId");

-- CreateIndex
CREATE INDEX "cover_comment_coverId_createdAt_idx" ON "cover_comment"("coverId", "createdAt");

-- CreateIndex
CREATE INDEX "cover_like_coverId_idx" ON "cover_like"("coverId");

-- CreateIndex
CREATE UNIQUE INDEX "cover_like_userId_coverId_key" ON "cover_like"("userId", "coverId");

-- CreateIndex
CREATE INDEX "character_image_like_characterId_idx" ON "character_image_like"("characterId");

-- CreateIndex
CREATE UNIQUE INDEX "character_image_like_userId_characterId_key" ON "character_image_like"("userId", "characterId");

-- CreateIndex
CREATE INDEX "character_image_comment_characterImageId_createdAt_idx" ON "character_image_comment"("characterImageId", "createdAt");

-- CreateIndex
CREATE INDEX "GeneratedCharacterImage_userId_idx" ON "GeneratedCharacterImage"("userId");

-- CreateIndex
CREATE INDEX "GeneratedCharacterImage_characterId_idx" ON "GeneratedCharacterImage"("characterId");

-- CreateIndex
CREATE INDEX "GeneratedCharacterImage_bookId_idx" ON "GeneratedCharacterImage"("bookId");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedCharacterImage_bookId_characterId_key" ON "GeneratedCharacterImage"("bookId", "characterId");

-- CreateIndex
CREATE INDEX "_BookToCharacter_B_index" ON "_BookToCharacter"("B");

-- AddForeignKey
ALTER TABLE "Book" ADD CONSTRAINT "Book_bookSeriesId_fkey" FOREIGN KEY ("bookSeriesId") REFERENCES "book_series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post" ADD CONSTRAINT "post_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post" ADD CONSTRAINT "post_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post" ADD CONSTRAINT "post_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_description" ADD CONSTRAINT "character_description_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_description" ADD CONSTRAINT "character_description_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedBookCover" ADD CONSTRAINT "GeneratedBookCover_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedBookCover" ADD CONSTRAINT "GeneratedBookCover_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cover_comment" ADD CONSTRAINT "cover_comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cover_comment" ADD CONSTRAINT "cover_comment_coverId_fkey" FOREIGN KEY ("coverId") REFERENCES "GeneratedBookCover"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cover_like" ADD CONSTRAINT "cover_like_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cover_like" ADD CONSTRAINT "cover_like_coverId_fkey" FOREIGN KEY ("coverId") REFERENCES "GeneratedBookCover"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_image_like" ADD CONSTRAINT "character_image_like_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_image_like" ADD CONSTRAINT "character_image_like_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "GeneratedCharacterImage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_image_comment" ADD CONSTRAINT "character_image_comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_image_comment" ADD CONSTRAINT "character_image_comment_characterImageId_fkey" FOREIGN KEY ("characterImageId") REFERENCES "GeneratedCharacterImage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedCharacterImage" ADD CONSTRAINT "GeneratedCharacterImage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedCharacterImage" ADD CONSTRAINT "GeneratedCharacterImage_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedCharacterImage" ADD CONSTRAINT "GeneratedCharacterImage_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BookToCharacter" ADD CONSTRAINT "_BookToCharacter_A_fkey" FOREIGN KEY ("A") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BookToCharacter" ADD CONSTRAINT "_BookToCharacter_B_fkey" FOREIGN KEY ("B") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
