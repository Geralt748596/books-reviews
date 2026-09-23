"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LogLine } from "@/lib/analyzer/run-context";
import { toast } from "sonner";

interface LogConsoleProps {
  lines: Array<LogLine & { seq: number }>;
  gap?: boolean;
  className?: string;
}

const LEVEL_CLASS: Record<LogLine["level"], string> = {
  info: "text-foreground/90",
  phase: "text-primary font-semibold mt-2",
  success: "text-green-600 dark:text-green-400",
  warn: "text-amber-600 dark:text-amber-400",
  error: "text-destructive font-medium",
};

const LEVEL_MARK: Record<LogLine["level"], string> = {
  info: "",
  phase: "▶ ",
  success: "✔ ",
  warn: "⚠ ",
  error: "✖ ",
};

export function LogConsole({ lines, gap, className }: LogConsoleProps) {
  const [stick, setStick] = useState(true);
  const [onlyImportant, setOnlyImportant] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!stick || !boxRef.current) return;
    boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [lines.length, stick]);

  const visible = onlyImportant
    ? lines.filter((l) => l.level !== "info")
    : lines;

  const copy = async () => {
    const text = lines
      .map((l) => `${l.ts} ${LEVEL_MARK[l.level]}${l.text}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Лог скопирован");
    } catch {
      toast.error("Не удалось скопировать");
    }
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">
          {lines.length.toLocaleString("ru-RU")} строк
          {gap ? " · часть ранних строк вытеснена из буфера" : ""}
        </span>
        <div className="ml-auto flex gap-2">
          <Button
            variant={onlyImportant ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setOnlyImportant((v) => !v)}
          >
            Только важное
          </Button>
          <Button
            variant={stick ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setStick((v) => !v)}
          >
            К концу
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={copy}
            disabled={lines.length === 0}
          >
            Копировать
          </Button>
        </div>
      </div>
      <div
        ref={boxRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          const atBottom =
            el.scrollHeight - el.scrollTop - el.clientHeight < 24;
          if (!atBottom && stick) setStick(false);
        }}
        className="h-[28rem] overflow-y-auto rounded-md border bg-muted/40 p-3 font-mono text-xs leading-5"
      >
        {visible.length === 0 ? (
          <div className="text-muted-foreground">Ожидание вывода…</div>
        ) : (
          visible.map((line) => (
            <div
              key={line.seq}
              className={cn(
                "whitespace-pre-wrap break-words",
                LEVEL_CLASS[line.level],
              )}
            >
              <span className="mr-2 select-none text-muted-foreground/70">
                {new Date(line.ts).toLocaleTimeString("ru-RU", {
                  hour12: false,
                })}
              </span>
              {LEVEL_MARK[line.level]}
              {line.text.trimStart()}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
