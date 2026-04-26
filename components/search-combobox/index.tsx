"use client";

import { Skeleton } from "@/components/ui/skeleton";
import dynamic from "next/dynamic";

export const SearchComboboxClient = dynamic(
  () => import("./search-combobox").then((c) => c.SearchCombobox),
  {
    ssr: false,
    loading: () => <Skeleton className="h-8 w-[280px] rounded-full bg-muted" />,
  },
);
