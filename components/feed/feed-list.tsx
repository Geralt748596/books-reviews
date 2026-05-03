"use client";

import { FeedCard } from "@/components/feed/feed-card";
import { Button } from "@/components/ui/button";
import { getHomeFeedPage } from "@/lib/actions/home-feed";
import type { FeedCursor, FeedItem } from "@/lib/feed/types";
import { useState, useTransition } from "react";
import { toast } from "sonner";

type Props = {
  initialItems: FeedItem[];
  initialCursor: FeedCursor | null;
};

export function FeedList({ initialItems, initialCursor }: Props) {
  const [items, setItems] = useState(initialItems);
  const [nextCursor, setNextCursor] = useState(initialCursor);
  const [isPending, startTransition] = useTransition();

  const handleLoadMore = () => {
    if (!nextCursor) return;

    startTransition(async () => {
      try {
        const page = await getHomeFeedPage(nextCursor);
        setItems((prev) => [...prev, ...page.items]);
        setNextCursor(page.nextCursor);
      } catch {
        toast.error("Failed to load more feed items.");
      }
    });
  };

  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 bg-muted/30 p-8 text-center text-muted-foreground">
        No generated images yet.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      <div className="contents">
        {items.map((item) => (
          <FeedCard key={`${item.type}-${item.id}`} item={item} />
        ))}
      </div>

      {nextCursor ? (
        <div className="mt-2 flex justify-center xl:col-span-2">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={handleLoadMore}
            disabled={isPending}
          >
            {isPending ? "Loading..." : "Load more"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
