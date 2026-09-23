import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function CharacterCardSkeleton() {
  return (
    <div className="shrink-0 w-[90%] md:w-72 lg:w-80">
      <div className="flex h-full w-full flex-col gap-4">
        <div className="relative aspect-2/3 w-full px-6 pt-4 pb-2">
          <Skeleton className="absolute inset-x-6 inset-y-4 rounded-lg" />
        </div>
        <Card className="flex-1">
          <CardHeader className="gap-2">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}

export function CharacterListRowSkeleton() {
  return (
    <div className="flex items-center gap-4">
      <Skeleton className="h-20 w-14 shrink-0 rounded-md" />
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="ml-auto size-8 rounded-md" />
    </div>
  );
}

export function CharactersSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="w-full overflow-x-auto px-4 py-2">
      <div className="flex gap-4 md:min-w-max">
        {Array.from({ length: count }, (_, index) => (
          <CharacterCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}
