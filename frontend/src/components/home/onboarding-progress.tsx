"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles, Check, Circle, CircleDashed, ListChecks, ChevronDown } from "lucide-react";
import { readSavedCliId } from "@/lib/saved-cli";

// The "profile that grows while you talk": a live checklist of the four setup
// prerequisites plus the eight personalization sections, read from the same
// two signals the assistant gets (/api/doctor and /api/personalization) — never
// a parallel notion of "done". Refetches after every confirmed write
// (co-onboarding-changed) and after every finished worker (co-job-done), so a
// section flips to filled the moment its confirm card is accepted.

type Doctor = { available: boolean; onboardingNeeded: boolean; missing: string[] };
type Section = { id: string; heading: string; state: "filled" | "template" | "missing" };

// The same four keys /api/doctor reports in `missing`, so the panel cannot
// count itself done while doctor still says onboarding is incomplete.
// modes/_profile.md has no `ask` of its own: when it is absent its eight
// sections are all "missing", and the personalization line below asks for them.
const PREREQS: { key: string; label: string; ask?: string }[] = [
  { key: "cv.md", label: "Your CV", ask: "my CV" },
  { key: "config/profile.yml", label: "Profile — target roles, comp, location", ask: "my profile (target roles, comp, location)" },
  { key: "modes/_profile.md", label: "Personalization file" },
  { key: "portals.yml", label: "Companies and roles to scan", ask: "the roles and companies to scan" },
];

// Same reader the rest of the app uses, so "configured" cannot mean one thing
// here and another in Config (an empty-string cliId is not configured).
function hasCli(): boolean {
  return !!readSavedCliId();
}

export function OnboardingProgress({ compact = false }: { compact?: boolean }) {
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [sections, setSections] = useState<Section[] | null>(null);
  const [cli, setCli] = useState(true);

  const refetch = useCallback(() => {
    fetch("/api/doctor").then((r) => r.json()).then(setDoctor).catch(() => {});
    // A failed read keeps `sections` null (the panel says nothing): an empty
    // list would count as "every section done" and hide the panel.
    fetch("/api/personalization").then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))).then((d) => setSections(Array.isArray(d.sections) ? d.sections : null)).catch(() => setSections(null));
  }, []);

  useEffect(() => {
    setCli(hasCli());
    refetch();
    window.addEventListener("co-onboarding-changed", refetch);
    window.addEventListener("co-job-done", refetch);
    return () => {
      window.removeEventListener("co-onboarding-changed", refetch);
      window.removeEventListener("co-job-done", refetch);
    };
  }, [refetch]);

  if (!doctor || !sections) return null;
  // doctor.available=false means "could not determine" — say nothing rather than guess.
  if (!doctor.available) return null;

  const missing = new Set(doctor.missing);
  const generic = sections.filter((s) => s.state !== "filled");
  const prereqDone = PREREQS.filter((p) => !missing.has(p.key)).length;
  const total = PREREQS.length + sections.length;
  const done = prereqDone + (sections.length - generic.length);
  if (done === total) return null; // fully personalized: the panel has done its job

  const asks = [
    ...PREREQS.filter((p) => missing.has(p.key)).flatMap((p) => (p.ask ? [p.ask] : [])),
    ...(generic.length ? [`my personalization (${generic.map((s) => s.heading.replace(/^## Your /, "").toLowerCase()).join(", ")})`] : []),
  ];
  const kickoff = `Let's finish setting me up. Still to do: ${asks.join("; ")}. Walk me through it like a recruiter building my brief — one or two things at a time, propose what you infer from my CV, and let me confirm each piece. Don't ask for anything already on file.`;

  const pct = Math.round((done / total) * 100);
  const needsForm = missing.has("config/profile.yml") || missing.has("portals.yml");

  // One compact card: how far along, the next step, and the full checklist
  // behind a disclosure for anyone who wants the detail.
  return (
    <section
      aria-labelledby="setup-progress-title"
      className={`rounded-xl border border-border bg-surface shadow-[0_1px_2px_rgb(15_17_21/0.04)] ${compact ? "p-4" : "p-5"}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="setup-progress-title" className="text-base font-semibold text-foreground">Finish setting up</h2>
        <span className="text-sm font-medium tabular-nums text-muted">{pct}%</span>
      </div>
      <p className="mt-1 text-sm text-muted">
        {done} of {total} done. A complete profile makes every score more accurate.
      </p>
      <div
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-hover"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label="Setup progress"
      >
        <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {needsForm && (
          <a
            href="/onboarding"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-200"
          >
            <ListChecks className="size-4" /> Set up your profile
          </a>
        )}
        {cli ? (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("co-assistant", { detail: { message: kickoff } }))}
            className={
              needsForm
                ? "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
                : "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-200"
            }
          >
            <Sparkles className="size-4" /> Continue with the assistant
          </button>
        ) : (
          <p className="text-sm text-muted">
            <a href="/config" className="font-medium text-brand-text underline-offset-2 hover:underline">Connect your AI CLI</a> and the assistant fills in the rest with you.
          </p>
        )}
      </div>

      <details className="group mt-4 border-t border-border pt-3">
        <summary className="flex cursor-pointer list-none items-center justify-between rounded text-sm font-medium text-muted hover:text-foreground">
          What&apos;s left
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <ul className="mt-3 space-y-2 text-sm">
          {PREREQS.map((p) => (
            <Row key={p.key} state={missing.has(p.key) ? "missing" : "filled"} label={p.label} />
          ))}
          <li className="pt-2 text-xs font-semibold uppercase tracking-[0.08em] text-faint">Personalization</li>
          {sections.map((s) => (
            <Row key={s.id} state={s.state} label={s.heading.replace(/^## Your /, "")} />
          ))}
        </ul>
      </details>
    </section>
  );
}

function Row({ state, label }: { state: "filled" | "template" | "missing"; label: string }) {
  const Icon = state === "filled" ? Check : state === "template" ? CircleDashed : Circle;
  const tone = state === "filled" ? "text-muted" : "text-foreground";
  const hint = state === "template" ? "Still the example" : state === "missing" ? "Not started" : "Done";
  return (
    <li className={`flex items-center gap-2 ${tone}`}>
      <Icon className={`size-4 shrink-0 ${state === "filled" ? "text-emerald-700 dark:text-emerald-400" : "text-faint"}`} aria-hidden />
      <span className="truncate">{label}</span>
      <span className="ml-auto shrink-0 text-xs text-faint">{hint}</span>
    </li>
  );
}
