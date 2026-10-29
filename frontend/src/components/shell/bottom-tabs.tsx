"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BriefcaseBusiness, Home, Menu, Search, Send } from "lucide-react";
import { cn } from "@/lib/cn";
import { isActivePath } from "@/lib/nav-items";
import { useJobs } from "@/components/jobs/job-store";
import { setMenuOpen, useMenuOpen } from "@/lib/menu-store";

// Phone navigation (< md): the four places you visit daily as tabs, and More
// for everything else. More opens the menu drawer (MobileNav), which lists
// every page (shared open state: lib/menu-store). From md up the sidebar replaces this bar.
//
// Its height is --tabbar-h (globals.css), so <main> and the floating controls
// stay clear of it, home-indicator inset included.

type Tab = { href: string; label: string; icon: typeof Home };

export function primaryTabs(followupsEnabled: boolean): Tab[] {
  const tabs: Tab[] = [
    { href: "/", label: "Home", icon: Home },
    { href: "/explore", label: "Find jobs", icon: Search },
    { href: "/pipeline", label: "Applications", icon: BriefcaseBusiness },
  ];
  if (followupsEnabled) tabs.push({ href: "/followups", label: "Follow-ups", icon: Send });
  return tabs;
}

export function BottomTabs({ followupsEnabled }: { followupsEnabled: boolean }) {
  const pathname = usePathname();
  const tabs = primaryTabs(followupsEnabled);
  const onTab = tabs.some((t) => isActivePath(t.href, pathname));
  const { jobs } = useJobs();
  const running = jobs.some((j) => j.status === "running");
  const menuOpen = useMenuOpen();

  const item = "flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium leading-none transition-colors";

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 flex h-[var(--tabbar-h)] border-t border-border bg-surface/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = isActivePath(href, pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(item, active ? "font-semibold text-brand-text" : "text-faint hover:text-foreground")}
          >
            <Icon className="size-[22px]" strokeWidth={active ? 2.2 : 1.9} aria-hidden />
            {label}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={() => setMenuOpen(true)}
        aria-expanded={menuOpen}
        aria-haspopup="dialog"
        className={cn(item, "relative", !onTab ? "font-semibold text-brand-text" : "text-faint hover:text-foreground")}
      >
        <Menu className="size-[22px]" strokeWidth={!onTab ? 2.2 : 1.9} aria-hidden />
        More
        {running && <span aria-hidden className="co-pulse absolute right-[calc(50%-18px)] top-2 size-2 rounded-full bg-brand ring-2 ring-surface" />}
      </button>
    </nav>
  );
}
