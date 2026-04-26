import { getPopularBooks } from "@/components/PopularBooks/actions";
import { Suspense, ViewTransition } from "react";
import { Skeleton } from "../ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { cacheLife } from "next/cache";

type Props = {
  className?: string;
} & React.ComponentProps<"div">;

export const PopularBooks = ({ className, ...props }: Props) => {
  return (
    <div className={cn("flex flex-col gap-4", className)} {...props}>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <PopularBooksContent />
      </Suspense>
    </div>
  );
};

async function PopularBooksContent() {
  "use cache";
  cacheLife("hours");
  const books = await getPopularBooks();

  if (books.length === 0) {
    return <p className="text-muted-foreground">No popular books found.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {books.map((book) => (
        <Link
          key={book.id}
          href={`/books/${book.id}`}
          transitionTypes={["nav-forward"]}
          className="block h-full"
        >
          <Card className="hover:bg-muted/50 flex-row transition-colors p-2 border-none">
            {/* Book Info */}
            <CardContent className="p-0 flex justify-center">
              {book.thumbnailUrl ? (
                <div className="p-1 aspect-3/4 overflow-hidden flex items-center justify-center">
                  <Image
                    src={book.thumbnailUrl}
                    alt={book.title}
                    width={80}
                    height={140}
                    className="object-cover rounded-[5px]"
                  />
                </div>
              ) : null}
            </CardContent>
            <CardHeader className="p-0 pb-2 w-full">
              <CardTitle className="line-clamp-2 text-left">
                {book.title}
              </CardTitle>
              <CardDescription className="line-clamp-1 text-sm text-left">
                {book.authors}
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      ))}
      <Link href="/books" className="block w-full">
        <Button className="w-full">View All</Button>
      </Link>
    </div>
  );
}
