"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLayoutEffect, useRef, useState } from "react";

const COLLAPSED_LINES = "line-clamp-4";

export function BookDescription({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const paragraphRef = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const paragraph = paragraphRef.current;
    if (!paragraph || expanded) return;
    setOverflows(paragraph.scrollHeight > paragraph.clientHeight + 1);
  }, [text, expanded]);

  return (
    <div>
      <p
        ref={paragraphRef}
        className={cn(
          "text-muted-foreground leading-relaxed font-sans text-lg italic",
          !expanded && COLLAPSED_LINES,
        )}
      >
        {text}
      </p>
      {overflows ? (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="mt-2 h-auto px-0"
          aria-expanded={expanded}
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? "Show less" : "Read more"}
        </Button>
      ) : null}
    </div>
  );
}
