import { CommentForm } from "@/components/comment-composer/comment-form-lazy";
import { renderCommentHtml } from "@/components/comment-composer/render-comment-html";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { getDiscussionPosts } from "@/lib/actions/posts";
import { getSession } from "@/lib/actions/session";
import Link from "next/link";

type Props = {
  bookId: string;
  characterId?: string;
};

const commentDate = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});

export async function CommentComposer({ bookId, characterId }: Props) {
  const [session, posts] = await Promise.all([
    getSession(),
    getDiscussionPosts(bookId, characterId),
  ]);

  return (
    <section className="flex flex-col gap-6 border-t border-border/50 pt-16">
      <div className="flex flex-col gap-2">
        <h2 className="text-xs font-bold tracking-[0.1em] text-primary uppercase">
          Comments
        </h2>
        <p className="text-sm text-muted-foreground">
          {characterId
            ? "Share what you think about this character."
            : "Comment on the book, or attach the note to a character."}
        </p>
      </div>

      {session ? (
        <CommentForm bookId={bookId} characterId={characterId} />
      ) : (
        <p className="text-sm text-muted-foreground">
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>{" "}
          to leave a comment.
        </p>
      )}

      {posts.length ? (
        <ul className="flex flex-col gap-4">
          {posts.map((post) => (
            <li key={post.id} className="flex gap-3">
              <UserAvatar user={post.user} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{post.user.name}</span>
                  <time
                    dateTime={post.createdAt}
                    className="text-xs text-muted-foreground"
                  >
                    {commentDate.format(new Date(post.createdAt))}
                  </time>
                  {post.character && !characterId ? (
                    <Badge variant="secondary">{post.character.name}</Badge>
                  ) : null}
                </div>
                <CommentBody bookId={bookId} content={post.content} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      )}
    </section>
  );
}

function CommentBody({ bookId, content }: { bookId: string; content: string }) {
  if (!content.trimStart().startsWith("<")) {
    return (
      <p className="mt-1 text-sm whitespace-pre-wrap text-muted-foreground">
        {content}
      </p>
    );
  }

  return (
    <div className="mt-1 text-sm text-muted-foreground">
      {renderCommentHtml(content, bookId)}
    </div>
  );
}

export function CommentComposerSkeleton() {
  return (
    <div className="flex flex-col gap-4 border-t border-border/50 pt-16">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}
