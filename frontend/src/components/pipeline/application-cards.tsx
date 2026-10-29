"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Application } from "@shared/types";
import { canonStatus, scoreNum } from "@shared/format";
import { CompanyLogo } from "@/components/company-logo";
import { Pill, agoLabel } from "@/components/explore/job-row";
import { companyPresentation } from "@/lib/company-presentation.mjs";
import { tabLabel } from "@/lib/pipeline-tab-labels.mjs";
import { cn } from "@/lib/cn";

// The Applications list as cards, grouped by what happens next. Each card is a
// link to the application; every action (stage, CV, apply) lives there, so the
// list stays quiet.

type Group = { key: string; label: string; stages: string[]; folded?: boolean };

const GROUPS: Group[] = [
  { key: "offer", label: "Offers", stages: ["OFFER"] },
  { key: "progress", label: "In progress", stages: ["RESPONDED", "ASSESSMENT", "INTERVIEW"] },
  { key: "decide", label: "Needs your decision", stages: ["EVALUATED"] },
  { key: "waiting", label: "Waiting to hear back", stages: ["APPLIED"] },
  { key: "closed", label: "Closed", stages: ["HIRED", "REJECTED", "DISCARDED", "SKIP"], folded: true },
];

export function stageOf(app: Application): string {
  const c = canonStatus(app.status);
  return GROUPS.flatMap((g) => g.stages).find((s) => c.includes(s)) ?? "EVALUATED";
}

function daysSince(date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}/.test(date)) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(date.slice(0, 10) + "T00:00:00").getTime()) / 86_400_000));
}

function fit(score: string): { text: string; tone: "good" | "brand" | "muted" | "bad" } | null {
  const n = scoreNum(score);
  if (Number.isNaN(n)) return null;
  const s = n.toFixed(1);
  if (n >= 4.2) return { text: `${s} · Strong fit`, tone: "good" };
  if (n >= 3.8) return { text: `${s} · Good fit`, tone: "brand" };
  if (n >= 3.0) return { text: `${s} · Mixed fit`, tone: "muted" };
  return { text: `${s} · Weak fit`, tone: "bad" };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function followUpPill(followUp: string) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(followUp)) return null;
  const due = new Date(followUp.slice(0, 10) + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (due <= today) return <Pill tone="brand">{due < today ? "Follow-up overdue" : "Follow up today"}</Pill>;
  // Fixed month names: a locale-formatted date differs between server and browser.
  return <Pill>Follow up {MONTHS[due.getMonth()]} {due.getDate()}</Pill>;
}

function CardMeta({ app }: { app: Application }) {
  const stage = stageOf(app);
  const f = fit(app.score);
  const ago = agoLabel(daysSince(app.date));
  if (stage === "EVALUATED") return f ? <Pill tone={f.tone}>{f.text}</Pill> : <Pill>Not scored</Pill>;
  if (stage === "APPLIED")
    return (
      <>
        <Pill>Applied{ago ? ` ${ago.toLowerCase()}` : ""}</Pill>
        {followUpPill(app.followUp)}
      </>
    );
  if (stage === "OFFER") return <Pill tone="good">Offer</Pill>;
  return (
    <>
      <Pill tone={["RESPONDED", "ASSESSMENT", "INTERVIEW"].includes(stage) ? "brand" : "muted"}>{tabLabel(stage)}</Pill>
      {f && <Pill>{f.text}</Pill>}
    </>
  );
}

function AppCard({ app, href }: { app: Application; href: string }) {
  const company = companyPresentation(app);
  return (
    <li>
      <Link
        href={href}
        className="flex items-start gap-3 py-3.5 pl-3 pr-2 outline-none transition-colors hover:bg-surface-hover/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/40 sm:pl-4"
      >
        <CompanyLogo name={company.logoName} size={40} className="mt-0.5" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-heading text-foreground">{app.role}</span>
          <span className="block truncate text-[13px] leading-[18px] text-muted">
            {company.label}
            {app.location && <> · {app.location}</>}
          </span>
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            <CardMeta app={app} />
          </span>
        </span>
        <ChevronRight aria-hidden className="mt-3 size-[18px] shrink-0 text-faint" />
      </Link>
    </li>
  );
}

function CardGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 first:mt-0">
      <h2 className="mb-2 px-1 text-caption font-semibold text-faint">{label}</h2>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">{children}</ul>
    </section>
  );
}

export function ApplicationCards({
  rows,
  grouped,
  hrefFor,
  stageLabel,
}: {
  rows: Application[];
  /** true on "All": group by next action. false: one flat list for the chosen stage. */
  grouped: boolean;
  hrefFor: (app: Application) => string;
  stageLabel: string;
}) {
  const [showClosed, setShowClosed] = useState(false);

  if (!grouped) {
    return (
      <CardGroup label={stageLabel}>
        {rows.map((r) => <AppCard key={r.n} app={r} href={hrefFor(r)} />)}
      </CardGroup>
    );
  }

  return (
    <div>
      {GROUPS.map((g) => {
        const items = rows.filter((r) => g.stages.includes(stageOf(r)));
        if (items.length === 0) return null;
        if (g.folded && !showClosed) {
          return (
            <button
              key={g.key}
              type="button"
              onClick={() => setShowClosed(true)}
              aria-expanded={false}
              className="mt-6 inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-surface text-sm font-medium text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              Show {items.length} closed <ChevronDown className="size-4" />
            </button>
          );
        }
        return (
          <CardGroup key={g.key} label={`${g.label} · ${items.length}`}>
            {items.map((r) => <AppCard key={r.n} app={r} href={hrefFor(r)} />)}
          </CardGroup>
        );
      })}
    </div>
  );
}

/** One scrolling row of stage chips. Rare stages only appear once they hold something. */
export function StageChips({
  tabs,
  active,
  count,
  onPick,
  activeRef,
}: {
  tabs: readonly string[];
  active: string;
  count: (t: string) => number;
  onPick: (t: string) => void;
  activeRef?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <div role="group" aria-label="Filter by stage" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
      {tabs.map((t) => {
        const on = active === t;
        return (
          <button
            key={t}
            type="button"
            ref={on ? activeRef : undefined}
            aria-pressed={on}
            onClick={() => onPick(t)}
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors",
              on ? "border-foreground bg-foreground text-background" : "border-border bg-surface text-muted hover:border-foreground/30 hover:text-foreground",
            )}
          >
            {tabLabel(t)} <span className={cn("tabular-nums", on ? "text-background/75" : "text-faint")}>{count(t)}</span>
          </button>
        );
      })}
    </div>
  );
}
