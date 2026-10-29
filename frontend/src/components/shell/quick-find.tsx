"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { allNavItems } from "@/lib/nav-items";

// Quick find (Ctrl/⌘ K): jump to any page by typing part of its name, an old
// name ("pipeline", "portals") or a synonym. Keyboard first: arrows move,
// Enter opens, Escape closes, and focus returns to whatever opened it.
export function QuickFind({ followupsEnabled }: { followupsEnabled: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  const items = useMemo(() => allNavItems(followupsEnabled), [followupsEnabled]);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => `${i.label} ${i.keywords ?? ""} ${i.group}`.toLowerCase().includes(q));
  }, [items, query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        opener.current = document.activeElement as HTMLElement | null;
        setOpen((o) => !o);
      }
    };
    const onOpen = () => {
      opener.current = document.activeElement as HTMLElement | null;
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("co-quick-find", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("co-quick-find", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      window.setTimeout(() => input.current?.focus(), 0);
    } else {
      opener.current?.focus?.();
    }
  }, [open]);

  useEffect(() => setIndex(0), [query]);

  if (!open) return null;

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center bg-black/40 p-4 pt-[12vh] backdrop-blur-[2px]" onMouseDown={() => setOpen(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Quick find"
        className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="size-4 shrink-0 text-faint" aria-hidden />
          <input
            ref={input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              else if (e.key === "ArrowDown") {
                e.preventDefault();
                setIndex((i) => Math.min(i + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setIndex((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter" && results[index]) {
                e.preventDefault();
                go(results[index].href);
              }
            }}
            role="combobox"
            aria-expanded="true"
            aria-controls="co-quick-find-list"
            aria-activedescendant={results[index] ? `co-qf-${index}` : undefined}
            placeholder="Go to a page…"
            className="h-12 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-faint focus-visible:outline-none"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-xs text-faint">Esc</kbd>
        </div>
        <ul id="co-quick-find-list" role="listbox" aria-label="Pages" className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">No page matches “{query}”.</li>}
          {results.map((item, i) => {
            const Icon = item.icon;
            return (
              <li
                key={item.href}
                id={`co-qf-${i}`}
                role="option"
                aria-selected={i === index}
                onMouseEnter={() => setIndex(i)}
                onClick={() => go(item.href)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm",
                  i === index ? "bg-surface-hover text-foreground" : "text-muted",
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="flex-1 font-medium">{item.label}</span>
                <span className="text-xs text-faint">{item.group}</span>
                {i === index && <CornerDownLeft className="size-3.5 text-faint" aria-hidden />}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
