import { PopularBooks } from "@/components/PopularBooks";
import { HomeFeed, HomeFeedSkeleton } from "@/components/feed/home-feed";
import { Suspense } from "react";

export default function HomePage() {
  return (
    <main className="container mx-auto grid flex-1 gap-6 px-4 pt-12 pb-6 grid-cols-[3fr_1fr] lg:grid-rows-[auto_1fr]">
      <h1 className="text-4xl font-bold col-start-1 col-span-1">
        Books Reviews
      </h1>
      <div className="col-start-1 col-span-1 @container">
        <Suspense fallback={<HomeFeedSkeleton />}>
          <HomeFeed />
        </Suspense>
      </div>
      <h2 className="text-4xl font-bold col-start-2 col-span-1 row-start-1 row-span-1">
        Popular books
      </h2>
      <PopularBooks className="col-start-2 col-span-1 row-start-2 row-span-1" />
    </main>
  );
}
