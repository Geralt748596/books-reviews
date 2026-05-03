import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, MessageCircle, SendHorizonal } from "lucide-react";
import { useComments } from "@/components/feed/feed-card/context/comments";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { PaginatedComment } from "@/lib/actions/comments";

export const Comments = () => {
  const { lastComment, form, handleSubmitComment, isPending } = useComments();

  return (
    <div className="flex w-full flex-col gap-1.5">
      {lastComment && (
        <p className="line-clamp-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {lastComment.user.name}
          </span>{" "}
          {lastComment.content}
        </p>
      )}
      <CommentForm
        form={form}
        onSubmit={handleSubmitComment}
        isPending={isPending}
      />
    </div>
  );
};

function CommentForm({
  form,
  onSubmit,
  isPending,
}: {
  form: ReturnType<typeof useComments>["form"];
  onSubmit: ReturnType<typeof useComments>["handleSubmitComment"];
  isPending: boolean;
}) {
  return (
    <Form {...form}>
      <form
        className="flex items-center gap-1.5"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <FormField
          control={form.control}
          name="comment"
          disabled={isPending}
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormControl>
                <Input
                  placeholder="Add a comment..."
                  className="h-7 flex-1 text-xs"
                  autoComplete="off"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          disabled={isPending || !form.formState.isDirty}
        >
          <SendHorizonal className="size-3.5" />
        </Button>
      </form>
    </Form>
  );
}

function CommentItem({ comment }: { comment: PaginatedComment }) {
  return (
    <div className="flex gap-2.5">
      <Avatar className="size-7 shrink-0">
        <AvatarFallback className="text-[10px]">
          {comment.user.name.slice(0, 2)}
        </AvatarFallback>
        <AvatarImage src={comment.user.image || ""} />
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-medium">{comment.user.name}</span>
          <span className="text-[10px] text-muted-foreground">
            {new Date(comment.createdAt).toLocaleDateString()}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{comment.content}</p>
      </div>
    </div>
  );
}

export const CommentsCountButton = () => {
  const {
    commentsCount,
    comments,
    hasMore,
    isLoadingComments,
    loadComments,
    loadMore,
    form,
    handleSubmitComment,
    isPending,
  } = useComments();

  return (
    <Dialog onOpenChange={(open) => open && loadComments()}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="flex w-fit items-center gap-1 px-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <MessageCircle className="size-3.5" />
            {commentsCount > 0 && <span>{commentsCount}</span>}
          </Button>
        }
      />
      <DialogContent className="flex max-h-[80vh] flex-col sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Comments{commentsCount > 0 && ` (${commentsCount})`}
          </DialogTitle>
        </DialogHeader>

        <div className="-mx-4 flex-1 overflow-y-auto px-4">
          {isLoadingComments && comments.length === 0 ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : comments.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No comments yet. Be the first!
            </p>
          ) : (
            <div className="flex flex-col gap-4 pb-2">
              {comments.map((c) => (
                <CommentItem key={c.id} comment={c} />
              ))}
              {hasMore && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="self-center"
                  onClick={loadMore}
                  disabled={isLoadingComments}
                >
                  {isLoadingComments ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Load more"
                  )}
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="-mx-4 -mb-4 border-t px-4 pt-3 pb-4">
          <CommentForm
            form={form}
            onSubmit={handleSubmitComment}
            isPending={isPending}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
