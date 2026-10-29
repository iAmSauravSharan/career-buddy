"use client";

import { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, ChevronsUpDown, X, ArrowRight, ExternalLink, LayoutList, Table2, BriefcaseBusiness } from "lucide-react";
import type { Application } from "@shared/types";
import { Badge } from "@/components/ui/badge";
import { CompanyLogo } from "@/components/company-logo";
import { CANONICAL_STATES, canonStatus, scoreNum, scoreTone } from "@shared/format";
import { StatusSelect } from "@/components/status-select";
import { applicationKey, applySavedStatus, saveStatuses } from "@/lib/pipeline-status.mjs";
import { cn } from "@/lib/cn";
import { companyPresentation, companySearchText } from "@/lib/company-presentation.mjs";
import { PipelineTableRowsSkeleton } from "@/components/page-loading-skeletons";
import { startRouteProgress } from "@/components/route-progress";
import { sortRows } from "@/lib/core/pipeline-sort.mjs";
import { PageFrame } from "@/components/page-frame";
import { tabLabel } from "@/lib/pipeline-tab-labels.mjs";
import { PIPELINE_TABS, pipelineQuery, pipelineTab } from "@shared/pipeline-navigation.mjs";
import { COMPARE_MAX } from "@shared/pipeline-compare.mjs";
import { postingHref, postingLabel } from "@shared/posting-url.mjs";
import { ApplicationCards, StageChips } from "@/components/pipeline/application-cards";

type Tab = (typeof PIPELINE_TABS)[number];

const SORT_KEYS = ["tracker", "company", "role", "score", "status", "date"] as const;
const SORT_LABEL: Record<string, string> = { tracker: "#", company: "Company", role: "Role", score: "Score", status: "Status", date: "Added" };
type SortKey = (typeof SORT_KEYS)[number];
// The inbox lives in Find jobs now; Applications only lists tracked roles.
const STAGE_TABS = PIPELINE_TABS.filter((t) => t !== "INBOX");
const COMMON_TABS: string[] = ["ALL", "EVALUATED", "APPLIED", "RESPONDED", "INTERVIEW", "OFFER"];

export function PipelineView({
  applications,
  inboxCount,
}: {
  applications: Application[];
  inboxCount: number;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startNavigation] = useTransition();
  const [pendingTab, setPendingTab] = useState<Tab | null>(null);
  // Starts AFTER the POST succeeds. React replays the confirmed save over
  // intervening snapshots and discards it when the refresh transition settles.
  const [visibleApplications, showSavedStatus] = useOptimistic(applications, applySavedStatus<Application>);
  const [announcement, setAnnouncement] = useState("");
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const activeTab = useRef<HTMLButtonElement>(null);

  // The URL is the SINGLE source of truth for tab/min/sort/dir/view, so the home
  // links AND the assistant's filterPipeline/navigate actions drive the list
  // identically (no useState mirror → no desync).
  const tab: Tab = pipelineTab(params.get("tab"));
  const visibleTab = isPending && pendingTab ? pendingTab : tab;
  // Cards everywhere by default; the table is a desktop view for sorting and bulk edits.
  const tableView = params.get("view") === "table";
  const pMin = parseFloat(params.get("min") ?? "");
  const minFilter: number | null = Number.isFinite(pMin) ? pMin : null;
  const pSort = params.get("sort") ?? "";
  const sortKey: SortKey = (SORT_KEYS as readonly string[]).includes(pSort) ? (pSort as SortKey) : "score";
  const sort = { key: sortKey, dir: (params.get("dir") === "1" ? 1 : -1) as 1 | -1 };

  // Search stays LOCAL for snappy typing; seeded from the URL and re-synced only
  // when the URL's q changes (i.e. the assistant set it) — never per keystroke.
  const [q, setQ] = useState(params.get("q") ?? "");
  // Typing stays local, so include it explicitly when leaving the list.
  const detailQuery = pipelineQuery(params.toString(), q);
  const lastUrlQ = useRef(params.get("q") ?? "");
  useEffect(() => {
    const urlQ = params.get("q") ?? "";
    if (urlQ !== lastUrlQ.current) {
      lastUrlQ.current = urlQ;
      setQ(urlQ);
    }
  }, [params]);

  const setParams = useCallback(
    (updates: Record<string, string | number | null>) => {
      const sp = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v == null || v === "") sp.delete(k);
        else sp.set(k, String(v));
      }
      const qs = sp.toString();
      if (qs === params.toString()) return;
      if (Object.prototype.hasOwnProperty.call(updates, "tab")) {
        const nextTab = String(updates.tab ?? "ALL").toUpperCase();
        if ((PIPELINE_TABS as readonly string[]).includes(nextTab)) setPendingTab(nextTab as Tab);
      }
      startRouteProgress();
      startNavigation(() => {
        router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
      });
    },
    [params, router, pathname, startNavigation],
  );

  useEffect(() => {
    if (!isPending) setPendingTab(null);
  }, [isPending]);

  // The list filters on a deferred copy of the search text. The input shows
  // each keystroke at once; re-filtering and re-rendering every tracker row
  // runs at low priority, and React drops a stale render when the next
  // keystroke arrives, so typing no longer waits on the whole list.
  const deferredQ = useDeferredValue(q);

  const filtered = useMemo(() => {
    let rows = visibleApplications;
    if (tab !== "ALL") rows = rows.filter((r) => canonStatus(r.status).includes(tab));
    if (minFilter != null) {
      rows = rows.filter((r) => {
        const n = scoreNum(r.score);
        return !Number.isNaN(n) && n >= minFilter;
      });
    }
    if (deferredQ.trim()) {
      const needle = deferredQ.toLowerCase();
      rows = rows.filter((r) => companySearchText(r).toLowerCase().includes(needle));
    }
    // scoreNum is the real score parser (it handles the tracker's "4.2/5"
    // cells); sortRows takes it rather than keeping a second copy (#4333).
    return sortRows(
      rows,
      sort,
      scoreNum,
      (row) => companyPresentation(row).label,
    ) as Application[];
  }, [visibleApplications, tab, deferredQ, sort, minFilter]);

  const filteredKeys = filtered.map(applicationKey);
  const selectedRows = filtered.filter((r) => selected.has(applicationKey(r)));
  const allSelected = filteredKeys.length > 0 && filteredKeys.every((k) => selected.has(k));

  function toggleRow(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function applyBulkStatus() {
    if (!bulkStatus || selectedRows.length === 0 || bulkBusy) return;
    setBulkBusy(true);
    setBulkError("");
    const { saved, failed } = await saveStatuses(selectedRows, bulkStatus);
    setBulkBusy(false);
    setSelected(new Set(selectedRows.filter((r) => failed.some((f) => f.n === r.n)).map(applicationKey)));
    if (failed.length > 0) {
      setBulkError(`${failed.length} not saved: ${failed.map((f) => `#${f.n} (${f.error})`).join(", ")}`);
    }
    setAnnouncement(`${saved.length} application${saved.length === 1 ? "" : "s"} set to ${bulkStatus}.`);
    startTransition(() => router.refresh());
  }

  function tabCount(t: string): number {
    if (t === "ALL") return visibleApplications.length;
    return visibleApplications.filter((r) => canonStatus(r.status).includes(t)).length;
  }

  const stageTabs = STAGE_TABS.filter((t) => COMMON_TABS.includes(t) || t === visibleTab || tabCount(t) > 0);
  const hrefFor = (r: Application) => `/pipeline/${encodeURIComponent(r.n)}${detailQuery ? `?${detailQuery}` : ""}`;
  const showSearch = tableView || visibleApplications.length > 6 || q !== "";

  if (visibleApplications.length === 0) {
    return (
      <PageFrame className="max-w-3xl">
        <h1 className="text-display text-foreground md:text-[28px] md:leading-9">Applications</h1>
        <div className="mt-6 rounded-xl border border-border bg-surface px-6 py-10 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-brand-soft text-brand">
            <BriefcaseBusiness className="size-6" />
          </div>
          <h2 className="mt-4 text-title text-foreground">Nothing here yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">Jobs you score or save in Find jobs show up here, grouped by what to do next.</p>
          <Link href="/explore" className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-200">
            <Search className="size-4" /> Find jobs
          </Link>
        </div>
      </PageFrame>
    );
  }

  return (
    <PageFrame className={tableView ? undefined : "max-w-3xl"}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-display text-foreground md:text-[28px] md:leading-9">Applications</h1>
          <p className="mt-0.5 text-sm text-muted">
            <span className="tabular-nums">{visibleApplications.length}</span> role{visibleApplications.length === 1 ? "" : "s"} tracked
          </p>
        </div>
        {/* Cards ↔ table. The table is for sorting and bulk edits, so desktop only. */}
        <div role="group" aria-label="Layout" className="hidden shrink-0 rounded-lg bg-surface-hover p-0.5 md:flex">
          {([
            [false, "Cards", LayoutList],
            [true, "Table", Table2],
          ] as const).map(([isTable, label, Icon]) => (
            <button
              key={label}
              type="button"
              aria-pressed={tableView === isTable}
              onClick={() => setParams({ view: isTable ? "table" : null })}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium transition-colors",
                tableView === isTable ? "bg-surface text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      {inboxCount > 0 && (
        <Link
          href="/explore?tab=new"
          className="mt-4 flex items-center gap-2 rounded-xl border border-brand/25 bg-brand-soft px-4 py-3 text-sm font-medium text-brand-text transition-colors hover:bg-brand/15"
        >
          <span className="min-w-0 flex-1">
            {inboxCount} new job{inboxCount === 1 ? "" : "s"} to look at in Find jobs
          </span>
          <ArrowRight className="size-4 shrink-0" />
        </Link>
      )}

      <div className="mt-5">
        <StageChips tabs={stageTabs} active={visibleTab} count={tabCount} onPick={(t) => setParams({ tab: t === "ALL" ? null : t })} activeRef={activeTab} />
      </div>

      {showSearch && (
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search company or role…"
            aria-label="Search company or role"
            className="h-11 w-full rounded-xl border border-border bg-surface pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-faint focus:border-brand/50 focus-visible:ring-2 focus-visible:ring-brand/40"
          />
        </div>
      )}

      <p role="status" className="sr-only">{announcement}</p>

      {minFilter != null && (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-sm text-muted">Filtered:</span>
          <button
            type="button"
            onClick={() => setParams({ min: null })}
            className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand-text transition-colors hover:bg-brand/15"
            title="Clear score filter"
          >
            score ≥ {minFilter.toFixed(1)}
            <X className="size-3" />
          </button>
        </div>
      )}

      {tableView && selectedRows.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm shadow-sm">
          <span className="tabular-nums">{selectedRows.length} selected</span>
          <select
            aria-label="Status for selected applications"
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value)}
            disabled={bulkBusy}
            className="rounded-md border border-border bg-surface px-2 py-1 text-sm"
          >
            <option value="">Set status…</option>
            {CANONICAL_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={applyBulkStatus}
            disabled={!bulkStatus || bulkBusy}
            className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground hover:bg-brand-200 disabled:opacity-50"
          >
            {bulkBusy ? "Saving…" : "Apply"}
          </button>
          {selectedRows.length >= 2 && selectedRows.length <= COMPARE_MAX && (
            <Link
              href={`/pipeline/compare?n=${selectedRows.map((r) => r.n).join(",")}`}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-hover"
            >
              Compare
            </Link>
          )}
          <button type="button" onClick={() => setSelected(new Set())} className="text-xs text-muted hover:text-foreground">
            Clear
          </button>
          {bulkError && <span role="alert" className="text-xs text-red-700 dark:text-red-400">{bulkError}</span>}
        </div>
      )}

      {!isPending && filtered.length === 0 ? (
        <div className="mt-4 rounded-xl border border-border bg-surface px-6 py-12 text-center">
          <p className="text-heading text-foreground">No matches</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">Try another stage or clear the search.</p>
        </div>
      ) : !tableView ? (
        <div className={cn("mt-5", isPending && "opacity-60 transition-opacity")} aria-busy={isPending}>
          <ApplicationCards rows={filtered} grouped={visibleTab === "ALL"} hrefFor={hrefFor} stageLabel={tabLabel(visibleTab)} />
        </div>
      ) : (
        /* ── Tracker table ──
           overflow-x-auto, not overflow-hidden: the rounded corners still clip,
           but a table too wide for the viewport can now be scrolled to instead
           of being silently cut off. min-w keeps the columns readable rather
           than letting w-full crush them on a phone. */
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-surface shadow-[0_1px_2px_rgb(15_17_21/0.04)]">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="border-b border-border bg-surface-hover/50 text-left text-xs font-medium text-muted">
              <tr>
                <th className="w-8 px-3 py-2.5">
                  <input
                    type="checkbox"
                    aria-label="Select all shown applications"
                    checked={allSelected}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(filteredKeys))}
                  />
                </th>
                {SORT_KEYS.map((k) => (
                  <th
                    key={k}
                    aria-sort={sort.key === k ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
                    className={cn(
                      "whitespace-nowrap px-4 py-2.5 font-medium",
                      k === "date" && "hidden lg:table-cell",
                    )}
                  >
                    <button
                      type="button"
                      className="inline-flex cursor-pointer select-none items-center gap-1 rounded hover:text-foreground"
                      onClick={() => setParams({ sort: k, dir: sort.key === k ? sort.dir * -1 : -1 })}
                    >
                      {SORT_LABEL[k] ?? k}
                      <ChevronsUpDown aria-hidden="true" className="size-3" />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            {/* Keep editors mounted while query navigation is pending: sorting
                must not discard an open editor or an in-flight status save. */}
            <tbody className="divide-y divide-border" hidden={isPending} aria-busy={false}>
              {filtered.map((r) => {
                const company = companyPresentation(r);
                const key = applicationKey(r);
                const detailHref = `/pipeline/${encodeURIComponent(r.n)}${detailQuery ? `?${detailQuery}` : ""}`;
                const posting = postingHref(r.url);
                return (
                  <tr key={key} data-application-key={key} className="group transition-colors hover:bg-surface-hover/60">
                    <td className="w-8 px-3 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${company.label}, ${r.role} (#${r.n})`}
                        checked={selected.has(key)}
                        onChange={() => toggleRow(key)}
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium tabular-nums">
                      <Link href={detailHref} tabIndex={-1} className="text-muted transition-colors group-hover:text-foreground">
                        #{r.n}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <Link href={detailHref} className="flex items-center gap-2.5 text-foreground underline-offset-2 hover:underline">
                        <CompanyLogo name={company.logoName} size={20} />
                        {company.label}
                      </Link>
                    </td>
                  <td className="px-4 py-3 text-foreground">
                    <div className="flex items-center gap-2">
                      <Link href={detailHref} tabIndex={-1}>{r.role}</Link>
                      {posting && (
                        <a
                          href={posting}
                          target="_blank"
                          rel="noreferrer"
                          title={posting}
                          className="inline-flex shrink-0 items-center gap-1 text-xs text-brand-text hover:underline"
                        >
                          {postingLabel(posting)}
                          <ExternalLink className="size-3" />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={scoreTone(r.score)}>{r.score || "—"}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">
                    <StatusSelect
                      n={r.n}
                      current={r.status}
                      inline
                      applicationLabel={`${company.label} — ${r.role} (#${r.n})`}
                      onSaved={(status, restoreFocus) => {
                        // If this focused row leaves its tab, preserve a useful
                        // focus target. Do not interrupt someone using search.
                        const focusedRow = document.activeElement?.closest("tr");
                        if (tab !== "ALL" && !canonStatus(status).includes(tab) && (restoreFocus || focusedRow?.dataset.applicationKey === key)) {
                          activeTab.current?.focus();
                        }
                        setAnnouncement(`Application #${r.n} status saved as ${status}.`);
                        startTransition(() => {
                          showSavedStatus({ key, status });
                          router.refresh();
                        });
                      }}
                    />
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-faint tabular-nums lg:table-cell">{r.date}</td>
                  </tr>
                );
              })}
            </tbody>
            {isPending && (
              <tbody className="divide-y divide-border" aria-busy="true">
                <PipelineTableRowsSkeleton trackerColumn />
              </tbody>
            )}
          </table>
        </div>
      )}
    </PageFrame>
  );
}
