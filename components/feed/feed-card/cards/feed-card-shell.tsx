"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import type { FeedUser } from "@/lib/feed/types";
import type { ReactNode } from "react";

type Props = {
  actor: FeedUser | null;
  createdAt: string;
  label: string;
  /** Левая колонка: картинка или обложка книги. */
  media?: ReactNode;
  children: ReactNode;
};

/** Общая рамка карточки ленты: медиа слева, шапка с автором, датой и бейджем. */
export function FeedCardShell({
  actor,
  createdAt,
  label,
  media,
  children,
}: Props) {
  const date = createdAt.slice(0, 10);

  return (
    <Card className="w-full flex-row gap-3 overflow-hidden p-3">
      {media}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          {actor ? (
            <>
              <UserAvatar user={actor} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{actor.name}</p>
                <p className="text-xs text-muted-foreground">{date}</p>
              </div>
            </>
          ) : (
            <p className="min-w-0 flex-1 text-xs text-muted-foreground">
              {date}
            </p>
          )}
          <Badge variant="outline" className="text-[10px] uppercase">
            {label}
          </Badge>
        </div>
        {children}
      </div>
    </Card>
  );
}
