"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BriefcaseBusiness, CalendarCheck, ExternalLink, Gift, Search, Scale, Sparkles } from "lucide-react";
import type { Application, InboxJob } from "@shared/types";
import type { DiscoveredOffer } from "@shared/explore";
import type { CardReason } from "@shared/machine-summary.mjs";
import { FollowUpCard, type FollowUp } from "@/components/home/follow-up-card";
import { DecisionCard } from "@/components/home/decision-card";
import { OnboardingProgress } from "@/components/home/onboarding-progress";
import { QuickEvaluate } from "@/components/quick-evaluate";
import { CompanyLogo } from "@/components/company-logo";
import { Card, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { scoreNum } from "@shared/format";
import { pickAwaitingDecision, groupAwaiting } from "@shared/home/awaiting.mjs";
import { resolveHeroState, mayClaimAllClear, missingSourceLabel, displayCounts } from "@/lib/home/hero-state.mjs";
import { greeting, homeStats } from "@/lib/home/stats.mjs";

// The dashboard: a greeting, four numbers, and at most three short lists of
// things that need a decision today. Everything else (full tables, analytics,
// settings) is one click away instead of on this page.
//
// The data loops are unchanged from the old "Today" view: follow-ups due
// (/api/followups) and fresh scan matches (/api/whats-new), refetched after
// every finished worker. hero-state.mjs still decides when the page may claim
// "all caught up", so a failed source never reads as an empty queue.
export function TodayDashboard({
  applications,
  reasons,
  legitimacy,
  inbox,
  inBetween,
  firstName,
}: {
  applications: Application[];
  reasons: Record<string, CardReason>;
  /** Block-G legitimacy per report number, read by the page from each report. */
  legitimacy: Record<string, string>;
  inbox: Pick<InboxJob, "url" | "done">[];
  inBetween: boolean;
  firstName?: string;
}) {
  const [followups, setFollowups] = useState<FollowUp[]>([]);
  const [overdue, setOverdue] = useState(0);
  const [followupsLoading, setFollowupsLoading] = useState(true);
  const [followupsError, setFollowupsError] = useState(false);
  const [followupsEnabled, setFollowupsEnabled] = useState(true);
  const [upcoming, setUpcoming] = useState<FollowUp[]>([]);
  const [fresh, setFresh] = useState<DiscoveredOffer[]>([]);
  const [freshCount, setFreshCount] = useState(0);
  const [freshLoading, setFreshLoading] = useState(true);
  const [freshError, setFreshError] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const requestGeneration = useRef(0);
  const router = useRouter();

  const refetch = useCallback(() => {
    const generation = ++requestGeneration.current;
    const isLatest = () => generation === requestGeneration.current;
    setFollowupsLoading(true);
    setFollowupsError(false);
    fetch("/api/followups")
      .then((r) => {
        if (!r.ok) throw new Error("Follow-ups request failed");
        return r.json();
      })
      .then((d) => {
        if (!isLatest()) return;
        // HTTP 200 with available:false is an engine failure, not an empty queue.
        if (d.available === false) throw new Error("Follow-ups unavailable");
        setFollowups(Array.isArray(d.entries) ? d.entries : []);
        setOverdue((d.metadata?.overdue ?? 0) + (d.metadata?.urgent ?? 0));
        setFollowupsEnabled(d.followupsEnabled !== false);
        setUpcoming(Array.isArray(d.upcoming) ? d.upcoming : []);
      })
      .catch(() => { if (isLatest()) setFollowupsError(true); })
      .finally(() => { if (isLatest()) setFollowupsLoading(false); });
    setFreshLoading(true);
    setFreshError(false);
    fetch("/api/whats-new")
      .then((r) => {
        if (!r.ok) throw new Error("Fresh matches request failed");
        return r.json();
      })
      .then((d) => {
        if (!isLatest()) return;
        const offers = Array.isArray(d.offers) ? d.offers : [];
        const count = Number(d.count);
        setFresh(offers);
        setFreshCount(Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : offers.length);
      })
      .catch(() => { if (isLatest()) setFreshError(true); })
      .finally(() => { if (isLatest()) setFreshLoading(false); });
  }, []);

  useEffect(() => {
    setNow(new Date());
    refetch();
    // A worker just wrote a tracker row: refresh the server snapshot and the loops.
    const onDone = () => {
      router.refresh();
      refetch();
    };
    window.addEventListener("co-job-done", onDone);
    return () => {
      window.removeEventListener("co-job-done", onDone);
      requestGeneration.current += 1;
    };
  }, [refetch, router]);

  const stats = useMemo(() => homeStats(applications), [applications]);
  const awaiting = useMemo(() => pickAwaitingDecision(applications, scoreNum), [applications]);
  // Flagged postings are grouped apart (#5300), so "Apply next" never points at one.
  const awaitingGroups = useMemo(() => groupAwaiting(awaiting, (a) => legitimacy[a.n]), [awaiting, legitimacy]);
  const recommended = awaitingGroups.find(([label]) => label === "Recommended")?.[1] ?? [];
  // Recommended first, then the rest in score order, two at most.
  const decideNow = useMemo(() => {
    const rest = awaiting.filter((a) => !recommended.includes(a));
    return [...recommended, ...rest].slice(0, 2);
  }, [awaiting, recommended]);

  const heroState = resolveHeroState({
    followupsLoading,
    freshLoading,
    followupsError,
    freshError,
    overdue,
    newThisWeek: freshCount,
    awaitingCount: awaiting.length,
  });
  const allClear = mayClaimAllClear(heroState);
  const missingSources = missingSourceLabel({ followupsError, freshError });
  const shown = displayCounts({ followupsError, freshError, overdue, newThisWeek: freshCount });
  const inboxUrls = useMemo(() => new Set(inbox.map((j) => j.url)), [inbox]);
  const dataLoading = followupsLoading || freshLoading;

  // The status line under the greeting. Its three fixed sentences are what the
  // loading-transition browser test asserts, so a failed source can never read
  // as "all caught up".
  const summary =
    heroState === "loading"
      ? "Your career queue is loading."
      : heroState === "unavailable"
        ? "Some updates are unavailable."
        : allClear
          ? "You're all caught up."
          : summaryLine(shown.overdue, shown.newThisWeek, awaiting.length);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8 max-sm:pb-24">
      {/* Greeting */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-faint" suppressHydrationWarning>
            {now ? now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) : " "}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">
            {now ? greeting(now.getHours()) : "Hello"}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p id="home-status" className="mt-1 text-[15px] text-muted" aria-live="polite">{summary}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/pipeline"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
          >
            Applications
          </Link>
          <Link
            href="/explore"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-200"
          >
            <Search className="size-4" /> Find jobs
          </Link>
        </div>
      </div>

      {/* Headline numbers */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard href="/pipeline?tab=ALL" icon={BriefcaseBusiness} value={stats.active} label="Active applications" />
        <StatCard href="/pipeline?tab=INTERVIEW" icon={CalendarCheck} value={stats.interviews} label="Interviewing" />
        <StatCard href="/pipeline?tab=OFFER" icon={Gift} value={stats.offers} label="Offers" />
        <StatCard href="/pipeline?tab=EVALUATED" icon={Scale} value={awaiting.length} label="To decide" />
      </div>

      {missingSources && !dataLoading && (
        <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-foreground">
          <p>{missingSources} could not be loaded. This page may be missing work.</p>
          <button type="button" onClick={refetch} className="font-medium text-brand-text underline-offset-2 hover:underline">
            Retry updates
          </button>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Main column: the three lists */}
        <div className="min-w-0 space-y-6">
          {followupsEnabled && (followupsLoading || followups.length > 0) && (
            <Card
              role="region"
              aria-label={followupsLoading ? "Loading follow-ups due" : "Follow-ups due"}
              aria-busy={followupsLoading || undefined}
            >
              <CardHeader
                title={<>Follow-ups due{followups.length > 0 && <Count n={followups.length} />}</>}
                action={<ViewAll href="/followups" label="View all follow-ups" />}
              />
              {followupsLoading ? (
                <RowsSkeleton />
              ) : (
                <div className="grid gap-2">
                  {followups.slice(0, 3).map((f) => (
                    <FollowUpCard key={`${f.num}-${f.company}`} followup={f} onLogged={refetch} />
                  ))}
                </div>
              )}
            </Card>
          )}

          {decideNow.length > 0 && (
            <Card>
              <CardHeader
                title={<>Ready to decide<Count n={awaiting.length} /></>}
                action={<ViewAll href="/pipeline?tab=EVALUATED" label="View all roles waiting for a decision" />}
              />
              <p className="-mt-2 mb-4 text-sm text-muted">Scored roles, best match first. Review one to apply or skip it.</p>
              <div className="grid gap-3 md:grid-cols-2">
                {decideNow.slice(0, 2).map((a) => (
                  <DecisionCard key={a.n} app={a} reason={reasons[a.n]} />
                ))}
              </div>
            </Card>
          )}

          {(freshLoading || fresh.length > 0) && !freshError && (
            <Card>
              <CardHeader
                title={<>New matches this week{freshCount > 0 && <Count n={freshCount} />}</>}
                action={<ViewAll href="/explore?view=fresh" label="See all new matches" />}
              />
              {freshLoading ? (
                <RowsSkeleton />
              ) : (
                <ul className="-mx-2 divide-y divide-border">
                  {fresh.slice(0, 5).map((o) => (
                    <MatchRow key={o.url} offer={o} saved={inboxUrls.has(o.url)} />
                  ))}
                </ul>
              )}
            </Card>
          )}

          {allClear && (
            <Card className="py-10 text-center">
              <Sparkles className="mx-auto size-6 text-brand" aria-hidden />
              <p className="mt-3 text-base font-medium text-foreground">Nothing needs you right now</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted">We&apos;ll keep scanning and surface anything that fits. Run a free scan any time, or check on your applications.</p>
              <Link href="/explore" className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-brand-foreground hover:bg-brand-200">
                Find jobs <ArrowRight className="size-4" />
              </Link>
            </Card>
          )}
        </div>

        {/* Side rail */}
        <aside className="min-w-0 space-y-6" aria-label="Overview">
          <OnboardingProgress />

          {inBetween && (
            <Card>
              <CardHeader title="Evaluate a job" />
              <p className="-mt-2 text-sm text-muted">Paste a posting link to score it against your profile.</p>
              <QuickEvaluate />
            </Card>
          )}

          <Card>
            <CardHeader title="Your pipeline" action={<ViewAll href="/analytics" label="Open analytics" text="Analytics" />} />
            <Funnel
              rows={[
                { label: "Scored", value: stats.evaluated + stats.applied, href: "/pipeline?tab=ALL" },
                { label: "Applied", value: stats.applied, href: "/pipeline?tab=APPLIED" },
                { label: "Heard back", value: stats.responded, href: "/pipeline?tab=RESPONDED" },
                { label: "Offers", value: stats.offers, href: "/pipeline?tab=OFFER" },
              ]}
            />
          </Card>

          {!followupsLoading && !followupsError && upcoming.length > 0 && (
            <Card>
              <CardHeader title="Coming up" action={<ViewAll href="/followups" label="View all follow-ups" />} />
              <ul className="space-y-3">
                {upcoming.slice(0, 4).map((item) => (
                  <li key={`${item.num ?? item.company}-${item.nextFollowupDate ?? ""}`}>
                    <Link href={item.num != null ? `/pipeline/${item.num}` : "/followups"} className="flex items-center gap-3 rounded-lg text-sm hover:underline">
                      <CompanyLogo name={item.company} size={24} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-foreground">{item.company}</span>
                        {item.role && <span className="block truncate text-xs text-muted">{item.role}</span>}
                      </span>
                      {item.nextFollowupDate && <span className="shrink-0 text-xs text-faint">{item.nextFollowupDate}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

function summaryLine(followupsDue: number, newMatches: number, toDecide: number): string {
  const parts: string[] = [];
  if (followupsDue > 0) parts.push(`${followupsDue} follow-up${followupsDue === 1 ? "" : "s"} due`);
  if (toDecide > 0) parts.push(`${toDecide} role${toDecide === 1 ? "" : "s"} to decide on`);
  if (newMatches > 0) parts.push(`${newMatches} new match${newMatches === 1 ? "" : "es"} this week`);
  if (parts.length === 0) return "Here's where your search stands.";
  const last = parts.pop();
  return `You have ${parts.length ? `${parts.join(", ")} and ${last}` : last}.`;
}

function Count({ n }: { n: number }) {
  return <span className="ml-2 rounded-full bg-surface-hover px-2 py-0.5 align-middle text-xs font-semibold tabular-nums text-muted">{n}</span>;
}

function ViewAll({ href, label, text = "View all" }: { href: string; label: string; text?: string }) {
  return (
    <Link href={href} aria-label={label} className="shrink-0 rounded text-sm font-medium text-brand-text underline-offset-2 hover:underline">
      {text}
    </Link>
  );
}

function MatchRow({ offer, saved }: { offer: DiscoveredOffer; saved: boolean }) {
  return (
    <li>
      <a
        href={offer.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-surface-hover"
      >
        <CompanyLogo name={offer.company} size={32} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">{offer.title}</span>
          <span className="block truncate text-sm text-muted">
            {offer.company}
            {offer.location && <> · {offer.location}</>}
          </span>
        </span>
        {offer.fit?.band === "strong" && (
          <span className="hidden shrink-0 rounded-full bg-emerald-500/12 px-2 py-0.5 text-xs font-medium text-emerald-800 sm:inline dark:text-emerald-300">Strong fit</span>
        )}
        {saved && <span className="hidden shrink-0 text-xs text-faint sm:inline">Saved</span>}
        <ExternalLink className="size-4 shrink-0 text-faint group-hover:text-foreground" aria-hidden />
        <span className="sr-only">(opens the posting in a new tab)</span>
      </a>
    </li>
  );
}

function Funnel({ rows }: { rows: { label: string; value: number; href: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <Link href={r.href} className="group block rounded">
            <span className="flex items-baseline justify-between text-sm">
              <span className="text-muted group-hover:text-foreground">{r.label}</span>
              <span className="font-semibold tabular-nums text-foreground">{r.value}</span>
            </span>
            <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-surface-hover" aria-hidden>
              <span className="block h-full rounded-full bg-brand" style={{ width: `${Math.max(r.value ? 4 : 0, Math.round((r.value / max) * 100))}%` }} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function RowsSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
