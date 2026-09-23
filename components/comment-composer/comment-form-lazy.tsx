"use client";

import { Skeleton } from "@/components/ui/skeleton";
import dynamic from "next/dynamic";

export const CommentForm = dynamic(
  () => import("./comment-form").then((mod) => mod.CommentForm),
  {
    ssr: false,
    loading: () => <Skeleton className="h-32 w-full" />,
  },
);
