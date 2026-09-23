-- CreateEnum
CREATE TYPE "FeedItemType" AS ENUM ('COVER', 'CHARACTER_IMAGE', 'BOOK_ADDED', 'POST');

-- CreateTable
CREATE TABLE "feed_item" (
    "id" TEXT NOT NULL,
    "type" "FeedItemType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actorId" TEXT,
    "bookId" TEXT NOT NULL,
    "coverId" TEXT,
    "characterImageId" TEXT,
    "postId" TEXT,

    CONSTRAINT "feed_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "feed_item_coverId_key" ON "feed_item"("coverId");

-- CreateIndex
CREATE UNIQUE INDEX "feed_item_characterImageId_key" ON "feed_item"("characterImageId");

-- CreateIndex
CREATE UNIQUE INDEX "feed_item_postId_key" ON "feed_item"("postId");

-- CreateIndex
CREATE INDEX "feed_item_createdAt_id_idx" ON "feed_item"("createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "feed_item_bookId_idx" ON "feed_item"("bookId");

-- CreateIndex
CREATE UNIQUE INDEX "feed_item_type_sourceId_key" ON "feed_item"("type", "sourceId");

-- AddForeignKey
ALTER TABLE "feed_item" ADD CONSTRAINT "feed_item_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_item" ADD CONSTRAINT "feed_item_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_item" ADD CONSTRAINT "feed_item_coverId_fkey" FOREIGN KEY ("coverId") REFERENCES "GeneratedBookCover"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_item" ADD CONSTRAINT "feed_item_characterImageId_fkey" FOREIGN KEY ("characterImageId") REFERENCES "GeneratedCharacterImage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_item" ADD CONSTRAINT "feed_item_postId_fkey" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

