"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bookmark, BookmarkCheck, Loader2, SlidersHorizontal, Sparkles, Undo2, X } from "lucide-react";
import { useJobs } from "@/components/jobs/job-store";
import type { InboxJob } from "@shared/types";
import type { AtsSource } from "@shared/explore";
import { ATS_LABEL, ATS_SOURCES } from "@shared/explore";
import { daysSince, seniorityFromTitle, sourceFromUrl, SENIORITY_ORDER, type Seniority } from "@/lib/inbox";
import { inboxScoreTarget } from "@/lib/inbox-score-target.mjs";
import { FacetChips } from "./facet-chips";
import type { RowScore } from "./triage-row";
import { ShortlistTray, type ShortItem } from "./shortlist-tray";
import { Sheet } from "@/components/ui/sheet";
import { JobGroup, JobRow, Pill, PostingLink, agoLabel, primaryButton, secondaryButton } from "@/components/explore/job-row";
import { cn } from "@/lib/cn";
import { estimateRunCost } from "@/lib/run-cost-estimate.mjs";
import { createInboxSkipActions, queueInboxSkip } from "@/lib/inbox-skip-client.mjs";

const SHORTLIST_KEY = "career-ops:shortlist";
const HIDDEN_KEY = "career-ops:hidden";
const CONFIG_KEY = "career-ops:config";
const BATCH = 20;
type UndoNotice = { label: string; fn: () => Promise<void>; busy?: boolean; error?: string };

// The inbox as a TRIAGE surface: Abundance → Triage → Shortlist → Opt-in Score.
// Default is a small fresh batch (never the full wall); free facets + Save/Skip narrow
// it; only scoring spends tokens. 🔴 The shell is agnostic to what makes a
// role relevant — order is freshness with a single documented plug point.
//
// Shown as "New for you" on Find jobs: rows grouped by week, the filters in a
// sheet, and every per-job action in the job's own sheet (tap a row).
export function InboxTriage({ inbox }: { inbox: InboxJob[] }) {
  const router = useRouter();
  const { jobs, startJob } = useJobs();
  // Serialize skip/undo per URL so a fast Undo cannot lose the race to Skip.
  const skipChain = useRef(new Map<string, Promise<void>>());
  const undoRunning = useRef(new Set<UndoNotice["fn"]>());
  const restoreRunning = useRef(false);

  // facets
  const [within, setWithin] = useState<number | null>(null);
  const [sources, setSources] = useState<Set<AtsSource>>(() => new Set());
  const [seniorities, setSeniorities] = useState<Set<Seniority>>(() => new Set());
  const [locQ, setLocQ] = useState("");
  const [kw, setKw] = useState("");
  const [showAll, setShowAll] = useState(false);

  // persisted triage state + ephemeral selection/undo
  const [shortlist, setShortlist] = useState<ShortItem[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [openUrl, setOpenUrl] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [undo, setUndo] = useState<UndoNotice | null>(null);
  const [writeError, setWriteError] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [hasCli, setHasCli] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const s = localStorage.getItem(SHORTLIST_KEY);
      if (s) setShortlist(JSON.parse(s));
      const h = localStorage.getItem(HIDDEN_KEY);
      if (h) {
        const parsed = JSON.parse(h) as unknown;
        const urls = Array.isArray(parsed) ? parsed.filter((u): u is string => typeof u === "string") : [];
        const pending = new Set(inbox.map((j) => j.url));
        setHidden(urls.filter((u) => pending.has(u)));
      }
      const c = localStorage.getItem(CONFIG_KEY);
      setHasCli(!!(c && JSON.parse(c).cliId));
    } catch {
      /* ignore */
    }
    setLoaded(true);
    // First SSR inbox only — later refreshes prune via the inbox effect below.
  }, []);
  useEffect(() => {
    if (loaded) try { localStorage.setItem(SHORTLIST_KEY, JSON.stringify(shortlist)); } catch { /* quota */ }
  }, [shortlist, loaded]);
  useEffect(() => {
    if (loaded) try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(hidden)); } catch { /* quota */ }
  }, [hidden, loaded]);
  // After SSR refresh, pipeline.md [x] rows are already gone from `inbox`.
  // Drop them from the localStorage cache so "N hidden" does not linger.
  useEffect(() => {
    const pending = new Set(inbox.map((j) => j.url));
    setHidden((h) => {
      const next = h.filter((u) => pending.has(u));
      return next.length === h.length ? h : next;
    });
  }, [inbox]);
  // auto-dismiss the undo toast
  useEffect(() => {
    if (!undo || undo.busy || undo.error) return;
    const t = setTimeout(() => setUndo((current) => current?.fn === undo.fn && !current.busy && !current.error ? null : current), 5000);
    return () => clearTimeout(t);
  }, [undo]);

  // stable "now" for freshness (per mount)
  const now = useMemo(() => Date.now(), []);

  // Dedupe by URL — pipeline.md can list the same posting twice; it's one job, so it
  // triages once (and Save/Skip/score, all keyed by URL, act on it coherently).
  const enriched = useMemo(() => {
    const seen = new Set<string>();
    const out: { job: InboxJob; source: AtsSource | null; seniority: Seniority | null; age: number | null }[] = [];
    for (const job of inbox) {
      if (seen.has(job.url)) continue;
      seen.add(job.url);
      out.push({ job, source: sourceFromUrl(job.url), seniority: seniorityFromTitle(job.role), age: daysSince(job.postedAt, now) });
    }
    return out;
  }, [inbox, now]);

  // EVALUADA lookup: the latest evaluate worker per posting URL (running → badge).
  const scoreByUrl = useMemo(() => {
    const best = new Map<string, (typeof jobs)[number]>();
    for (const j of jobs) {
      if (!j.input || j.kind !== "evaluate") continue;
      const ex = best.get(j.input);
      if (!ex || j.startedAt > ex.startedAt) best.set(j.input, j);
    }
    const m = new Map<string, RowScore>();
    for (const [url, j] of best) {
      m.set(url, { score: j.result?.score ?? null, tone: j.result?.tone ?? "muted", jobId: j.id, running: j.status === "running", reportN: j.reportN });
    }
    return m;
  }, [jobs]);

  // facet options — only surface what's actually present in the (non-hidden) data
  const availSources = useMemo(() => {
    const set = new Set<AtsSource>();
    for (const e of enriched) if (e.source && !hidden.includes(e.job.url)) set.add(e.source);
    return ATS_SOURCES.filter((s) => set.has(s));
  }, [enriched, hidden]);
  const availSeniorities = useMemo(() => {
    const set = new Set<Seniority>();
    for (const e of enriched) if (e.seniority && !hidden.includes(e.job.url)) set.add(e.seniority);
    return SENIORITY_ORDER.filter((s) => set.has(s));
  }, [enriched, hidden]);

  const filtered = useMemo(
    () =>
      enriched.filter((e) => {
        if (hidden.includes(e.job.url)) return false;
        if (within != null && (e.age == null || e.age > within)) return false;
        if (sources.size && (!e.source || !sources.has(e.source))) return false;
        if (seniorities.size && (!e.seniority || !seniorities.has(e.seniority))) return false;
        if (locQ.trim() && !(e.job.location || "").toLowerCase().includes(locQ.trim().toLowerCase())) return false;
        if (kw.trim() && !`${e.job.company} ${e.job.role}`.toLowerCase().includes(kw.trim().toLowerCase())) return false;
        return true;
      }),
    [enriched, hidden, within, sources, seniorities, locQ, kw],
  );

  // 🔴 SINGLE ORDER PLUG POINT — freshness only (newest first_seen first; unknown last).
  // A smarter ranker replaces ONLY this comparator; facets/triage/shortlist/score never
  // touch relevance. This is the whole firewall in one line.
  const ordered = useMemo(() => [...filtered].sort((a, b) => (a.age ?? Infinity) - (b.age ?? Infinity)), [filtered]);

  const anyFacet = within != null || sources.size > 0 || seniorities.size > 0 || locQ.trim() !== "" || kw.trim() !== "";
  const capped = !showAll && !anyFacet;
  const visible = capped ? ordered.slice(0, BATCH) : ordered;
  const hiddenCount = hidden.length;

  const isShortlisted = (url: string) => shortlist.some((s) => s.url === url);

  const persistSkip = async (url: string, done: boolean) => {
    await queueInboxSkip(skipChain.current, url, done);
    router.refresh();
  };
  const handleUndo = async (notice: UndoNotice) => {
    if (undoRunning.current.has(notice.fn)) return;
    undoRunning.current.add(notice.fn);
    setUndo((current) => current?.fn === notice.fn ? { ...current, busy: true, error: undefined } : current);
    try {
      await notice.fn();
      setUndo((current) => current?.fn === notice.fn ? null : current);
    } catch (cause) {
      const error = cause instanceof Error ? cause.message : "Could not undo this skip. Please try again.";
      setUndo((current) => current?.fn === notice.fn ? { ...current, busy: false, error } : current);
    } finally {
      undoRunning.current.delete(notice.fn);
    }
  };

  const save = (job: InboxJob) => {
    if (isShortlisted(job.url)) return;
    setShortlist((s) => [...s, { url: job.url, company: job.company, role: job.role }]);
  };
  const skip = (job: InboxJob) => {
    setWriteError("");
    setHidden((h) => (h.includes(job.url) ? h : [...h, job.url]));
    const actions = createInboxSkipActions((done) => persistSkip(job.url, done), () => {
      setHidden((h) => h.filter((u) => u !== job.url));
      setUndo((current) => current?.fn === notice.fn && !current.busy ? null : current);
      setWriteError(`Could not skip ${job.company}. Please try Skip again.`);
    });
    const notice: UndoNotice = {
      label: `Skipped ${job.company}`,
      fn: async () => {
        await actions.undo();
        setHidden((h) => h.filter((u) => u !== job.url));
      },
    };
    setUndo(notice);
    void actions.skip();
  };
  const restoreHidden = async () => {
    if (restoreRunning.current) return;
    restoreRunning.current = true;
    setRestoring(true);
    const urls = hidden;
    setWriteError("");
    try {
      await Promise.all(urls.map((url) => persistSkip(url, false).then(() => {
        setHidden((h) => h.filter((u) => u !== url));
      }).catch(() => setWriteError("Some jobs could not be restored. Try restore again."))));
    } finally {
      restoreRunning.current = false;
      setRestoring(false);
    }
  };
  const scoreOne = (job: InboxJob) => {
    startJob({ title: `Score · ${job.company}`, subtitle: job.role, kind: "evaluate", input: job.url, page: "/pipeline" });
    setShortlist((s) => s.filter((x) => x.url !== job.url));
  };

  const estimate = useMemo(() => {
    if (shortlist.length === 0) return {};
    return estimateRunCost(jobs, "evaluate", shortlist.length);
  }, [jobs, shortlist.length]);

  const scoreShortlist = () => {
    const batchId = `shortlist-${Date.now()}`;
    for (const it of shortlist) {
      startJob({ title: `Score · ${it.company}`, subtitle: it.role, kind: "evaluate", input: it.url, page: "/pipeline", batchId });
    }
    setShortlist([]); // sent — the rows flip to Scoring… → badge via scoreByUrl
  };

  const openEntry = openUrl ? enriched.find((e) => e.job.url === openUrl) ?? null : null;
  const thisWeek = visible.filter((e) => e.age != null && e.age <= 7);
  const earlier = visible.filter((e) => !(e.age != null && e.age <= 7));

  const scorePill = (url: string) => {
    const scored = scoreByUrl.get(url);
    const target = inboxScoreTarget(scored);
    if (scored?.running) return <Pill tone="brand"><Loader2 className="size-3 animate-spin" /> Scoring…</Pill>;
    if (target.evaluated && target.showScore) return <Pill tone={scored!.tone === "muted" ? "muted" : scored!.tone}>{scored!.score} / 5</Pill>;
    if (target.evaluated) return <Pill tone="brand">Report ready</Pill>;
    if (isShortlisted(url)) return <Pill tone="brand"><BookmarkCheck className="size-3" /> Saved</Pill>;
    return <Pill>Not scored</Pill>;
  };

  const row = (e: (typeof enriched)[number]) => (
    <JobRow
      key={e.job.url}
      company={e.job.company}
      role={e.job.role}
      location={e.job.location || undefined}
      onOpen={() => setOpenUrl(e.job.url)}
      meta={
        <>
          {agoLabel(e.age) && <Pill>{agoLabel(e.age)}</Pill>}
          {scorePill(e.job.url)}
        </>
      }
      trailing={
        inboxScoreTarget(scoreByUrl.get(e.job.url)).evaluated ? undefined : (
          <button
            type="button"
            onClick={() => skip(e.job)}
            title="Skip — hide from the inbox"
            aria-label={`Not for me: ${e.job.company}, ${e.job.role}`}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-faint transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <X className="size-[18px]" />
          </button>
        )
      }
    />
  );

  return (
    <div className={cn(shortlist.length > 0 && "pb-28 sm:pb-24")}>
      {writeError && <p role="alert" className="mb-3 text-sm text-red-600 dark:text-red-400">{writeError}</p>}
      {/* Keep recovery mounted when the last Skip refreshes to an empty inbox. */}
      <div hidden={inbox.length === 0}>
        <div className="mb-3 flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-sm text-muted">
            {anyFacet ? `${filtered.length} of ${enriched.length - hiddenCount} jobs` : capped && ordered.length > BATCH ? `Newest ${BATCH} of ${ordered.length}` : `${ordered.length} job${ordered.length === 1 ? "" : "s"}`}
          </p>
          {hiddenCount > 0 && (
            <button type="button" onClick={() => void restoreHidden()} disabled={restoring} aria-busy={restoring} className="min-h-[44px] px-1 text-xs text-faint transition-colors hover:text-foreground disabled:opacity-50">
              {hiddenCount} hidden · {restoring ? "restoring…" : "restore"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            aria-haspopup="dialog"
            className={cn(
              "inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors",
              anyFacet ? "border-foreground bg-foreground text-background" : "border-border bg-surface text-foreground hover:bg-surface-hover",
            )}
          >
            <SlidersHorizontal className="size-4" /> Filter{anyFacet && " · on"}
          </button>
        </div>

        {visible.length > 0 ? (
          <>
            {thisWeek.length > 0 && <JobGroup label="This week">{thisWeek.map(row)}</JobGroup>}
            {earlier.length > 0 && <JobGroup label={thisWeek.length > 0 ? "Earlier" : "Older jobs"}>{earlier.map(row)}</JobGroup>}
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-surface px-6 py-10 text-center">
            <p className="text-heading text-foreground">No jobs match these filters</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">Loosen the filters to see more.</p>
          </div>
        )}

        {/* "See all N" — only when the fresh batch is capping a larger list */}
        {capped && ordered.length > BATCH && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-border bg-surface text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
          >
            Show all {ordered.length} jobs
          </button>
        )}
      </div>

      <Sheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filter new jobs"
        description="Free and instant. Filters only change what you see here."
        footer={
          <div className="flex gap-2">
            {anyFacet && (
              <button type="button" onClick={() => { setWithin(null); setSources(new Set()); setSeniorities(new Set()); setLocQ(""); setKw(""); }} className={secondaryButton("w-auto px-5")}>
                Clear
              </button>
            )}
            <button type="button" onClick={() => setFiltersOpen(false)} className={primaryButton("flex-1")}>
              Show {filtered.length} job{filtered.length === 1 ? "" : "s"}
            </button>
          </div>
        }
      >
        <FacetChips
          within={within}
          setWithin={setWithin}
          sources={sources}
          toggleSource={(s) => setSources((set) => { const n = new Set(set); n.has(s) ? n.delete(s) : n.add(s); return n; })}
          seniorities={seniorities}
          toggleSeniority={(s) => setSeniorities((set) => { const n = new Set(set); n.has(s) ? n.delete(s) : n.add(s); return n; })}
          locQ={locQ}
          setLocQ={setLocQ}
          kw={kw}
          setKw={setKw}
          availSources={availSources}
          availSeniorities={availSeniorities}
          resultCount={filtered.length}
          totalCount={enriched.length - hiddenCount}
          anyActive={anyFacet}
          onClear={() => { setWithin(null); setSources(new Set()); setSeniorities(new Set()); setLocQ(""); setKw(""); }}
        />
      </Sheet>

      {openEntry && (
        <InboxJobSheet
          entry={openEntry}
          scored={scoreByUrl.get(openEntry.job.url)}
          saved={isShortlisted(openEntry.job.url)}
          hasCli={hasCli}
          onClose={() => setOpenUrl(null)}
          onScore={() => scoreOne(openEntry.job)}
          onSave={() => save(openEntry.job)}
          onSkip={() => { skip(openEntry.job); setOpenUrl(null); }}
        />
      )}

      {/* undo toast (sits above the tray and the tab bar) */}
      {undo && (
        // On phones the beta pill and Ask button float just above the tab bar,
        // so the toast clears that row (and the tray, when it's showing).
        <div className={cn("fixed inset-x-0 z-[75] flex justify-center px-4", shortlist.length > 0 ? "bottom-[calc(var(--tabbar-h)+8.5rem)] md:bottom-24" : "bottom-[calc(var(--tabbar-h)+4.25rem)] md:bottom-6")}>
          <div className="inline-flex max-w-full flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-2 text-sm shadow-lg">
            <div className="min-w-0 flex-1 break-words">
              <span className="text-muted" role="status">{undo.label}</span>
              {undo.error && <p role="alert" className="text-red-600 dark:text-red-400">{undo.error}</p>}
            </div>
            <button type="button" onClick={() => void handleUndo(undo)} disabled={undo.busy} aria-busy={Boolean(undo.busy)} className="inline-flex min-h-[44px] shrink-0 items-center gap-1 font-medium text-brand-text disabled:opacity-50">
              <Undo2 className="size-3.5" /> {undo.busy ? "Undoing…" : undo.error ? "Retry undo" : "Undo"}
            </button>
          </div>
        </div>
      )}

      <ShortlistTray
        items={shortlist}
        estimate={estimate}
        hasCli={hasCli}
        onRemove={(url) => setShortlist((s) => s.filter((x) => x.url !== url))}
        onClear={() => setShortlist([])}
        onScore={scoreShortlist}
      />
    </div>
  );
}

// One job, opened from the list: what we know, and the one next step (score it).
function InboxJobSheet({
  entry,
  scored,
  saved,
  hasCli,
  onClose,
  onScore,
  onSave,
  onSkip,
}: {
  entry: { job: InboxJob; source: AtsSource | null; age: number | null };
  scored?: RowScore;
  saved: boolean;
  hasCli: boolean;
  onClose: () => void;
  onScore: () => void;
  onSave: () => void;
  onSkip: () => void;
}) {
  const { job, source, age } = entry;
  const target = inboxScoreTarget(scored);
  const facts = [job.location, agoLabel(age), source ? ATS_LABEL[source] : null].filter(Boolean).join(" · ");

  return (
    <Sheet
      open
      onClose={onClose}
      title={job.role}
      description={`${job.company}${facts ? ` · ${facts}` : ""}`}
      footer={
        target.evaluated && target.href ? (
          <Link href={target.href} className={primaryButton()}>{scored?.running ? "Follow the scoring" : "Open the report"}</Link>
        ) : (
          <div className="space-y-2">
            {hasCli ? (
              <button type="button" onClick={onScore} className={primaryButton()}>
                <Sparkles className="size-[18px]" /> Score this job
              </button>
            ) : (
              <Link href="/config" className={primaryButton()}>Set up AI to score jobs</Link>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={onSave} disabled={saved} className={secondaryButton("flex-1")}>
                {saved ? <BookmarkCheck className="size-[17px]" /> : <Bookmark className="size-[17px]" />} {saved ? "Saved" : "Save"}
              </button>
              <button type="button" onClick={onSkip} className={secondaryButton("flex-1")}>
                <X className="size-[17px]" /> Not for me
              </button>
            </div>
            <PostingLink href={job.url} />
          </div>
        )
      }
    >
      <div className="rounded-xl border border-border bg-background/60 p-4">
        {scored?.running ? (
          <>
            <p className="flex items-center gap-2 text-heading text-foreground"><Loader2 className="size-4 animate-spin text-brand" /> Scoring…</p>
            <p className="mt-1 text-caption text-faint">This takes about a minute. You can close this; the score appears in the list.</p>
          </>
        ) : target.evaluated && target.showScore ? (
          <>
            <p className="text-heading text-foreground">Scored {scored!.score} out of 5</p>
            <p className="mt-1 text-caption text-faint">It’s in Applications. The report explains the score.</p>
          </>
        ) : (
          <>
            <p className="text-heading text-foreground">Not scored yet</p>
            <p className="mt-1 text-caption text-faint">
              Scoring compares this job with your CV and tells you whether it’s worth applying. It uses your AI and takes about a minute.
            </p>
          </>
        )}
      </div>
      {saved && !target.evaluated && (
        <p className="mt-3 text-caption text-faint">Saved jobs collect in the bar at the bottom, so you can score them together.</p>
      )}
    </Sheet>
  );
}
