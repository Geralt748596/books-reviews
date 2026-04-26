"use client";

import { ComponentProps } from "react";
import { LikeButtonBase } from "./like-button-base";
import { toggleCharacterLike } from "@/lib/actions/character-like";

export function CharacterLike({
  liked,
  likesCount,
  characterId,
}: Omit<ComponentProps<typeof LikeButtonBase>, "action"> & {
  characterId: string;
}) {
  return (
    <LikeButtonBase
      liked={liked}
      likesCount={likesCount}
      action={toggleCharacterLike.bind(null, characterId)}
    />
  );
}
