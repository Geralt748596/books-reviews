export const HOME_FEED_PAGE_SIZE = 12;

export type FeedItemType = "cover" | "character";

export type FeedCursor = {
  type: FeedItemType;
  id: string;
  createdAt: string;
};

type FeedUser = {
  id: string;
  name: string;
  image: string | null;
};

type FeedBook = {
  id: string;
  title: string;
  authors: string;
  thumbnailUrl: string | null;
};

type FeedComment = {
  user: { name: string; image: string | null };
  content: string;
};

type FeedBaseItem = {
  id: string;
  type: FeedItemType;
  prompt: string;
  blobUrl: string;
  createdAt: string;
  user: FeedUser;
  book: FeedBook;
  likesCount: number;
  isLiked: boolean;
  commentsCount: number;
  lastComment: FeedComment | null;
};

export type CoverFeedItem = FeedBaseItem & {
  type: "cover";
};

export type CharacterFeedItem = FeedBaseItem & {
  type: "character";
  character: {
    id: string;
    name: string;
  };
};

export type FeedItem = CoverFeedItem | CharacterFeedItem;

export type FeedPage = {
  items: FeedItem[];
  nextCursor: FeedCursor | null;
};
