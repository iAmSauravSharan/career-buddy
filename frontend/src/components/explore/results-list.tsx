"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Loader2, Plus, Search, ShieldQuestion, Sparkles } from "lucide-react";
import { ATS_LABEL, type AtsSource, type DiscoveredOffer } from "@shared/explore";
import { CHINA_SOURCES, EMPLOYER_LABEL } from "@shared/employer-preset.mjs";
import { useJobs } from "@/components/jobs/job-store";
import { Sheet } from "@/components/ui/sheet";
import { useExplore } from "./explore-provider";
import { JobGroup, JobRow, Pill, PostingLink, primaryButton, secondaryButton } from "./job-row";

export type EnrichedOffer = DiscoveredOffer & { inPipeline: boolean; evaluatedN?: string };

function freshness(postedAt: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(postedAt)) return "";
  const days = Math.max(0, Math.round((Date.now() - new Date(postedAt + "T00:00:00Z").getTime()) / 86_400_000));
  return days === 0 ? "Today" : days === 1 ? "Yesterday" : days < 7 ? `${days} days ago` : `${Math.floor(days / 7)}w ago`;
}

// What a running worker is doing on this exact posting → the live label.
const WORKER_LABEL: Record<string, string> = { evaluate: "Scoring…", pdf: "Preparing CV…", research: "Researching…", apply: "Filling…" };

// Search results as one list. Each row opens the job's sheet: score it (the one
// primary action), save it to Applications, or open the posting.
export function ResultsList({ offers }: { offers: EnrichedOffer[] }) {
  const { companiesScanned, partial, error, addToPipeline, added, mode, running } = useExplore();
  const isAi = mode === "ai";
  const employer = offers.some((o) => CHINA_SOURCES.includes(o.source));
  const [q, setQ] = useState("");
  const [openUrl, setOpenUrl] = useState<string | null>(null);
  const { jobs } = useJobs();

  const view = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle ? offers.filter((o) => o.title.toLowerCase().includes(needle) || o.company.toLowerCase().includes(needle)) : offers;
    return [...list].sort((a, b) => (b.postedAt || "").localeCompare(a.postedAt || ""));
  }, [offers, q]);

  const latestJob = (url: string) => jobs.filter((j) => j.input === url).sort((a, b) => b.startedAt - a.startedAt)[0];
  const addable = offers.filter((o) => !o.inPipeline && !o.evaluatedN && !added.has(o.url));
  const open = openUrl ? offers.find((o) => o.url === openUrl) ?? null : null;

  const statePill = (o: EnrichedOffer) => {
    const job = latestJob(o.url);
    if (job?.status === "running") return <Pill tone="brand"><Loader2 className="size-3 animate-spin" /> {WORKER_LABEL[job.kind ?? ""] ?? "Working…"}</Pill>;
    if (o.evaluatedN || (job?.status === "done" && job.kind === "evaluate")) return <Pill tone="good"><Check className="size-3" /> Scored</Pill>;
    if (added.has(o.url) || o.inPipeline) return <Pill tone="brand">In Applications</Pill>;
    if (o.fit?.band === "strong") return <Pill tone="good">Strong title match</Pill>;
    return <Pill>Not scored</Pill>;
  };

  const summary = isAi
    ? "Found by AI on the open web. Unverified until you score one."
    : employer
      ? "From the employer sites you picked. Searching was free."
      : `${companiesScanned > 0 ? `${companiesScanned.toLocaleString()} companies searched. ` : ""}Searching was free.${partial ? " Some job boards didn’t respond." : ""}`;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="text-heading text-foreground">
            {offers.length} {isAi ? "possible match" : "job"}{offers.length === 1 ? "" : isAi ? "es" : "s"}
          </p>
          <p className="text-caption text-faint">{summary}</p>
          {!isAi && error && <p className="text-caption text-amber-800 dark:text-amber-300">{error}</p>}
        </div>
        {addable.length > 1 && (
          <button
            type="button"
            onClick={() => addToPipeline(addable)}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
          >
            <Plus className="size-4" /> Save all {addable.length}
          </button>
        )}
      </div>

      {offers.length > 6 && (
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by company or role"
            aria-label="Filter results by company or role"
            className="h-11 w-full rounded-xl border border-border bg-surface pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-faint focus:border-brand/50 focus-visible:ring-2 focus-visible:ring-brand/40"
          />
        </div>
      )}

      {view.length > 0 && (
        <JobGroup label={isAi ? "Possible matches" : "Newest first"}>
          {view.map((o) => (
            <JobRow
              key={o.url}
              company={o.company}
              role={o.title}
              location={o.location || (employer ? "Location unknown" : undefined)}
              logo={!CHINA_SOURCES.includes(o.source)}
              onOpen={() => setOpenUrl(o.url)}
              meta={
                <>
                  {freshness(o.postedAt) || o.postedHint ? <Pill>{freshness(o.postedAt) || o.postedHint}</Pill> : employer ? <Pill>Posting date unknown</Pill> : null}
                  {statePill(o)}
                  {o.verification === "unconfirmed" && <Pill tone="warn"><ShieldQuestion className="size-3" /> Unverified</Pill>}
                </>
              }
            />
          ))}
        </JobGroup>
      )}

      {view.length === 0 && (q.trim() || !running) && <p className="py-10 text-center text-sm text-faint">No results match “{q}”.</p>}

      {open && <OfferSheet offer={open} onClose={() => setOpenUrl(null)} />}
    </div>
  );
}

function OfferSheet({ offer, onClose }: { offer: EnrichedOffer; onClose: () => void }) {
  const { added, adding, addToPipeline } = useExplore();
  const { jobs, startJob } = useJobs();
  const job = useMemo(() => jobs.filter((j) => j.input === offer.url).sort((a, b) => b.startedAt - a.startedAt)[0], [jobs, offer.url]);
  const working = job?.status === "running";
  const doneEval = job?.status === "done" && job.kind === "evaluate";
  const isAdded = added.has(offer.url) || offer.inPipeline || working || doneEval;
  const isAdding = adding.has(offer.url);
  const unverified = offer.verification === "unconfirmed";
  const board = ATS_LABEL[offer.ats as AtsSource] ?? EMPLOYER_LABEL[offer.ats as keyof typeof EMPLOYER_LABEL] ?? offer.ats;
  const facts = [offer.location, freshness(offer.postedAt) || offer.postedHint, board].filter(Boolean).join(" · ");

  const score = () => {
    addToPipeline([offer]); // scoring implies it's in Applications — record it
    startJob({ title: `Evaluate · ${offer.company}`, subtitle: offer.title, kind: "evaluate", input: offer.url, page: "/explore" });
  };

  const reportHref = offer.evaluatedN ? `/pipeline/${offer.evaluatedN}` : job ? `/jobs/${job.id}` : "/pipeline";

  return (
    <Sheet
      open
      onClose={onClose}
      title={offer.title}
      description={`${offer.company}${facts ? ` · ${facts}` : ""}`}
      footer={
        offer.evaluatedN || doneEval ? (
          <div className="space-y-2">
            <Link href={reportHref} className={primaryButton()}>Open the report</Link>
            <PostingLink href={offer.url} />
          </div>
        ) : (
          <div className="space-y-2">
            <button type="button" onClick={score} disabled={working} className={primaryButton()}>
              {working ? <Loader2 className="size-[18px] animate-spin" /> : <Sparkles className="size-[18px]" />}
              {working ? (WORKER_LABEL[job.kind ?? ""] ?? "Working…") : "Score this job"}
            </button>
            <button type="button" onClick={() => addToPipeline([offer])} disabled={isAdded || isAdding} className={secondaryButton()}>
              {isAdding ? <Loader2 className="size-[17px] animate-spin" /> : isAdded ? <Check className="size-[17px]" /> : <Plus className="size-[17px]" />}
              {isAdded ? "Saved to Applications" : "Save to Applications"}
            </button>
            <PostingLink href={offer.url} />
          </div>
        )
      }
    >
      <div className="rounded-xl border border-border bg-background/60 p-4">
        {working ? (
          <>
            <p className="flex items-center gap-2 text-heading text-foreground"><Loader2 className="size-4 animate-spin text-brand" /> Scoring…</p>
            <p className="mt-1 text-caption text-faint">This takes about a minute. You can close this.</p>
          </>
        ) : offer.evaluatedN || doneEval ? (
          <>
            <p className="text-heading text-foreground">Scored</p>
            <p className="mt-1 text-caption text-faint">It’s in Applications. The report explains the score.</p>
          </>
        ) : (
          <>
            <p className="text-heading text-foreground">Not scored yet</p>
            <p className="mt-1 text-caption text-faint">
              Scoring compares this job with your CV and tells you whether it’s worth applying. It uses your AI and takes about a minute.
              {unverified && " It also checks that the posting is still open."}
            </p>
          </>
        )}
      </div>
      {offer.why && (
        <p className="mt-3 flex items-start gap-2 text-sm text-muted">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-brand" /> {offer.why}
        </p>
      )}
      {offer.matchedKeyword && !offer.why && (
        <p className="mt-3 text-sm text-muted">Matched your search for “{offer.matchedKeyword}”.</p>
      )}
    </Sheet>
  );
}
