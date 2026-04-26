"use client";

import { CharacterLike } from "@/components/gallery/components/character-like";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TypographyP } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion, PanInfo } from "framer-motion";
import Image from "next/image";
import { useState } from "react";

export type CharacterDeckImage = {
  id: string;
  blobUrl: string;
  user: { name: string | null };
  likesCount: number;
  isLiked: boolean;
};

type Props = {
  characterName: string;
  images: CharacterDeckImage[];
};

const STACK_OFFSETS = [
  { x: 0, y: 0, rotate: 0 },
  { x: 18, y: 10, rotate: 5 },
  { x: 30, y: 18, rotate: 8 },
];

const RANK_BADGE_CLASSES = [
  "border-amber-400/40 bg-amber-400/15 text-amber-300",
  "border-slate-300/40 bg-slate-300/15 text-slate-200",
  "border-orange-500/40 bg-orange-500/15 text-orange-300",
];

export function CharacterDeck({ characterName, images }: Props) {
  const [cards, setCards] = useState(() =>
    images.map((image, rankIndex) => ({ ...image, rankIndex })),
  );
  const [isDragging, setIsDragging] = useState(false);

  const moveToEnd = () => {
    setCards((prev) => {
      const next = [...prev];
      const first = next.shift();
      if (first) next.push(first);
      return next;
    });
  };

  const handleDragEnd = (
    _: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    setIsDragging(false);
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    if (offset < -100 || velocity < -500 || offset > 100 || velocity > 500) {
      moveToEnd();
    }
  };

  if (cards.length === 0) return null;

  const top = cards[0];
  const hasMultiple = cards.length > 1;

  return (
    <div className="flex flex-col gap-4 h-full w-full">
      <div className="relative w-full aspect-2/3 flex items-center justify-center px-6 pt-4 pb-2">
        {cards.map((card, index) => {
          const isTop = index === 0;
          const maxVisible = 3;

          if (index >= maxVisible) {
            return <div key={card.id} className="hidden" />;
          }

          const offset = STACK_OFFSETS[index] ?? STACK_OFFSETS[0];

          return (
            <motion.div
              key={card.id}
              layout
              className="absolute inset-x-6 inset-y-4 rounded-lg overflow-hidden shadow-[0_20px_40px_-15px_rgba(0,0,0,0.7)] ring-1 ring-border/60 bg-muted cursor-grab active:cursor-grabbing touch-pan-y"
              style={{ zIndex: cards.length - index }}
              initial={{
                scale: 1 - index * 0.04,
                x: offset.x,
                y: offset.y,
                rotate: offset.rotate,
                opacity: 1 - index * 0.15,
              }}
              animate={{
                scale: 1 - index * 0.04,
                x: offset.x,
                y: offset.y,
                rotate: offset.rotate,
                opacity: 1 - index * 0.15 - (isTop && isDragging ? 0.2 : 0),
              }}
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
              whileHover={isTop ? { scale: 1.03 } : undefined}
              drag={isTop && hasMultiple ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={1}
              onDragStart={isTop ? () => setIsDragging(true) : undefined}
              dragSnapToOrigin
              onDragEnd={isTop ? handleDragEnd : undefined}
            >
              <Image
                src={card.blobUrl}
                alt={characterName}
                fill
                sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                className="object-cover pointer-events-none select-none"
                loading={isTop ? "eager" : "lazy"}
                draggable={false}
              />
            </motion.div>
          );
        })}
      </div>

      <Card className="flex-1 box-border">
        <CardHeader>
          <CardTitle>{characterName}</CardTitle>
          <CardAction>
            <CharacterLike
              key={top.id}
              characterId={top.id}
              likesCount={top.likesCount}
              liked={top.isLiked}
            />
          </CardAction>
          <CardDescription className="min-h-6">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={top.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="flex items-center gap-2 flex-wrap"
              >
                <Badge
                  variant="outline"
                  className={cn(
                    "font-semibold",
                    RANK_BADGE_CLASSES[top.rankIndex],
                  )}
                >
                  Top {top.rankIndex + 1}
                </Badge>
                <span className="flex items-center gap-2">
                  Generated by:
                  <TypographyP className="text-primary">
                    {top.user.name}
                  </TypographyP>
                </span>
              </motion.span>
            </AnimatePresence>
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
