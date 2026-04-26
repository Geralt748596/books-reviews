"use client";

import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Props = {
  liked: boolean;
  likesCount: number;
  action: () => Promise<{ isLiked: boolean }>;
};

export function LikeButtonBase({ action, ...initialState }: Props) {
  const [isPending, startTransition] = useTransition();
  const [likeState, setLikeState] =
    useState<Omit<Props, "action">>(initialState);
  const [optimistic, setOptimistic] = useOptimistic(likeState, (state) => ({
    liked: !state.liked,
    likesCount: state.liked ? state.likesCount - 1 : state.likesCount + 1,
  }));

  const handleClick = () => {
    startTransition(async () => {
      setOptimistic(likeState);
      action()
        .then(({ isLiked }) => {
          setLikeState((prev) => ({
            liked: isLiked,
            likesCount: prev.likesCount + (isLiked ? 1 : -1),
          }));
        })
        .catch(() => {
          setLikeState({ ...likeState });
          toast.error("Failed to like cover");
        });
    });
  };

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={handleClick}
      disabled={isPending}
      className="gap-1 text-white/80 hover:text-white hover:bg-white/10 w-fit px-2"
    >
      <Heart
        className={cn(
          "size-4 transition-all",
          optimistic.liked && "fill-red-500 text-red-500 scale-110",
        )}
      />
      {optimistic.likesCount > 0 && (
        <span className="text-xs tabular-nums">{optimistic.likesCount}</span>
      )}
    </Button>
  );
}
