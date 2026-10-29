"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { SkillGaps } from "@/components/skill-gaps";
import remarkGfm from "remark-gfm";
import { Check, Loader2, Upload, X } from "lucide-react";
import { CvIngest } from "@/components/cv/cv-ingest";
import { cn } from "@/lib/cn";

export function CvEditor() {
  const [content, setContent] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [exists, setExists] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // Upload a CV file (PDF / Word / .md / .txt) or paste one in to replace cv.md.
  // The first-run screen is the only other place this lives, and it disappears
  // once cv.md exists.
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    fetch("/api/cv")
      .then((r) => r.json())
      .then((d) => {
        setContent(d.content ?? "");
        setExists(d.exists ?? false);
      })
      .finally(() => setLoaded(true));
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        setDirty(false);
        setExists(true);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        // The skill-gap panel below reads cv.md to subtract skills the user
        // already has, so a save changes its answer. Announced rather than
        // wired directly, following the co-job-done convention, so the panel
        // stays a listener and this stays a save.
        window.dispatchEvent(new CustomEvent("co-cv-saved"));
      }
    } finally {
      setSaving(false);
    }
  }

  function imported(markdown: string) {
    // CvIngest already wrote cv.md; show it here as the saved version.
    setContent(markdown);
    setExists(true);
    setDirty(false);
    setImporting(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    window.dispatchEvent(new CustomEvent("co-cv-saved"));
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl tracking-tight text-landing">CV editor</h1>
          <p className="mt-1 text-sm text-muted">
            Edit <code className="text-foreground">cv.md</code> with live preview.
            {!exists && loaded && <span className="ml-1 text-faint">No cv.md yet — start typing to create it.</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setImporting((v) => !v)}
          aria-expanded={importing}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-brand/40 hover:text-brand max-sm:min-h-[44px]"
        >
          {importing ? <X className="size-4" /> : <Upload className="size-4" />}
          {importing ? "Cancel upload" : "Upload CV"}
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-colors max-sm:min-h-[44px]",
            dirty
              ? "bg-brand text-brand-foreground hover:bg-brand-200"
              : "border border-border bg-surface text-muted",
          )}
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : saved ? <Check className="size-4" /> : null}
          {saved ? "Saved" : "Save"}
        </button>
        </div>
      </div>

      {importing && (
        <section aria-label="Upload a CV" className="mt-6 rounded-xl border border-border bg-surface p-5">
          <h2 className="text-sm font-medium text-foreground">Upload a new CV</h2>
          <p className="mt-1 mb-4 text-[13px] text-muted">
            Drop or pick a PDF, Word (.docx), .md or .txt file, or paste the text. You review it before it is saved.
            {exists && content.trim() && <span className="text-amber-600 dark:text-amber-400"> Saving replaces your current CV.</span>}
          </p>
          <CvIngest stay onSaved={imported} />
        </section>
      )}

      {!loaded ? (
        <div className="mt-6 text-sm text-muted">Loading…</div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setDirty(true);
            }}
            spellCheck={false}
            placeholder="# Your Name&#10;&#10;## Summary&#10;..."
            className="min-h-[60vh] w-full resize-none rounded-xl border border-border bg-surface p-4 font-mono text-sm leading-relaxed outline-none transition-colors placeholder:text-faint focus:border-brand/40"
          />
          <article className="report-prose min-h-[60vh] overflow-auto rounded-xl border border-border bg-surface p-5">
            {content.trim() ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            ) : (
              <p className="text-muted">Preview appears here.</p>
            )}
          </article>
        </div>
      )}

      {/* Below the editor: the gaps are context for what to write next, and they
          belong after the document rather than competing with it. */}
      <SkillGaps />
    </div>
  );
}
