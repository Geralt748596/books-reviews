import { Button } from "@/components/ui/button";
import prisma from "@/lib/db";
import { Suspense } from "react";

export default function BooksPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <BooksContent />
    </Suspense>
  );
}

async function BooksContent() {
  const books = await getBooks();
  return (
    <div>
      {books.map((book) => (
        <div key={book.id}>{book.title}</div>
      ))}
      <form
        action={async () => {
          "use server";
          const a = await tata();
          console.log(a);
        }}
      >
        <Button type="submit">Tata</Button>
      </form>
    </div>
  );
}
async function getBooks() {
  console.log("getBoks");
  return await prisma.book.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: 10,
  });
}

async function tata() {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return {
    data: "tata",
  };
}
