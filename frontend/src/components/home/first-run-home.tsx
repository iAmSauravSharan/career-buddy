"use client";

import { CvIngest } from "@/components/cv/cv-ingest";
import { OnboardingProgress } from "@/components/home/onboarding-progress";

// The first-run takeover: when cv.md is missing, the CV upload IS the home.
// One input and a short promise; the setup checklist sits under it so what
// comes next is visible from the first second.
export function FirstRunHome() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 md:py-14">
      <section className="rounded-xl border border-border bg-surface px-6 py-8 shadow-[0_1px_2px_rgb(15_17_21/0.04)] md:px-10 md:py-10">
        <div>
          <p className="text-sm font-medium text-brand-text">Step 1 · Your CV</p>
          <h1 className={`font-display mt-2 text-3xl tracking-tight text-foreground md:text-4xl`}>
            Drop your CV. See who&apos;s hiring you in 60 seconds.
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">
            No account. Paste text or drop a .md / .txt file to start. A PDF needs an AI CLI in{" "}
            <a href="/config" className="font-medium text-brand-text underline-offset-2 hover:underline">
              Settings
            </a>{" "}
            first. The market scan is <span className="text-foreground">free</span>. You only spend tokens when you
            choose to score a role.
          </p>
          <div className="mt-7">
            <CvIngest />
          </div>
        </div>
      </section>
      {/* What comes after the CV, visible from the first second: the same checklist
          that keeps growing on Today once the CV is in. */}
      <div className="mt-6">
        <OnboardingProgress compact />
      </div>
    </div>
  );
}
