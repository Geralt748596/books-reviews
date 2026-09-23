export const HOME_FEED_PAGE_SIZE = 12;

/** Вид элемента ленты. `id` элемента — это id строки FeedItem, id источника лежит в payload. */
export type FeedItemKind = "cover" | "character_image" | "book_added" | "post";

/** Цели комментариев и лайков: только у обложек и картинок персонажей. */
export type CommentTargetType = "cover" | "character";

/** Keyset-курсор по строке FeedItem: (createdAt desc, id desc). */
export type FeedCursor = {
  createdAt: string;
  id: string;
};

export type FeedUser = {
  id: string;
  name: string;
  image: string | null;
};

export type FeedBook = {
  id: string;
  title: string;
  authors: string;
  thumbnailUrl: string | null;
};

export type FeedComment = {
  user: { name: string; image: string | null };
  content: string;
};

type FeedBase = {
  id: string;
  kind: FeedItemKind;
  createdAt: string;
  /** null для системных событий (книга добавлена). */
  actor: FeedUser | null;
  book: FeedBook;
};

export type ImagePayload = {
  id: string;
  blobUrl: string;
  likesCount: number;
  isLiked: boolean;
  commentsCount: number;
  lastComment: FeedComment | null;
};

export type CoverFeedItem = FeedBase & {
  kind: "cover";
  cover: ImagePayload;
};

export type CharacterImageFeedItem = FeedBase & {
  kind: "character_image";
  image: ImagePayload & { character: { id: string; name: string } };
};

export type BookAddedFeedItem = FeedBase & {
  kind: "book_added";
  excerpt: string | null;
};

export type PostFeedItem = FeedBase & {
  kind: "post";
  post: {
    id: string;
    /** HTML, санитизированный при записи в createPost. */
    contentHtml: string;
    character: { id: string; name: string } | null;
  };
};

export type FeedItem =
  CoverFeedItem | CharacterImageFeedItem | BookAddedFeedItem | PostFeedItem;

export type FeedPage = {
  items: FeedItem[];
  nextCursor: FeedCursor | null;
};
