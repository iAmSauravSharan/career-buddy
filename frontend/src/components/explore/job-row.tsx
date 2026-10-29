"use client";

import { ChevronRight, ExternalLink } from "lucide-react";
import { CompanyLogo } from "@/components/company-logo";
import { cn } from "@/lib/cn";

// The one job row used by Find jobs (New for you and Search results): logo,
// role, company, two or three pills. Tapping the row opens the job's sheet,
// where every action lives, so the list itself stays quiet.

export function Pill({ tone = "muted", className, children }: { tone?: "muted" | "good" | "warn" | "bad" | "brand"; className?: string; children: React.ReactNode }) {
  const tones = {
    muted: "bg-surface-hover text-muted",
    good: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400",
    warn: "bg-amber-500/14 text-amber-800 dark:text-amber-300",
    bad: "bg-red-500/12 text-red-700 dark:text-red-400",
    brand: "bg-brand-soft text-brand-text",
  } as const;
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium leading-[18px]", tones[tone], className)}>{children}</span>;
}

export function JobRow({
  company,
  role,
  location,
  meta,
  onOpen,
  trailing,
  logo = true,
}: {
  company: string;
  role: string;
  location?: string;
  meta?: React.ReactNode;
  onOpen: () => void;
  /** Replaces the chevron, e.g. a quick "Not for me". */
  trailing?: React.ReactNode;
  /** false = monogram only, no /api/logo lookup (employer-preset results). */
  logo?: boolean;
}) {
  return (
    <li className="flex items-center gap-1 pr-1 transition-colors hover:bg-surface-hover/60">
      <button
        type="button"
        onClick={onOpen}
        aria-haspopup="dialog"
        className="flex min-w-0 flex-1 items-start gap-3 py-3.5 pl-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/40 sm:pl-4"
      >
        {logo ? (
          <CompanyLogo name={company} size={40} className="mt-0.5" />
        ) : (
          <span aria-hidden className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-[11px] bg-brand-soft text-sm font-semibold text-brand-text">
            {company.trim().charAt(0).toUpperCase() || "?"}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-heading text-foreground">{role}</span>
          <span className="block truncate text-[13px] leading-[18px] text-muted">
            {company}
            {location && <> · {location}</>}
          </span>
          {meta && <span className="mt-1.5 flex flex-wrap gap-1.5">{meta}</span>}
        </span>
      </button>
      {trailing ?? <ChevronRight aria-hidden className="mr-2 size-[18px] shrink-0 text-faint" />}
    </li>
  );
}

/** The bottom of every job sheet: the original posting, always last. */
export function PostingLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex min-h-[44px] items-center justify-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
    >
      Open original posting <ExternalLink className="size-3.5" />
    </a>
  );
}

/** Rows grouped under a small label, in one white card. */
export function JobGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 first:mt-0">
      <h2 className="mb-2 px-1 text-caption font-semibold text-faint">{label}</h2>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">{children}</ul>
    </section>
  );
}

export function agoLabel(age: number | null): string | null {
  if (age == null) return null;
  if (age <= 0) return "Today";
  if (age === 1) return "Yesterday";
  if (age < 7) return `${age} days ago`;
  if (age < 30) return `${Math.floor(age / 7)}w ago`;
  return `${Math.floor(age / 30)}mo ago`;
}

export function primaryButton(extra?: string) {
  return cn(
    "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-[15px] font-semibold text-brand-foreground transition-colors hover:bg-brand-200 disabled:opacity-50",
    extra,
  );
}
export function secondaryButton(extra?: string) {
  return cn(
    "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 text-[15px] font-semibold text-foreground transition-colors hover:bg-surface-hover disabled:opacity-50",
    extra,
  );
}
