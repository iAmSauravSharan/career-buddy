import Link from "next/link";
import { ChevronRight } from "lucide-react";

// A headline number: icon, value, label. The whole card is the link, and the
// accessible name reads "24 Active applications" rather than two loose strings.
export function StatCard({
  href,
  icon: Icon,
  value,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  value: number | string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-xl border border-border bg-surface p-4 shadow-[0_1px_2px_rgb(15_17_21/0.04)] transition-colors hover:border-foreground/20 hover:bg-surface-hover/60"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-text">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-2xl font-semibold leading-tight tabular-nums text-foreground">{value}</span>
        <span className="block truncate text-sm text-muted">{label}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-faint transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}
