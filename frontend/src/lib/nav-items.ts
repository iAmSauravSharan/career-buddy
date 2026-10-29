import {
  LayoutDashboard,
  Search,
  BriefcaseBusiness,
  Send,
  Building2,
  BarChart3,
  FileText,
  Files,
  Settings,
  CalendarClock,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";

// Single source of truth for the app's destinations: the desktop sidebar, the
// mobile drawer, the top-bar breadcrumb and the quick-find palette all read it.
export type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Words the quick-find palette also matches (old names, synonyms). */
  keywords?: string;
};

export type NavGroup = { label: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "General",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard, keywords: "today home" },
      { href: "/explore", label: "Find jobs", icon: Search, keywords: "explore discover search roles" },
      { href: "/pipeline", label: "Applications", icon: BriefcaseBusiness, keywords: "pipeline tracker reports" },
    ],
  },
  {
    label: "Tracking",
    items: [
      { href: "/followups", label: "Follow-ups", icon: Send, keywords: "reminders nudge" },
      { href: "/scheduled-scans", label: "Scheduled scans", icon: CalendarClock, keywords: "automation cron" },
      { href: "/portals", label: "Companies", icon: Building2, keywords: "portals boards watched" },
    ],
  },
  {
    label: "Insights",
    items: [{ href: "/analytics", label: "Analytics", icon: BarChart3, keywords: "stats funnel" }],
  },
  {
    label: "Profile",
    items: [
      { href: "/cv", label: "My CV", icon: FileText, keywords: "resume" },
      { href: "/documents", label: "Documents", icon: Files, keywords: "files cover letters" },
    ],
  },
];

/** Pinned to the bottom of the sidebar, apart from the groups. */
export const SETTINGS_ITEM: NavItem = { href: "/config", label: "Settings", icon: Settings, keywords: "config cli preferences" };

/** Pages reachable from the palette and breadcrumb but not listed in the sidebar. */
const EXTRA_PAGES: NavItem[] = [{ href: "/onboarding", label: "Set up your profile", icon: LayoutDashboard, keywords: "onboarding details preferences" }];

export function visibleNavGroups(followupsEnabled: boolean): NavGroup[] {
  if (followupsEnabled) return NAV_GROUPS;
  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((item) => item.href !== "/followups") }));
}

/** Every destination, flat: sidebar groups, then settings, then extra pages. */
export function allNavItems(followupsEnabled: boolean): (NavItem & { group: string })[] {
  return [
    ...visibleNavGroups(followupsEnabled).flatMap((g) => g.items.map((i) => ({ ...i, group: g.label }))),
    { ...SETTINGS_ITEM, group: "Account" },
    ...EXTRA_PAGES.map((i) => ({ ...i, group: "Account" })),
  ];
}

export function isActivePath(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** The nav entry a path belongs to (longest match), for the breadcrumb. */
export function navItemFor(pathname: string): (NavItem & { group: string }) | undefined {
  return allNavItems(true)
    .filter((i) => isActivePath(i.href, pathname))
    .sort((a, b) => b.href.length - a.href.length)[0];
}
