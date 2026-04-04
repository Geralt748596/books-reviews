import "dotenv/config"
import prisma from "../lib/db"

async function testDatabase() {
  console.log("Testing Prisma Postgres connection...\n")

  try {
    await prisma.$queryRaw`SELECT 1`
    const userCount = await prisma.user.count()
    const bookCount = await prisma.book.count()
    console.log("Connected.")
    console.log(`Users: ${userCount}, books: ${bookCount}`)
    console.log("\nDatabase check passed.\n")
  } catch (error) {
    console.error("Error:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

void testDatabase()
