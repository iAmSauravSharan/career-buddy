"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronRight, Gauge, Search } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { UsageMeter } from "@/components/usage-meter";
import { navItemFor } from "@/lib/nav-items";

// Desktop top bar: where you are (breadcrumb), a quick-find trigger, and the
// small utilities that used to crowd the sidebar (AI usage, theme).
export function TopBar() {
  const pathname = usePathname();
  const item = navItemFor(pathname);
  const Icon = item?.icon;
  const deeper = item && pathname !== item.href;

  return (
    <header className="sticky top-0 z-30 hidden h-16 items-center gap-4 border-b border-border bg-background/85 px-6 backdrop-blur-md md:flex">
      <nav aria-label="Breadcrumb" className="min-w-0">
        <ol className="flex items-center gap-2 text-sm">
          {item && (
            <>
              <li className="text-faint">{item.group}</li>
              <li aria-hidden className="text-faint">/</li>
              <li className="flex min-w-0 items-center gap-1.5 font-medium text-foreground" aria-current={deeper ? undefined : "page"}>
                {Icon && <Icon className="size-4 shrink-0 text-faint" />}
                {deeper ? (
                  <a href={item.href} className="truncate hover:underline">{item.label}</a>
                ) : (
                  <span className="truncate">{item.label}</span>
                )}
              </li>
              {deeper && (
                <>
                  <li aria-hidden><ChevronRight className="size-3.5 text-faint" /></li>
                  <li className="truncate text-muted" aria-current="page">Details</li>
                </>
              )}
            </>
          )}
        </ol>
      </nav>

      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event("co-quick-find"))}
        className="ml-auto flex h-9 w-full max-w-xs items-center gap-2.5 rounded-lg border border-border bg-surface px-3 text-sm text-faint transition-colors hover:border-foreground/20 hover:text-muted"
      >
        <Search className="size-4" aria-hidden />
        <span className="flex-1 text-left">Quick find…</span>
        <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-xs">Ctrl K</kbd>
      </button>

      <div className="flex items-center gap-1">
        <UsagePopover />
        <ThemeToggle />
      </div>
    </header>
  );
}

function UsagePopover() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="AI usage"
        title="AI usage"
        className="inline-flex items-center justify-center rounded-md p-1.5 text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
      >
        <Gauge className="size-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-64 rounded-xl border border-border bg-surface p-4 shadow-xl">
          <p className="mb-2 text-sm font-medium text-foreground">AI usage</p>
          <UsageMeter />
          <p className="mt-2 text-xs text-faint">Tokens used by your AI CLI in the last 5 hours and 7 days.</p>
        </div>
      )}
    </div>
  );
}
