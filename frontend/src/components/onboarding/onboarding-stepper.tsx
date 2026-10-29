"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Check,
  Loader2,
  MapPin,
  Pencil,
  Rocket,
  Sparkles,
  User,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import type { OnboardingForm, SpendTier } from "@shared/types";
import { CoMark } from "@/components/co-mark";
import { cn } from "@/lib/cn";
import { addChip, STEPS, stepErrors, stepOfField } from "@/lib/onboarding-steps.mjs";

// The onboarding stepper: who the user is and what they are looking for, one
// short step at a time. A step rail on the left, the current step on the right,
// a segmented progress bar under it. The draft survives a reload (localStorage)
// and is written once, on the last step, through POST /api/onboarding.

type StepId = (typeof STEPS)[number]["id"];
type Errors = Record<string, string>;

const ICONS: Record<StepId, LucideIcon> = {
  details: User,
  roles: Briefcase,
  location: MapPin,
  pay: Wallet,
  ai: Sparkles,
  review: Rocket,
};

const DRAFT_KEY = "career-buddy:onboarding-draft";

const WORK_STYLES = ["Remote only", "Remote preferred", "Hybrid", "On-site", "Open to anything"];
const CURRENCIES = ["USD", "EUR", "GBP", "INR", "CAD", "AUD", "SGD", "CHF", "JPY", "AED", "BRL", "PLN"];
const COUNTRIES = [
  "United States", "Canada", "United Kingdom", "Ireland", "Germany", "France", "Netherlands", "Spain",
  "Portugal", "Italy", "Switzerland", "Sweden", "Denmark", "Poland", "India", "Singapore", "Japan",
  "Australia", "New Zealand", "United Arab Emirates", "Brazil", "Mexico",
];
const ROLE_IDEAS = ["Software Engineer", "Product Manager", "Data Scientist", "Designer", "Engineering Manager"];
const TIERS: { id: SpendTier; title: string; body: string }[] = [
  { id: "economy", title: "Economy", body: "Cheapest and fastest. Good for scanning lots of offers quickly." },
  { id: "standard", title: "Standard", body: "Balanced cost and quality. The right default if you're not sure." },
  { id: "premium", title: "Premium", body: "The most capable model. For the offers you really care about." },
];

export function OnboardingStepper({ initial, hasProfile }: { initial: OnboardingForm; hasProfile: boolean }) {
  const [form, setForm] = useState<OnboardingForm>(initial);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const restored = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);

  // Restore a draft after hydration (never during render: the server has no localStorage).
  useEffect(() => {
    let next = initial;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as { form?: OnboardingForm; step?: number };
        if (draft.form) next = { ...initial, ...draft.form };
        if (typeof draft.step === "number") setStep(Math.min(Math.max(draft.step, 0), STEPS.length - 1));
      }
    } catch {
      /* a broken draft just starts fresh */
    }
    // Guess the timezone from the browser when neither the profile nor the draft has one.
    if (!next.location.timezone) {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) next = { ...next, location: { ...next.location, timezone: tz } };
    }
    setForm(next);
    restored.current = true;
  }, [initial]);

  useEffect(() => {
    if (!restored.current || done) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ form, step }));
    } catch {
      /* private mode: no draft, still works */
    }
  }, [form, step, done]);

  useEffect(() => {
    heading.current?.focus();
  }, [step, done]);

  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  function update(mutate: (f: OnboardingForm) => OnboardingForm) {
    setForm((f) => mutate(structuredClone(f)));
  }

  function next() {
    const e = stepErrors(current.id, form);
    setErrors(e);
    if (Object.keys(e).length === 0) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goTo(i: number) {
    // Forward jumps only through steps that already pass, so the rail can't skip a required field.
    for (let k = 0; k < i; k++) {
      const e = stepErrors(STEPS[k].id, form);
      if (Object.keys(e).length) {
        setErrors(e);
        setStep(k);
        return;
      }
    }
    setErrors({});
    setStep(i);
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; field?: string };
      if (!res.ok) {
        const target = STEPS.findIndex((s) => s.id === stepOfField(body.field));
        if (body.field && target >= 0 && target !== step) {
          setErrors({ [body.field]: body.error || "Check this field" });
          setStep(target);
        } else {
          setSaveError(body.error || `Could not save (HTTP ${res.status})`);
        }
        return;
      }
      localStorage.removeItem(DRAFT_KEY);
      window.dispatchEvent(new CustomEvent("co-onboarding-changed"));
      setDone(true);
    } catch {
      setSaveError("Could not reach the server. Check that it's running and try again.");
    } finally {
      setSaving(false);
    }
  }

  const furthest = STEPS.findIndex((s) => Object.keys(stepErrors(s.id, form)).length > 0);

  return (
    <div className="flex min-h-screen items-stretch justify-center bg-background p-0 md:items-center md:p-6">
      <div className="flex w-full max-w-6xl flex-col overflow-hidden border-border bg-surface md:min-h-[680px] md:flex-row md:rounded-xl md:border md:shadow-xl">
        {/* Step rail */}
        <aside className="relative flex flex-col overflow-hidden border-b border-border bg-surface-hover/50 p-6 md:w-[340px] md:shrink-0 md:border-b-0 md:border-r md:p-8">
          <Link href="/" className="flex items-center gap-2.5">
            <CoMark size={28} />
            <span className={`font-display text-2xl tracking-tight text-landing`}>career-buddy</span>
          </Link>

          <ol className="relative z-10 mt-10 hidden space-y-0 md:block" aria-label="Setup steps">
            {STEPS.map((s, i) => {
              const Icon = ICONS[s.id];
              const state = done || i < step ? "done" : i === step ? "current" : "todo";
              const reachable = done ? false : furthest < 0 || i <= Math.max(furthest, step);
              return (
                <li key={s.id} className="relative pb-6 last:pb-0">
                  {i < STEPS.length - 1 && (
                    <span
                      aria-hidden
                      className={cn(
                        "absolute left-[17px] top-10 h-[calc(100%-32px)] w-px",
                        state === "done" ? "bg-brand/60" : "bg-border",
                      )}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => reachable && goTo(i)}
                    disabled={!reachable}
                    aria-current={state === "current" ? "step" : undefined}
                    className="group flex w-full items-start gap-3.5 rounded-lg text-left disabled:cursor-default"
                  >
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg border transition-colors",
                        state === "current" && "border-border bg-surface text-foreground shadow-sm",
                        state === "done" && "border-brand/40 bg-brand-soft text-brand-text",
                        state === "todo" && "border-border bg-surface text-faint",
                      )}
                    >
                      {state === "done" ? <Check className="size-4" /> : <Icon className="size-4" />}
                    </span>
                    <span className="pt-0.5">
                      <span
                        className={cn(
                          "block text-sm font-medium",
                          state === "current" ? "text-foreground" : "text-muted group-enabled:group-hover:text-foreground",
                        )}
                      >
                        {s.title}
                      </span>
                      <span className={cn("block text-[13px]", state === "current" ? "text-muted" : "text-faint")}>{s.hint}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          {/* Mobile: the step count instead of the full rail. */}
          <p className="mt-4 font-mono text-xs text-muted md:hidden">
            Step {step + 1} of {STEPS.length} · {current.title}
          </p>

          <span
            aria-hidden
            className={`font-display pointer-events-none absolute -bottom-24 -right-10 hidden select-none text-[300px] leading-none text-foreground/[0.035] md:block`}
          >
            co
          </span>

          <div className="relative z-10 mt-auto hidden items-center justify-between pt-10 text-sm md:flex">
            <Link href="/" className="inline-flex items-center gap-2 text-muted hover:text-foreground">
              <ArrowLeft className="size-4" /> Back to home
            </Link>
            {!done && <span className="font-mono text-xs text-faint">{step + 1}/{STEPS.length}</span>}
          </div>
        </aside>

        {/* Current step */}
        <section className="flex flex-1 flex-col px-6 py-10 md:px-12">
          <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center">
            {done ? (
              <Finished headingRef={heading} />
            ) : (
              <>
                <div className="flex flex-col items-center text-center">
                  <span className="flex size-11 items-center justify-center rounded-xl border border-border bg-surface shadow-sm">
                    {(() => {
                      const Icon = ICONS[current.id];
                      return <Icon className="size-5 text-brand" />;
                    })()}
                  </span>
                  <h1
                    ref={heading}
                    tabIndex={-1}
                    className={`font-display mt-5 text-3xl tracking-tight text-landing outline-none md:text-4xl`}
                  >
                    {TITLES[current.id](hasProfile)}
                  </h1>
                  <p className="mt-2 text-sm text-muted">{SUBTITLES[current.id]}</p>
                </div>

                <form
                  className="mt-8 space-y-5"
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (last) void save();
                    else next();
                  }}
                >
                  {current.id === "details" && <DetailsStep form={form} update={update} errors={errors} />}
                  {current.id === "roles" && <RolesStep form={form} update={update} errors={errors} />}
                  {current.id === "location" && <LocationStep form={form} update={update} errors={errors} />}
                  {current.id === "pay" && <PayStep form={form} update={update} errors={errors} />}
                  {current.id === "ai" && <AiStep form={form} update={update} />}
                  {current.id === "review" && <ReviewStep form={form} edit={(id) => goTo(STEPS.findIndex((s) => s.id === id))} />}

                  {saveError && (
                    <p role="alert" className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-400">
                      {saveError}
                    </p>
                  )}

                  <div className="space-y-3 pt-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground shadow-sm transition-colors hover:bg-brand-200 disabled:opacity-60"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="size-4 animate-spin" /> Saving…
                        </>
                      ) : last ? (
                        <>Save and finish</>
                      ) : (
                        <>
                          Continue <ArrowRight className="size-4" />
                        </>
                      )}
                    </button>
                    {step > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setErrors({});
                          setStep((s) => s - 1);
                        }}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
                      >
                        <ArrowLeft className="size-4" /> Back
                      </button>
                    )}
                  </div>
                </form>
              </>
            )}
          </div>

          {/* Segmented progress */}
          <div className="mx-auto mt-10 flex w-full max-w-[440px] gap-2" aria-hidden>
            {STEPS.map((s, i) => (
              <span
                key={s.id}
                className={cn("h-1.5 flex-1 rounded-full transition-colors", done || i <= step ? "bg-brand" : "bg-surface-hover")}
              />
            ))}
          </div>
          <Link href="/" className="mt-6 inline-flex items-center justify-center gap-2 text-sm text-muted hover:text-foreground md:hidden">
            <ArrowLeft className="size-4" /> Back to home
          </Link>
        </section>
      </div>
    </div>
  );
}

const TITLES: Record<StepId, (hasProfile: boolean) => string> = {
  details: (has) => (has ? "Check your details" : "Let's get you set up"),
  roles: () => "What are you looking for?",
  location: () => "Where do you want to work?",
  pay: () => "What should it pay?",
  ai: () => "How much AI per evaluation?",
  review: () => "You're all set",
};

const SUBTITLES: Record<StepId, string> = {
  details: "Your CV and applications use these. They stay on your account.",
  roles: "We search for these titles and score every offer against them.",
  location: "Your work style, and the places a job has to be in to show up.",
  pay: "Offers below your walk-away number get flagged before you spend time on them.",
  ai: "You can change this any time in your profile.",
  review: "Check everything once more, then save.",
};

type StepProps = { form: OnboardingForm; update: (m: (f: OnboardingForm) => OnboardingForm) => void; errors: Errors };

function DetailsStep({ form, update, errors }: StepProps) {
  return (
    <>
      <Field label="Full name" error={errors["candidate.full_name"]}>
        {(p) => (
          <input {...p} className={inputCls} autoComplete="name" value={form.candidate.full_name}
            onChange={(e) => update((f) => ((f.candidate.full_name = e.target.value), f))} placeholder="Ada Lovelace" />
        )}
      </Field>
      <Field label="Email" error={errors["candidate.email"]}>
        {(p) => (
          <input {...p} className={inputCls} type="email" autoComplete="email" value={form.candidate.email}
            onChange={(e) => update((f) => ((f.candidate.email = e.target.value), f))} placeholder="you@example.com" />
        )}
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="City" optional>
          {(p) => (
            <input {...p} className={inputCls} autoComplete="address-level2" value={form.location.city}
              onChange={(e) => update((f) => ((f.location.city = e.target.value), f))} placeholder="London" />
          )}
        </Field>
        <Field label="Country" error={errors["location.country"]}>
          {(p) => (
            <>
              <input {...p} className={inputCls} autoComplete="country-name" list="co-countries" value={form.location.country}
                onChange={(e) => update((f) => ((f.location.country = e.target.value), f))} placeholder="United Kingdom" />
              <datalist id="co-countries">{COUNTRIES.map((c) => <option key={c} value={c} />)}</datalist>
            </>
          )}
        </Field>
      </div>
      <Field label="Timezone" error={errors["location.timezone"]}>
        {(p) => (
          <>
            <input {...p} className={inputCls} list="co-timezones" value={form.location.timezone}
              onChange={(e) => update((f) => ((f.location.timezone = e.target.value), f))} placeholder="Europe/London" />
            <TimezoneList />
          </>
        )}
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="LinkedIn" optional>
          {(p) => (
            <input {...p} className={inputCls} value={form.candidate.linkedin}
              onChange={(e) => update((f) => ((f.candidate.linkedin = e.target.value), f))} placeholder="linkedin.com/in/you" />
          )}
        </Field>
        <Field label="Phone" optional>
          {(p) => (
            <input {...p} className={inputCls} type="tel" autoComplete="tel" value={form.candidate.phone}
              onChange={(e) => update((f) => ((f.candidate.phone = e.target.value), f))} placeholder="+44 20 7946 0000" />
          )}
        </Field>
      </div>
    </>
  );
}

function RolesStep({ form, update, errors }: StepProps) {
  const unused = ROLE_IDEAS.filter((r) => !form.target_roles.some((x) => x.toLowerCase() === r.toLowerCase()));
  return (
    <>
      <Field label="Job titles" error={errors.target_roles} hint="Press Enter after each one. Add the variants you'd accept too.">
        {(p) => (
          <ChipInput {...p} values={form.target_roles} placeholder="e.g. Senior Backend Engineer"
            onChange={(v) => update((f) => ((f.target_roles = v), f))} />
        )}
      </Field>
      {unused.length > 0 && form.target_roles.length < 3 && (
        <div>
          <p className="text-xs text-faint">Ideas</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {unused.map((r) => (
              <button key={r} type="button" onClick={() => update((f) => ((f.target_roles = addChip(f.target_roles, r)), f))}
                className="rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted transition-colors hover:border-brand/50 hover:text-foreground">
                + {r}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function LocationStep({ form, update, errors }: StepProps) {
  return (
    <>
      <fieldset>
        <legend className={labelCls}>Work style</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {WORK_STYLES.map((w) => {
            const on = form.work_style === w;
            return (
              <button key={w} type="button" aria-pressed={on} onClick={() => update((f) => ((f.work_style = on ? "" : w), f))}
                className={cn("rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                  on ? "border-brand bg-brand-soft text-brand-text" : "border-border text-muted hover:bg-surface-hover hover:text-foreground")}>
                {w}
              </button>
            );
          })}
        </div>
      </fieldset>
      <Field label="Countries to search" optional hint="Leave empty to see jobs anywhere." error={errors.search}>
        {(p) => (
          <ChipInput {...p} values={form.search.countries} list="co-countries-search" placeholder="e.g. United Kingdom"
            onChange={(v) => update((f) => ((f.search.countries = v), f))} />
        )}
      </Field>
      <datalist id="co-countries-search">{COUNTRIES.map((c) => <option key={c} value={c} />)}</datalist>
      <Field label="Cities" optional hint="Only if a job must be in a particular city.">
        {(p) => (
          <ChipInput {...p} values={form.search.cities} placeholder="e.g. Berlin"
            onChange={(v) => update((f) => ((f.search.cities = v), f))} />
        )}
      </Field>
      <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
        <input type="checkbox" className="mt-0.5 size-4 accent-[var(--color-brand)]" checked={form.location.needs_sponsorship}
          onChange={(e) => update((f) => ((f.location.needs_sponsorship = e.target.checked), f))} />
        <span>
          <span className="block text-foreground">I need visa sponsorship</span>
          <span className="block text-xs text-faint">Roles that can't sponsor are flagged when we score them.</span>
        </span>
      </label>
    </>
  );
}

function PayStep({ form, update, errors }: StepProps) {
  return (
    <>
      <Field label="Currency" error={errors["compensation.currency"]}>
        {(p) => (
          <select {...p} className={inputCls} value={form.compensation.currency}
            onChange={(e) => update((f) => ((f.compensation.currency = e.target.value), f))}>
            {[...new Set([form.compensation.currency, ...CURRENCIES])].filter(Boolean).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Target range" error={errors["compensation.target_range"]} hint="Total compensation you're aiming for.">
        {(p) => (
          <input {...p} className={inputCls} value={form.compensation.target_range}
            onChange={(e) => update((f) => ((f.compensation.target_range = e.target.value), f))} placeholder="e.g. 150K–200K" />
        )}
      </Field>
      <Field label="Walk-away minimum" optional hint="Below this, you'd rather not apply.">
        {(p) => (
          <input {...p} className={inputCls} value={form.compensation.minimum}
            onChange={(e) => update((f) => ((f.compensation.minimum = e.target.value), f))} placeholder="e.g. 120K" />
        )}
      </Field>
    </>
  );
}

function AiStep({ form, update }: Omit<StepProps, "errors">) {
  return (
    <fieldset className="space-y-3">
      <legend className="sr-only">Spend per evaluation</legend>
      {TIERS.map((t) => {
        const on = form.spend_tier === t.id;
        return (
          <label key={t.id}
            className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
              on ? "border-brand bg-brand-soft" : "border-border hover:bg-surface-hover")}>
            <input type="radio" name="spend_tier" value={t.id} checked={on} className="mt-1 size-4 accent-[var(--color-brand)]"
              onChange={() => update((f) => ((f.spend_tier = t.id), f))} />
            <span>
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                {t.title}
                {t.id === "standard" && <span className="rounded-full bg-surface-hover px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-muted">Default</span>}
              </span>
              <span className="mt-0.5 block text-[13px] text-muted">{t.body}</span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

function ReviewStep({ form, edit }: { form: OnboardingForm; edit: (id: StepId) => void }) {
  const place = [form.location.city, form.location.country].filter(Boolean).join(", ");
  const search = [...form.search.countries, ...form.search.cities];
  const rows: { id: StepId; title: string; lines: string[] }[] = [
    { id: "details", title: "Your details", lines: [form.candidate.full_name, form.candidate.email, `${place} · ${form.location.timezone}`] },
    { id: "roles", title: "Target roles", lines: [form.target_roles.join(", ")] },
    {
      id: "location",
      title: "Where you'll work",
      lines: [
        form.work_style || "No work-style preference",
        search.length ? `Searching ${search.join(", ")}` : "Searching anywhere",
        ...(form.location.needs_sponsorship ? ["Needs visa sponsorship"] : []),
      ],
    },
    {
      id: "pay",
      title: "Compensation",
      lines: [`${form.compensation.currency} ${form.compensation.target_range}${form.compensation.minimum ? ` · minimum ${form.compensation.minimum}` : ""}`],
    },
    { id: "ai", title: "AI usage", lines: [TIERS.find((t) => t.id === form.spend_tier)?.title ?? form.spend_tier] },
  ];
  return (
    <ul className="divide-y divide-border rounded-xl border border-border">
      {rows.map((r) => (
        <li key={r.id} className="flex items-start gap-3 p-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-faint">{r.title}</p>
            {r.lines.filter(Boolean).map((l, i) => (
              <p key={i} className="mt-1 break-words text-sm text-foreground">{l}</p>
            ))}
          </div>
          <button type="button" onClick={() => edit(r.id)} aria-label={`Edit ${r.title}`}
            className="rounded-md p-1.5 text-muted transition-colors hover:bg-surface-hover hover:text-foreground">
            <Pencil className="size-3.5" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function Finished({ headingRef }: { headingRef: React.RefObject<HTMLHeadingElement | null> }) {
  return (
    <div className="flex flex-col items-center text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand-text">
        <Check className="size-6" />
      </span>
      <h1 ref={headingRef} tabIndex={-1} className={`font-display mt-5 text-4xl tracking-tight text-landing outline-none`}>
        Welcome to career-buddy
      </h1>
      <p className="mt-2 max-w-sm text-sm text-muted">
        Your profile and job search are saved. Next, add your CV so we can score offers against your experience.
      </p>
      <div className="mt-8 flex w-full flex-col gap-3">
        <Link href="/" className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground shadow-sm hover:bg-brand-200">
          Go to your dashboard <ArrowRight className="size-4" />
        </Link>
        <Link href="/cv" className="inline-flex w-full items-center justify-center rounded-lg px-4 py-2 text-sm text-muted hover:bg-surface-hover hover:text-foreground">
          Add your CV
        </Link>
      </div>
    </div>
  );
}

const labelCls = "text-sm font-medium text-foreground";
const inputCls =
  "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground shadow-sm placeholder:text-faint focus:border-brand/60 focus:outline-none focus:ring-2 focus:ring-brand/20 aria-[invalid=true]:border-rose-500/60";

type FieldProps = { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string };

function Field({
  label,
  optional,
  hint,
  error,
  children,
}: {
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  children: (p: FieldProps) => React.ReactNode;
}) {
  const id = useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div>
      <label htmlFor={id} className={labelCls}>
        {label}
        {optional && <span className="ml-1.5 text-xs font-normal text-faint">optional</span>}
      </label>
      <div className="mt-1.5">{children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}</div>
      {error ? (
        <p id={`${id}-err`} className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-faint">{hint}</p>
      ) : null}
    </div>
  );
}

function ChipInput({
  values,
  onChange,
  placeholder,
  list,
  ...field
}: FieldProps & { values: string[]; onChange: (v: string[]) => void; placeholder?: string; list?: string }) {
  const [draft, setDraft] = useState("");
  const commit = () => {
    if (!draft.trim()) return;
    onChange(addChip(values, draft));
    setDraft("");
  };
  return (
    <div
      className={cn(inputCls, "flex min-h-[44px] flex-wrap items-center gap-1.5 py-1.5 focus-within:border-brand/60 focus-within:ring-2 focus-within:ring-brand/20",
        field["aria-invalid"] && "border-rose-500/60")}
    >
      {values.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-hover px-2 py-0.5 text-sm text-foreground">
          {v}
          <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}
            className="rounded text-faint hover:text-foreground">
            <X className="size-3.5" />
          </button>
        </span>
      ))}
      <input
        {...field}
        list={list}
        value={draft}
        placeholder={values.length ? "" : placeholder}
        onChange={(e) => {
          const v = e.target.value;
          if (v.endsWith(",")) {
            onChange(addChip(values, v));
            setDraft("");
          } else setDraft(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            // Enter adds the chip; with nothing typed it falls through and submits the step.
            if (draft.trim()) {
              e.preventDefault();
              commit();
            }
          } else if (e.key === "Backspace" && !draft && values.length) {
            onChange(values.slice(0, -1));
          }
        }}
        onBlur={commit}
        className="min-w-[8rem] flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-faint"
      />
    </div>
  );
}

function TimezoneList() {
  const [zones, setZones] = useState<string[]>([]);
  useEffect(() => {
    try {
      setZones((Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf("timeZone"));
    } catch {
      setZones([]);
    }
  }, []);
  return <datalist id="co-timezones">{zones.map((z) => <option key={z} value={z} />)}</datalist>;
}
