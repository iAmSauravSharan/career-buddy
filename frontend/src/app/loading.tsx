import { Skeleton } from "@/components/ui/skeleton";

// Same shape as the dashboard (greeting, four numbers, list + side rail), so
// nothing jumps when the data arrives.
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8 max-sm:pb-24" aria-label="Loading dashboard">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-2 h-8 w-72" />
      <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4">
            <Skeleton className="size-10 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-12" />
              <Skeleton className="h-3.5 w-28" />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-surface p-5">
              <Skeleton className="h-5 w-40" />
              <div className="mt-5 space-y-4">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="flex items-center gap-3">
                    <Skeleton className="size-8 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3.5 w-1/2" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-surface p-5">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="mt-3 h-2 w-full rounded-full" />
            <Skeleton className="mt-5 h-10 w-full rounded-lg" />
          </div>
          <div className="rounded-xl border border-border bg-surface p-5">
            <Skeleton className="h-5 w-28" />
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="mt-4 h-2 w-full rounded-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
