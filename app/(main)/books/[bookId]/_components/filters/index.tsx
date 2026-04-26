"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { GalleryType } from "@/components/gallery/types";

type SortKey = "popular" | "recent";

type Option<T extends string> = { key: T; label: string };

const SORT_OPTIONS: Option<SortKey>[] = [
  { key: "popular", label: "More popular" },
  { key: "recent", label: "Most recent" },
];

const TYPE_OPTIONS: Option<GalleryType>[] = [
  { key: "covers", label: "Covers" },
  { key: "characters", label: "Characters" },
];

export function GalleryControlsSkeleton() {
  return (
    <div className="flex flex-wrap gap-2">
      <SegmentedControlSkeleton options={TYPE_OPTIONS} />
      <SegmentedControlSkeleton options={SORT_OPTIONS} />
    </div>
  );
}

export function GalleryControls() {
  return (
    <div className="flex flex-wrap gap-2">
      <SegmentedControl
        param="type"
        options={TYPE_OPTIONS}
        defaultKey="covers"
      />
      <SegmentedControl
        param="sort"
        options={SORT_OPTIONS}
        defaultKey="popular"
      />
    </div>
  );
}

function SegmentedControlSkeleton<T extends string>({
  options,
}: {
  options: Option<T>[];
}) {
  return (
    <div
      className="grid rounded-lg bg-white/5 p-1 animate-pulse"
      style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
    >
      {options.map(({ label }) => (
        <div
          key={label}
          className="px-3 py-1.5 text-center font-mono text-xs text-white/20"
        >
          {label}
        </div>
      ))}
    </div>
  );
}

function SegmentedControl<T extends string>({
  param,
  options,
  defaultKey,
}: {
  param: string;
  options: Option<T>[];
  defaultKey: T;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [, startTransition] = useTransition();

  const currentKey = (searchParams.get(param) as T) || defaultKey;
  const [optimisticKey, setOptimisticKey] = useOptimistic(currentKey);

  const activeIndex = options.findIndex((o) => o.key === optimisticKey);

  function handleSelect(key: T) {
    const params = new URLSearchParams(searchParams.toString());
    if (key === defaultKey) {
      params.delete(param);
    } else {
      params.set(param, key);
    }
    startTransition(() => {
      setOptimisticKey(key);
      router.replace(`?${params.toString()}`, { scroll: false });
    });
  }

  const getTransform = () => {
    if (activeIndex === options.length - 1 && activeIndex > 0) {
      return `translateX(calc(${activeIndex} * 100% + 8px))`;
    }
    return `translateX(calc(${activeIndex} * 100%))`;
  };

  return (
    <div
      className="relative grid rounded-lg bg-white/5 py-2"
      style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
    >
      <span
        className="absolute top-1 bottom-1 rounded-md bg-primary border border-white transition-transform duration-250 ease-in-out mx-1"
        style={{
          width: `calc(100% / ${options.length} - 8px)`,
          transform: getTransform(),
        }}
      />
      {options.map((opt) => (
        <button
          key={opt.key}
          onClick={() => handleSelect(opt.key)}
          className="relative z-10 px-3 py-1.5 rounded-md font-mono text-xs cursor-pointer transition-colors duration-200 data-[active=true]:text-white text-white/40 hover:text-white/70"
          data-active={optimisticKey === opt.key}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
