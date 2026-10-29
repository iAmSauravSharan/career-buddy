"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useJobs } from "@/components/jobs/job-store";
import { CostBadge } from "@/components/cost/cost-badge";

// Auto-pipeline, one click: paste a job URL → fire a real evaluation worker
// (the same kind:"evaluate" that runs modes/oferta.md + writes the A–F report +
// tracker row). The worker pills + assistant cards show progress.
export function QuickEvaluate() {
  const { startJob } = useJobs();
  const [url, setUrl] = useState("");
  const [hint, setHint] = useState("");

  function run() {
    const u = url.trim();
    if (!/^https?:\/\//i.test(u)) {
      setHint("Paste a full job-posting URL (https://…).");
      return;
    }
    startJob({ title: "Evaluate · pasted URL", subtitle: u, kind: "evaluate", input: u, page: "/" });
    setUrl("");
    setHint("Evaluating — watch it in the Workers tray.");
  }

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface py-1 pl-3 pr-1 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
        <Sparkles className="size-4 shrink-0 text-faint" aria-hidden />
        <input
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (hint) setHint("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") run();
          }}
          placeholder="Paste a job URL…"
          aria-label="Job posting URL to evaluate"
          className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-faint focus-visible:outline-none"
        />
        <button
          onClick={run}
          className="shrink-0 rounded-md bg-brand px-3.5 py-1.5 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-200"
        >
          Evaluate
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <CostBadge kind="spend" size="xs" />
        <span className="text-xs text-faint">Uses your AI credits.</span>
      </div>
      {hint && <p className="mt-1 text-xs text-muted" role="status">{hint}</p>}
    </div>
  );
}
