"use client";

import { GeneratedBookCover } from "@/prisma/generated/browser";
import Image from "next/image";
import { useState } from "react";
import { motion, PanInfo } from "framer-motion";

type Props = {
  covers: Pick<GeneratedBookCover, "id" | "blobUrl">[];
};

export function CoversCarousel({ covers }: Props) {
  const [cards, setCards] = useState(covers);

  const moveToEnd = () => {
    setCards((prev) => {
      const newCards = [...prev];
      const first = newCards.shift();
      if (first) newCards.push(first);
      return newCards;
    });
  };

  const handleDragEnd = (
    _: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    if (offset < -100 || velocity < -500 || offset > 100 || velocity > 500) {
      moveToEnd();
    }
  };

  if (cards.length === 0) return null;

  return (
    <div className="relative w-full max-w-88 aspect-2/3 flex items-center justify-center perspective-1000 ml-[10%]">
      {cards.map((card, index) => {
        const isTop = index === 0;

        // Calculate visual offset for cards in the stack
        // Top card is 0, next is 1, etc.
        const stackIndex = index;
        const maxVisible = 4;

        // Hide cards deep in the stack
        if (stackIndex >= maxVisible) {
          return <div key={card.id} className="hidden"></div>;
        }

        return (
          <motion.div
            key={card.id}
            layout
            className="absolute w-full h-full rounded-lg overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8),0_0_20px_rgba(var(--primary),0.15)] bg-muted origin-right cursor-grab active:cursor-grabbing"
            style={{
              zIndex: cards.length - index,
            }}
            initial={{
              scale: 1 - stackIndex * 0.05,
              x: `-${stackIndex * 10}%`,
              opacity: 1 - stackIndex * 0.2,
            }}
            animate={{
              scale: 1 - stackIndex * 0.05,
              x: `-${stackIndex * 10}%`,
              opacity: 1 - stackIndex * 0.2,
            }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 20,
            }}
            whileHover={isTop ? { scale: 1.05 } : undefined}
            drag={isTop ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={1}
            dragSnapToOrigin
            onDragEnd={isTop ? handleDragEnd : undefined}
          >
            <Image
              src={card.blobUrl}
              alt="Book Cover"
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover pointer-events-none"
              loading={index === 0 ? "eager" : "lazy"}
            />
          </motion.div>
        );
      })}
    </div>
  );
}
