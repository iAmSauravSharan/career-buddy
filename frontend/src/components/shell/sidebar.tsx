"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/cn";
import { CoMark } from "@/components/co-mark";
import { WorkerPills } from "@/components/jobs/worker-pills";
import { isActivePath, SETTINGS_ITEM, visibleNavGroups, type NavItem } from "@/lib/nav-items";

const COLLAPSED_KEY = "career-buddy:sidebar-collapsed";

// Desktop sidebar (md and up): grouped destinations, settings pinned to the
// bottom, and a collapse toggle that shrinks it to an icon rail. The mobile
// drawer (mobile-nav.tsx) lists the same groups.
export function Sidebar({ followupsEnabled }: { followupsEnabled: boolean }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "1");
    } catch {
      /* no storage: stay expanded */
    }
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, c ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !c;
    });
  };

  return (
    <aside
      aria-label="Main"
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 md:flex",
        collapsed ? "w-[72px]" : "w-64",
      )}
    >
      <div className={cn("flex h-16 items-center border-b border-border", collapsed ? "justify-center px-2" : "gap-2.5 px-5")}>
        <Link href="/" className="flex items-center gap-2.5 rounded-lg" aria-label="career-buddy, go to dashboard">
          <CoMark size={30} />
          {!collapsed && <span className="text-[17px] font-semibold tracking-tight text-foreground">career-buddy</span>}
        </Link>
        {!collapsed && (
          <button
            type="button"
            onClick={toggle}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            className="ml-auto rounded-md p-1.5 text-faint transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <PanelLeftClose className="size-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Primary">
        {collapsed && (
          <button
            type="button"
            onClick={toggle}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="mb-3 flex w-full items-center justify-center rounded-lg py-2 text-faint transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <PanelLeftOpen className="size-4" />
          </button>
        )}
        {visibleNavGroups(followupsEnabled).map((group, gi) => (
          <div key={group.label} className={cn(gi > 0 && "mt-5")}>
            {collapsed ? (
              gi > 0 && <div className="mx-3 mb-3 border-t border-border" aria-hidden />
            ) : (
              <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-[0.08em] text-faint">{group.label}</p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.href}>
                  <NavLink item={item} active={isActivePath(item.href, pathname)} collapsed={collapsed} />
                </li>
              ))}
            </ul>
          </div>
        ))}
        {!collapsed && <WorkerPills />}
      </nav>

      <div className="border-t border-border px-3 py-3">
        <NavLink item={SETTINGS_ITEM} active={isActivePath(SETTINGS_ITEM.href, pathname)} collapsed={collapsed} />
      </div>
    </aside>
  );
}

function NavLink({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-lg text-sm font-medium transition-colors",
        collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2",
        active ? "bg-brand-soft text-brand-text" : "text-muted hover:bg-surface-hover hover:text-foreground",
      )}
    >
      {active && !collapsed && <span aria-hidden className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-brand" />}
      <Icon className="size-[18px] shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}
