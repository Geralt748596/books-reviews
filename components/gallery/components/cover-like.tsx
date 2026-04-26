"use client";

import { ComponentProps } from "react";
import { LikeButtonBase } from "./like-button-base";
import { toggleCoverLike } from "@/lib/actions/cover-likes";

export function CoverLike({
  liked,
  likesCount,
  coverId,
  bookId,
}: Omit<ComponentProps<typeof LikeButtonBase>, "action"> & {
  coverId: string;
  bookId: string;
}) {
  return (
    <LikeButtonBase
      liked={liked}
      likesCount={likesCount}
      action={toggleCoverLike.bind(null, coverId, bookId)}
    />
  );
}
