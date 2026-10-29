import { cn } from "@/lib/cn";

// The one container: a white card with a hairline border on the grey canvas.
// `elevated` lifts it for things that float (popovers, the first-score sheet).
export function Card({
  className,
  elevated,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { elevated?: boolean }) {
  return (
    <div
      className={cn(
        "relative rounded-xl border border-border bg-surface p-5 shadow-[0_1px_2px_rgb(15_17_21/0.04)]",
        elevated && "shadow-lg",
        className,
      )}
      {...props}
    />
  );
}

// Card heading row: title on the left, an optional action ("View all") on the right.
export function CardHeader({ title, action, className }: { title: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-4 flex items-center justify-between gap-3", className)}>
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {action}
    </div>
  );
}
