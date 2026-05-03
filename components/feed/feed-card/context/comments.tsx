import { FeedItem } from "@/lib/feed/types";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useState,
  useTransition,
} from "react";
import { useForm, UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";
import {
  addCharacterImageComment,
  addCoverComment,
  getComments,
  type PaginatedComment,
} from "@/lib/actions/comments";

type CommentsContextType = {
  item: FeedItem;
  commentsCount: number;
  lastComment: FeedItem["lastComment"] | null;
  comments: PaginatedComment[];
  hasMore: boolean;
  isLoadingComments: boolean;
  loadComments: () => void;
  loadMore: () => void;
  form: UseFormReturn<z.infer<typeof formSchema>>;
  isPending: boolean;
  handleSubmitComment: (data: z.infer<typeof formSchema>) => void;
};

export const CommentsContext = createContext<CommentsContextType>({
  commentsCount: 0,
  lastComment: null,
  item: {} as FeedItem,
  comments: [],
  hasMore: false,
  isLoadingComments: false,
  loadComments: () => {},
  loadMore: () => {},
  form: {} as UseFormReturn<z.infer<typeof formSchema>>,
  isPending: false,
  handleSubmitComment: () => {},
});

const formSchema = z.object({
  comment: z
    .string()
    .min(1, "Comment is required")
    .max(300, "Comment must be less than 300 characters"),
});

export const CommentsProvider = ({
  children,
  item,
}: PropsWithChildren<{ item: FeedItem }>) => {
  const [commentsCount, setCommentsCount] = useState(item.commentsCount);
  const [lastComment, setLastComment] = useState(item.lastComment);
  const [isPending, startTransition] = useTransition();

  const [comments, setComments] = useState<PaginatedComment[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingComments, startLoadTransition] = useTransition();
  const [loaded, setLoaded] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    defaultValues: { comment: "" },
    resolver: zodResolver(formSchema),
  });

  const loadComments = useCallback(() => {
    if (loaded) return;
    startLoadTransition(async () => {
      try {
        const page = await getComments(item.id, item.type);
        setComments(page.items);
        setNextCursor(page.nextCursor);
        setHasMore(!!page.nextCursor);
        setLoaded(true);
      } catch {
        toast.error("Failed to load comments.");
      }
    });
  }, [loaded, item.id, item.type]);

  const loadMore = useCallback(() => {
    if (!nextCursor) return;
    startLoadTransition(async () => {
      try {
        const page = await getComments(item.id, item.type, nextCursor);
        setComments((prev) => [...prev, ...page.items]);
        setNextCursor(page.nextCursor);
        setHasMore(!!page.nextCursor);
      } catch {
        toast.error("Failed to load more comments.");
      }
    });
  }, [nextCursor, item.id, item.type]);

  const handleSubmitComment = (data: z.infer<typeof formSchema>) => {
    const { comment } = data;
    const text = comment.trim();
    if (!text) return;

    startTransition(async () => {
      try {
        const action =
          item.type === "cover"
            ? addCoverComment(item.id, text)
            : addCharacterImageComment(item.id, text);

        const newComment = await action;
        setLastComment(newComment);
        setCommentsCount((c) => c + 1);

        if (loaded) {
          setComments((prev) => [
            {
              id: crypto.randomUUID(),
              content: newComment.content,
              createdAt: new Date().toISOString(),
              user: newComment.user,
            },
            ...prev,
          ]);
        }

        form.reset();
      } catch {
        toast.error("Failed to add comment.");
      }
    });
  };

  const value = {
    commentsCount,
    lastComment,
    item,
    comments,
    hasMore,
    isLoadingComments,
    loadComments,
    loadMore,
    form,
    isPending,
    handleSubmitComment,
  };

  return (
    <CommentsContext.Provider value={value}>
      {children}
    </CommentsContext.Provider>
  );
};

export function useComments() {
  return useContext(CommentsContext);
}
