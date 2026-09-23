"use client";

import type { FeedItem } from "@/lib/feed/types";
import { BookAddedCard } from "./cards/book-added-card";
import { ImageCard } from "./cards/image-card";
import { PostCard } from "./cards/post-card";

export function FeedCard({ item }: { item: FeedItem }) {
  switch (item.kind) {
    case "cover":
    case "character_image":
      return <ImageCard item={item} />;
    case "book_added":
      return <BookAddedCard item={item} />;
    case "post":
      return <PostCard item={item} />;
  }
}
