"use client";

import { usePathname } from "next/navigation";
import { AssistantConsole } from "@/components/assistant-console";
import { MobileNav } from "@/components/mobile-nav";
import { BackToTop } from "@/components/back-to-top";
import { JobsProvider } from "@/components/jobs/job-store";
import { PipelineProvider } from "@/components/pipeline/pipeline-provider";
import { ApplyProvider } from "@/components/apply/apply-provider";
import { ExploreProvider } from "@/components/explore/explore-provider";
import { FirstScoreView } from "@/components/explore/first-score-view";
import { BetaBanner } from "@/components/beta/beta-banner";
import { Sidebar } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/top-bar";
import { QuickFind } from "@/components/shell/quick-find";
import { BottomTabs } from "@/components/shell/bottom-tabs";

export function AppShell({ children, followupsEnabled }: { children: React.ReactNode; followupsEnabled: boolean }) {
  const pathname = usePathname();
  // Onboarding is a full-screen flow of its own: no navigation, no assistant.
  if (pathname === "/onboarding" || pathname.startsWith("/onboarding/")) return <main id="main">{children}</main>;
  return (
    <JobsProvider>
      <PipelineProvider>
      <ApplyProvider>
      <ExploreProvider>
      <a href="#main" className="skip-link">Skip to content</a>
      <MobileNav followupsEnabled={followupsEnabled} />
      <div className="flex min-h-screen">
        <Sidebar followupsEnabled={followupsEnabled} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main id="main" tabIndex={-1} className="flex-1 overflow-x-hidden pb-[var(--tabbar-h)] outline-none">{children}</main>
        </div>
        <AssistantConsole />
        <BackToTop />
        <FirstScoreView />
        <BetaBanner />
        <QuickFind followupsEnabled={followupsEnabled} />
        <BottomTabs followupsEnabled={followupsEnabled} />
      </div>
      </ExploreProvider>
      </ApplyProvider>
      </PipelineProvider>
    </JobsProvider>
  );
}
