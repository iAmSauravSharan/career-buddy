import type { ComponentProps } from "react";
import { backendJson } from "@/lib/backend";
import { FirstRunHome } from "@/components/home/first-run-home";
import { TodayDashboard } from "@/components/home/today-dashboard";

export const dynamic = "force-dynamic"; // always fresh at request time (never at build — CI has no user data)

type Dashboard = ComponentProps<typeof TodayDashboard>;
type HomeView =
  | { phase: "first-run"; onboardingNeeded: boolean }
  | ({ phase: "in-between" | "established"; onboardingNeeded: boolean; firstName?: string } & Pick<
      Dashboard,
      "applications" | "reasons" | "legitimacy" | "inbox"
    >);

export default async function Home() {
  const view = await backendJson<HomeView>("/api/views/home");
  // First run (truly empty install): the CV-upload takeover IS the home — value
  // before commitment. The dashboard returns once they have a CV or any data.
  if (view.phase === "first-run") return <FirstRunHome />;

  // Unfinished setup shows as one compact card in the dashboard's side rail
  // (OnboardingProgress), not as banners above the page.
  return (
    <TodayDashboard
      applications={view.applications}
      reasons={view.reasons}
      legitimacy={view.legitimacy}
      inbox={view.inbox}
      inBetween={view.phase === "in-between"}
      firstName={view.firstName}
    />
  );
}
