-- CreateEnum
CREATE TYPE "CharacterTier" AS ENUM ('MAIN', 'SECONDARY', 'MINOR');

-- AlterTable
ALTER TABLE "Book" ADD COLUMN     "keyEvents" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "character_description" ADD COLUMN     "appearance" TEXT,
ADD COLUMN     "personality" TEXT,
ADD COLUMN     "role" TEXT,
ADD COLUMN     "tier" "CharacterTier" NOT NULL DEFAULT 'MINOR';

-- CreateIndex
CREATE INDEX "character_description_bookId_tier_idx" ON "character_description"("bookId", "tier");

