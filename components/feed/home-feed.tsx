import { FeedList } from "@/components/feed/feed-list";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getHomeFeedPage } from "@/lib/actions/home-feed";
import { HOME_FEED_PAGE_SIZE } from "@/lib/feed/types";

export async function HomeFeed() {
  const page = await getHomeFeedPage();

  return <FeedList initialItems={page.items} initialCursor={page.nextCursor} />;
}

export function HomeFeedSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
      {Array.from({ length: HOME_FEED_PAGE_SIZE / 2 }).map((_, index) => (
        <Card className="flex-row gap-3 overflow-hidden p-3" key={index}>
          <Skeleton className="-m-3 mr-0 w-28 shrink-0 self-stretch rounded-none sm:w-32" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex items-center gap-2">
              <Skeleton className="size-10 rounded-full" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <div className="mt-auto flex items-center justify-between">
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-7 w-12" />
            </div>
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-7 w-full" />
          </div>
        </Card>
      ))}
    </div>
  );
}
