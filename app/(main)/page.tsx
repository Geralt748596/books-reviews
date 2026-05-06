import { PopularBooks } from "@/components/PopularBooks";
import { HomeFeed, HomeFeedSkeleton } from "@/components/feed/home-feed";
import { Suspense } from "react";

import classes from "./classes.module.css";

export default function HomePage() {
  return (
    <main className="container mx-auto grid flex-1 grid-cols-1 gap-6 px-4 pt-12 pb-6 lg:grid-cols-[3fr_1fr] lg:grid-rows-[auto_1fr]">
      <div className="min-w-0 grid gap-6 lg:row-span-2 lg:grid-rows-subgrid">
        <h1 className="text-4xl font-bold">Books Reviews</h1>
        <Suspense fallback={<HomeFeedSkeleton />}>
          <HomeFeed />
        </Suspense>
        <Test />
      </div>
      <aside className="hidden lg:row-span-2 lg:grid lg:grid-rows-subgrid lg:gap-6">
        <h2 className="text-4xl font-bold">Popular books</h2>
        <PopularBooks className="sticky top-[80px]" />
      </aside>
    </main>
  );
}

function Test() {
  return (
    <div className={classes.test}>
      <ul>
        <li>
          <a href="#">first</a>
        </li>
        <li>
          <a href="#">second</a>
        </li>
        <li>
          <a href="#">third</a>
        </li>
      </ul>
    </div>
  );
}
