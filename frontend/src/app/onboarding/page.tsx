import type { Metadata } from "next";
import type { OnboardingForm } from "@shared/types";
import { OnboardingStepper } from "@/components/onboarding/onboarding-stepper";
import { backendJson } from "@/lib/backend";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Set up your profile — career-buddy" };

export default async function OnboardingPage() {
  const { form, exists } = await backendJson<{ form: OnboardingForm; exists: { profile: boolean; portals: boolean } }>(
    "/api/views/onboarding",
  );
  return <OnboardingStepper initial={form} hasProfile={exists.profile} />;
}
