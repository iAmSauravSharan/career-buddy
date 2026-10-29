"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Compass, RotateCcw, AlertTriangle, Sparkles, Settings, Inbox, Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import type { Application, InboxJob } from "@shared/types";
import { normalizeTextKey } from "@shared/core/normalize-text-key.mjs";
import { paramsToFilters, paramsToAi, type ExploreFilters } from "@shared/explore";
import { CHINA_PRESET } from "@shared/employer-preset.mjs";
import { FilterBuilder } from "./filter-builder";
import { DiscoveringState } from "./discovering-state";
import { AiHuntView } from "./ai-hunt-view";
import { AiSearchBox } from "./ai-search-box";
import { ResultsList, type EnrichedOffer } from "./results-list";
import { InboxTriage } from "@/components/inbox/inbox-triage";
import { Sheet } from "@/components/ui/sheet";
import { useExplore } from "./explore-provider";
import { ScheduleJobAction } from "./schedule-job-action";

// Same shape as core normalizeTextKey(s, " ") — never [^a-z0-9] (#2666).
const norm = (s: string) => normalizeTextKey(s, " ");
const CLI_NAMES: Record<string, string> = {
  claude: "Claude Code",
  codex: "Codex",
  gemini: "Gemini CLI",
  opencode: "OpenCode",
  copilot: "Copilot CLI",
  qwen: "Qwen CLI",
  antigravity: "Antigravity CLI",
};

export function ExplorerView({
  seed,
  inboxSnapshot,
  appsSnapshot,
  rootExists,
  initialTab,
}: {
  seed: { filters: ExploreFilters; seededFrom: string[] };
  inboxSnapshot: InboxJob[];
  appsSnapshot: Application[];
  rootExists: boolean;
  /** Chosen on the server from the URL, so the first paint shows the right segment. */
  initialTab?: "new" | "search";
}) {
  const { filters, setFilters, initFilters, phase, running, offers, discover, loadFresh, mode, setMode, setAiIntent, companiesScanned, companiesAvailable, partial } = useExplore();
  const scanNote =
    companiesScanned > 0
      ? `Scanned ${companiesScanned.toLocaleString()}${companiesAvailable > companiesScanned ? ` of ${companiesAvailable.toLocaleString()}` : ""} compan${companiesScanned === 1 ? "y" : "ies"}${partial ? " · some sources were unreachable" : ""}.`
      : undefined;
  const inited = useRef(false);
  const [editOpen, setEditOpen] = useState(false);
  // "New for you" (the inbox) leads when it has jobs; a shared search link,
  // an onboarding hand-off or an AI query opens straight on Search.
  const [tab, setTab] = useState<"new" | "search">(() => initialTab ?? (inboxSnapshot.some((j) => !j.done) ? "new" : "search"));
  const [cli, setCli] = useState<{ id: string | null; name?: string }>({ id: null });
  const [firstRun, setFirstRun] = useState(false);

  useEffect(() => {
    try {
      const id = JSON.parse(localStorage.getItem("career-ops:config") || "{}").cliId || null;
      setCli({ id, name: id ? CLI_NAMES[id] || id : undefined });
    } catch {
      setCli({ id: null });
    }
  }, []);

  // Initialize once from the URL (shareable search) or the server seed — without
  // clobbering anything the assistant set before this mount.
  useEffect(() => {
    if (inited.current) return;
    inited.current = true;
    const sp = new URLSearchParams(window.location.search);
    // ?tab= only picks the segment; it is not a search filter.
    const tabParam = sp.get("tab");
    sp.delete("tab");
    const ai = paramsToAi(sp);
    if (tabParam === "new") setTab("new");
    else if (tabParam === "search" || sp.toString()) setTab("search");
    if (ai !== null) {
      setMode("ai");
      setAiIntent(ai);
    } else if (sp.get("view") === "fresh") {
      // Today's "See all N" (#84) hands off here instead of a bare config form —
      // load the SAME /api/whats-new offers it already showed, through the normal
      // results-phase UI. The config form (Refine search / Re-cast) stays reachable.
      // Force scan mode: a session restored in "ai" mode (sessionStorage rehydrate)
      // must not show the AI-search UI for this scan-only hand-off.
      setMode("scan");
      initFilters(seed.filters);
      void loadFresh();
    } else {
      initFilters(sp.toString() ? paramsToFilters(sp) : seed.filters);
      // Onboarding hand-off: ?run=1 auto-fires the free scan + flags the first-run
      // banner (the "matches found from your CV, free" reveal).
      if (sp.get("run") === "1" && sp.get("preset") !== CHINA_PRESET) {
        setFirstRun(true);
        void discover();
      }
    }
  }, [seed.filters, initFilters, setMode, setAiIntent, discover, loadFresh]);

  const inboxUrls = useMemo(() => new Set(inboxSnapshot.map((j) => j.url)), [inboxSnapshot]);
  // The snapshot also lists handled rows ([x]) so search results can say "seen";
  // New for you shows only the ones still waiting.
  const pending = useMemo(() => inboxSnapshot.filter((j) => !j.done), [inboxSnapshot]);
  const enriched: EnrichedOffer[] = useMemo(
    () =>
      offers.map((o) => {
        const inPipeline = inboxUrls.has(o.url);
        const c = norm(o.company);
        const t = norm(o.title);
        const ev = appsSnapshot.find((a) => {
          if (norm(a.company) !== c) return false;
          const ar = norm(a.role);
          return ar.length > 3 && (t.includes(ar) || ar.includes(t.split(" ").slice(0, 3).join(" ")));
        });
        return { ...o, inPipeline, evaluatedN: ev?.n };
      }),
    [offers, inboxUrls, appsSnapshot],
  );

  const isAi = mode === "ai";
  const isResults = phase === "results";
  const employer = filters.preset === CHINA_PRESET;
  const canDiscover = !running && (employer ? (filters.employers?.length ?? 0) > 0 : filters.ats.length > 0);
  const scanRunning = running && !isAi && !employer;
  // Keep one ResultsList mounted across scanning → revealing → results so
  // filter/sort/scroll and co-rise survive the 850ms reveal handoff.
  const showScanList = !isAi && offers.length > 0 && (scanRunning || isResults);
  const newCount = new Set(pending.map((j) => j.url)).size;
  const runSearch = () => {
    setEditOpen(false);
    if (canDiscover) void discover();
  };

  if (running && isAi) return <AiHuntView cliName={cli.name} />;

  if (scanRunning) {
    return (
      <div>
        <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">Searching job boards…</p>
        <DiscoveringState />
        {showScanList && (
          <div className="relative z-[1] mx-auto max-w-3xl px-4 pb-10 md:px-8">
            <ResultsList offers={enriched} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-10 pt-5 sm:px-6 lg:pt-8">
      <h1 className="text-display text-foreground md:text-[28px] md:leading-9">Find jobs</h1>

      <div role="tablist" aria-label="Find jobs" className="mt-4 flex rounded-xl bg-surface-hover p-1">
        {([
          ["new", "New for you", newCount],
          ["search", "Search", 0],
        ] as const).map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              "inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg text-sm transition-colors",
              tab === key ? "bg-surface font-semibold text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "font-medium text-muted hover:text-foreground",
            )}
          >
            {label}
            {count > 0 && (
              <span className={cn("min-w-[20px] rounded-full px-1.5 text-[11px] font-semibold leading-5 tabular-nums", tab === key ? "bg-brand text-brand-foreground" : "bg-border text-foreground")}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {!rootExists && (
        <div role="alert" className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          Your career-buddy home isn’t set up yet. Searching needs a profile to start from.
        </div>
      )}

      <div className="mt-5">
        {tab === "new" ? (
          <>
            {/* Stays mounted when the last job is skipped, so Undo and
                "N hidden · restore" survive the refresh to an empty list. */}
            <InboxTriage inbox={pending} />
            {newCount === 0 && (
              <div className="rounded-xl border border-border bg-surface px-6 py-10 text-center">
                <div className="mx-auto grid size-12 place-items-center rounded-full bg-brand-soft text-brand">
                  <Inbox className="size-6" />
                </div>
                <h2 className="mt-4 text-title text-foreground">No new jobs right now</h2>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted">New jobs land here after each scan. Run a search now; it’s free.</p>
                <button type="button" onClick={() => setTab("search")} className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-200">
                  <Search className="size-4" /> Search for jobs
                </button>
              </div>
            )}
          </>
        ) : (
          <SearchTab
            isAi={isAi}
            isResults={isResults}
            employer={employer}
            canDiscover={canDiscover}
            onEdit={() => setEditOpen(true)}
            onSearch={runSearch}
            cli={cli}
            firstRun={firstRun}
            enriched={enriched}
            scanNote={scanNote}
          />
        )}
      </div>

      <Sheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="What are you looking for?"
        description="Searching is free. Only scoring a job uses your AI."
        footer={
          <div className="space-y-2">
            <button
              type="button"
              onClick={runSearch}
              disabled={!canDiscover}
              aria-describedby={employer ? "employer-selection" : undefined}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand text-[15px] font-semibold text-brand-foreground transition-colors hover:bg-brand-200 disabled:opacity-50">
              <Search className="size-[18px]" /> Search now
            </button>
            {!employer && (
              <div className="flex justify-center">
                <ScheduleJobAction filters={filters} />
              </div>
            )}
          </div>
        }
      >
        <FilterBuilder filters={filters} onChange={setFilters} seededFrom={seed.seededFrom} disabled={running} />
      </Sheet>
    </div>
  );
}

function searchSummary(filters: ExploreFilters): { title: string; detail: string } {
  if (filters.preset === CHINA_PRESET) {
    const n = filters.employers?.length ?? 0;
    return { title: "Selected employers", detail: `${n} employer site${n === 1 ? "" : "s"} · last ${filters.sinceDays} days` };
  }
  const [first, ...rest] = filters.positive;
  const title = first ? `${first}${rest.length ? ` +${rest.length}` : ""}` : "Any role";
  const where = filters.allow.length ? filters.allow.slice(0, 2).join(", ") + (filters.allow.length > 2 ? ` +${filters.allow.length - 2}` : "") : "Anywhere";
  const when = filters.sinceDays === 1 ? "last 24 hours" : `last ${filters.sinceDays} days`;
  return { title, detail: `${where} · ${when}` };
}

function SearchTab({
  isAi,
  isResults,
  employer,
  canDiscover,
  onEdit,
  onSearch,
  cli,
  firstRun,
  enriched,
  scanNote,
}: {
  isAi: boolean;
  isResults: boolean;
  employer: boolean;
  canDiscover: boolean;
  onEdit: () => void;
  onSearch: () => void;
  cli: { id: string | null; name?: string };
  firstRun: boolean;
  enriched: EnrichedOffer[];
  scanNote?: string;
}) {
  const { filters, setFilters, phase, running, discover, status, employerOutcome, error, scannerMissing, mode, setMode, aiIntent, setAiIntent, discoverAI, companiesScanned, companiesAvailable, capHit, droppedNoDate, partial } = useExplore();
  const summary = searchSummary(filters);
  // The free search is the default; AI search is a quiet alternative, not a
  // second switch competing with New for you / Search.
  const modeLink = (
    <button
      type="button"
      onClick={() => setMode(isAi ? "scan" : "ai")}
      className="mx-auto flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
    >
      {isAi ? <><Compass className="size-4" /> Back to the free search</> : <><Sparkles className="size-4" /> Describe the job instead (AI search{cli.id ? "" : ", needs AI set up"})</>}
    </button>
  );

  return (
    <div className="space-y-4">
      <p role="status" aria-live="polite" aria-atomic="true" className="text-sm text-muted empty:hidden">
        {!isAi && (employerOutcome?.message || (employer && running ? "Scanning selected employers…" : ""))}
      </p>

      {isAi ? (
        phase === "blocked" ? (
          <>
            <BlockedCard />
            {modeLink}
          </>
        ) : (
          <>
            <AiSearchBox
              intent={aiIntent}
              onIntent={setAiIntent}
              onSubmit={() => void discoverAI()}
              cliConfigured={!!cli.id}
              cliName={cli.name}
              onRunScan={() => setMode("scan")}
            />
            {modeLink}
            {phase === "results" && <ResultsList offers={enriched} />}
            {phase === "empty-loose" && (
              <EmptyState
                tone="loose"
                title="No public matches yet"
                body="AI search only reads what’s public. Try describing the role more broadly, or run the free search."
                onRerun={() => setMode("scan")}
                rerunLabel="Run the free search"
              />
            )}
            {phase === "failed" && <FailedCard msg={error || status} scannerMissing={scannerMissing} onRetry={() => void discoverAI()} />}
          </>
        )
      ) : (
        <>
          <button
            type="button"
            onClick={onEdit}
            aria-haspopup="dialog"
            aria-label={`Edit search: ${summary.title}, ${summary.detail}`}
            className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-3 text-left transition-colors hover:bg-surface-hover"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
              <SlidersHorizontal className="size-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-heading text-foreground">{summary.title}</span>
              <span className="block truncate text-caption text-faint">{summary.detail}</span>
            </span>
            <span className="px-1 text-sm font-semibold text-brand-text">Edit</span>
          </button>

          {!isResults && (
            <button type="button" onClick={onSearch} disabled={!canDiscover} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand text-[15px] font-semibold text-brand-foreground transition-colors hover:bg-brand-200 disabled:opacity-50">
              <Search className="size-[18px]" /> Search now · free
            </button>
          )}
          {!isResults && !employer && modeLink}

          {isResults && firstRun && !employerOutcome && (
            <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
              <p className="text-sm leading-relaxed text-foreground">
                These are live jobs that match your CV, found for free. Open the one you’re most curious about and score it to see how well you fit, and why.
              </p>
            </div>
          )}

          {isResults && capHit && <CappedBanner companiesScanned={companiesScanned} companiesAvailable={companiesAvailable} onRefine={onEdit} />}

          {isResults && enriched.length > 0 && <ResultsList offers={enriched} />}

          {isResults && (
            <button type="button" onClick={onSearch} disabled={!canDiscover} className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-surface text-sm font-medium text-foreground transition-colors hover:bg-surface-hover disabled:opacity-50">
              <RotateCcw className="size-4" /> Search again
            </button>
          )}

          {!employerOutcome && phase === "empty-current" && (
            <EmptyState
              tone="good"
              title="You’re all caught up"
              body="Nothing new since your last search."
              note={scanNote}
              onRerun={() => {
                setFilters({ ...filters, sinceDays: Math.max(filters.sinceDays, 30) });
                void discover();
              }}
              rerunLabel="Look back 30 days"
            />
          )}
          {!employerOutcome && phase === "empty-loose" && (
            <EmptyState
              tone="loose"
              title="No new matches yet"
              body="Searching is free, so widen it and try again as often as you like."
              note={scanNote}
              onRerun={() => {
                setFilters({ ...filters, sinceDays: 30, block: [], allow: [] });
                void discover();
              }}
              rerunLabel="Last 30 days, any location"
            />
          )}
          {!employerOutcome && phase === "degraded" && (
            <DegradedCard
              onRetry={() => void discover()}
              companiesScanned={companiesScanned}
              companiesAvailable={companiesAvailable}
              capHit={capHit}
              droppedNoDate={droppedNoDate}
              partial={partial}
            />
          )}
          {!employerOutcome && phase === "failed" && <FailedCard msg={error || status} scannerMissing={scannerMissing} onRetry={() => void discover()} />}
        </>
      )}
    </div>
  );
}

function EmptyState({ tone, title, body, note, onRerun, rerunLabel }: { tone: "good" | "loose"; title: string; body: string; note?: string; onRerun: () => void; rerunLabel: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-6 py-12 text-center">
      <div className={cn("mx-auto grid size-12 place-items-center rounded-full", tone === "good" ? "bg-emerald-500/12 text-emerald-500" : "bg-brand-soft text-brand")}>
        <Sparkles className="size-6" />
      </div>
      <h2 className={`font-display mt-4 text-2xl text-foreground`}>{title}</h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">{body}</p>
      {note && <p className="mx-auto mt-1 max-w-md text-[12px] text-faint">{note}</p>}
      <button onClick={onRerun} className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:border-brand/40 hover:text-brand">
        <RotateCcw className="size-4" /> {rerunLabel}
      </button>
    </div>
  );
}

function DegradedCard({
  onRetry,
  companiesScanned,
  companiesAvailable,
  capHit,
  droppedNoDate,
  partial,
}: {
  onRetry: () => void;
  companiesScanned: number;
  companiesAvailable: number;
  capHit: boolean;
  droppedNoDate: number;
  partial: boolean;
}) {
  // 0 results, but the scan was NOT a clean full search → never "all caught up".
  // Pick the most informative reason (authoritative when the scanner's --json mode
  // is available; otherwise the 0-companies fallback).
  let title = "The scan ran, but couldn’t reach any sources.";
  let body =
    "The public ATS directories didn’t respond — usually a transient network hiccup or rate-limit, so nothing could be searched. This isn’t “all caught up”; a retry in a moment usually clears it.";
  if (companiesScanned > 0 && capHit) {
    title = "No matches in the slice we searched.";
    body = `The scan is capped, so it only searched ${companiesScanned.toLocaleString()}${companiesAvailable > companiesScanned ? ` of ${companiesAvailable.toLocaleString()}` : ""} companies — not the whole network. Raise scan depth (Refine search) or narrow your roles, then re-cast to look deeper.`;
  } else if (companiesScanned > 0 && droppedNoDate > 0) {
    title = "Fresh-looking roles were skipped for missing dates.";
    body = `${droppedNoDate.toLocaleString()} posting${droppedNoDate === 1 ? "" : "s"} matched but had no clear publish date, so the freshness filter dropped them. Widening the time window often brings dated equivalents back.`;
  } else if (companiesScanned > 0 && partial) {
    title = "Some job boards were unreachable.";
    body = `The scan searched ${companiesScanned.toLocaleString()} companies, but one or more sources didn’t respond — so this is a partial result, not “all caught up”. A retry usually clears it.`;
  }
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 text-center">
      <AlertTriangle className="mx-auto size-6 text-amber-500" />
      <p className="mt-2 text-sm font-medium text-foreground">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-[13px] text-muted">{body}</p>
      <button onClick={onRetry} className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-brand-soft px-3 py-1.5 text-sm font-medium text-brand">
        <RotateCcw className="size-4" /> Retry the scan
      </button>
    </div>
  );
}

function CappedBanner({ companiesScanned, companiesAvailable, onRefine }: { companiesScanned: number; companiesAvailable: number; onRefine: () => void }) {
  // Results ARE present, but the scan was capped — tell the user there's more, so a
  // partial list never reads as "everything there is".
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-4 py-2.5 text-[13px]">
      <span className="text-foreground">
        Showing a capped slice — searched {companiesScanned.toLocaleString()}
        {companiesAvailable > companiesScanned ? ` of ${companiesAvailable.toLocaleString()}` : ""} companies.
      </span>
      <button onClick={onRefine} className="font-medium text-brand hover:underline">
        Raise scan depth to search deeper
      </button>
    </div>
  );
}

function FailedCard({ msg, scannerMissing, onRetry }: { msg: string; scannerMissing: boolean; onRetry: () => void }) {
  // The scanner-missing case (data-only / pre-scan-ats-full checkout) must NOT
  // offer a "Try again" that re-fails forever — give a real next step instead.
  // The caller decides this from the response body's SCANNER_MISSING code, never
  // from the error text and never from the bare 400: a runtime scan error ("The
  // scanner returned no readable output.") mentions the scanner too, and 400 is
  // a shared channel that also carries malformed-request and MODE_MISSING
  // failures. Neither may be misreported as a broken checkout.
  if (scannerMissing) {
    return (
      <div className="rounded-xl border border-border bg-surface px-6 py-10 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-brand-soft text-brand">
          <Compass className="size-6" />
        </div>
        <h2 className={`font-display mt-4 text-2xl text-foreground`}>Discovery needs the full toolkit</h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">
          Your career-buddy home looks data-only or is on an older version. The free scanner ships with a complete checkout —
          update career-buddy, or paste a job URL on the pipeline to evaluate it directly.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link href="/pipeline" className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-brand-foreground transition hover:brightness-110">
            Open pipeline
          </Link>
          <Link href="/config" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-foreground transition hover:border-brand/40 hover:text-brand">
            Open Config
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 text-center">
      <AlertTriangle className="mx-auto size-6 text-amber-500" />
      <p className="mt-2 text-sm font-medium text-foreground">Couldn’t finish the search.</p>
      <p className="mt-1 text-[13px] text-muted">{msg}</p>
      <button onClick={onRetry} className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-brand-soft px-3 py-1.5 text-sm font-medium text-brand">
        <RotateCcw className="size-4" /> Try again
      </button>
    </div>
  );
}

function BlockedCard() {
  return (
    <div className="rounded-xl border border-border bg-surface px-6 py-12 text-center">
      <div className="mx-auto grid size-12 place-items-center rounded-full bg-brand-soft text-brand">
        <Sparkles className="size-6" />
      </div>
      <h2 className={`font-display mt-4 text-2xl text-foreground`}>AI search needs a CLI</h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">
        Connect Claude Code, Gemini, or any agent CLI — your key, your tokens, your machine. The free Scan stays available without one.
      </p>
      <Link href="/config" className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-brand-foreground transition hover:brightness-110">
        <Settings className="size-4" /> Open Config
      </Link>
    </div>
  );
}
