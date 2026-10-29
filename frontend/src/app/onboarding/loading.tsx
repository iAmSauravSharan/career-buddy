import { Skeleton } from "@/components/ui/skeleton";

export default function OnboardingLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6" aria-label="Loading setup">
      <div className="flex w-full max-w-6xl overflow-hidden rounded-xl border border-border bg-surface md:min-h-[680px]">
        <div className="hidden w-[340px] space-y-6 border-r border-border bg-surface-hover/50 p-8 md:block">
          <Skeleton className="h-7 w-40" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-3"><Skeleton className="size-9 rounded-lg" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-28" /><Skeleton className="h-3 w-44" /></div></div>
          ))}
        </div>
        <div className="mx-auto flex w-full max-w-[440px] flex-col justify-center gap-4 p-10">
          <Skeleton className="mx-auto size-11 rounded-xl" />
          <Skeleton className="mx-auto h-9 w-64" />
          <Skeleton className="h-11 w-full rounded-lg" />
          <Skeleton className="h-11 w-full rounded-lg" />
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
