import type { ComponentProps } from "react";
import { backendJson } from "@/lib/backend";
import { OnboardingBanner } from "@/components/onboarding-banner";
import { OnboardingProgress } from "@/components/home/onboarding-progress";
import { FirstRunHome } from "@/components/home/first-run-home";
import { TodayDashboard } from "@/components/home/today-dashboard";

export const dynamic = "force-dynamic"; // always fresh at request time (never at build — CI has no user data)

type Dashboard = ComponentProps<typeof TodayDashboard>;
type HomeView =
  | { phase: "first-run"; onboardingNeeded: boolean }
  | ({ phase: "in-between" | "established"; onboardingNeeded: boolean } & Pick<Dashboard, "applications" | "reasons" | "legitimacy" | "inbox">);

export default async function Home() {
  const view = await backendJson<HomeView>("/api/views/home");
  // First run (truly empty install): the CV-upload takeover IS the home — value
  // before commitment. The full dashboard returns once they have a CV or any data.
  if (view.phase === "first-run") return <FirstRunHome />;

  // Established / in-between: the dual-loop retention dashboard. Show the setup
  // banner whenever ANY prereq is missing (mirrors the core doctor.mjs), so a
  // portals-missing user is nudged rather than told "all caught up".
  return (
    <>
      {view.onboardingNeeded && <OnboardingBanner />}
      {/* The growing-profile panel stays until every prerequisite AND every
          personalization section is theirs — it renders nothing once complete. */}
      <div className="mx-auto max-w-5xl px-6 pt-6">
        <OnboardingProgress />
      </div>
      <TodayDashboard
        applications={view.applications}
        reasons={view.reasons}
        legitimacy={view.legitimacy}
        inbox={view.inbox}
        inBetween={view.phase === "in-between"}
      />
    </>
  );
}
