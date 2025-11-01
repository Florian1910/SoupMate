import { Skeleton } from "./ui/skeleton";

export function RecipeSkeleton() {
  return (
    <div className="space-y-4 pb-6 animate-pulse">
      {/* User Query Skeleton */}
      <div className="flex justify-end">
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl px-4 py-3 max-w-2xl">
          <Skeleton className="h-5 w-48 bg-primary/20" />
        </div>
      </div>

      {/* Recipe Card Skeleton */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-primary/10 p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-8 w-3/4 bg-gradient-to-r from-primary/20 to-primary/10" />
            <div className="flex items-center gap-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-28" />
            </div>
          </div>
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-32" />
        </div>

        {/* Content */}
        <div className="space-y-2 pt-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </div>
      </div>
    </div>
  );
}
