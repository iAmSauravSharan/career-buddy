// The dashboard's headline numbers and pipeline summary, counted from the
// tracker rows the home view already has. Stages come from canonStatus, the
// same mapping the Applications page filters on, so a number here always
// matches what its link opens.

import { canonStatus } from "@shared/status-alias.mjs";

/** Stages that mean "still in play after you applied". */
const ACTIVE = new Set(["APPLIED", "RESPONDED", "ASSESSMENT", "INTERVIEW"]);

/**
 * @param {{ status?: string }[]} applications
 * @returns {{ active: number, interviews: number, offers: number, evaluated: number, applied: number, responded: number }}
 */
export function homeStats(applications) {
  const c = { active: 0, interviews: 0, offers: 0, evaluated: 0, applied: 0, responded: 0 };
  for (const app of applications) {
    const stage = canonStatus(app.status ?? "");
    if (ACTIVE.has(stage)) c.active++;
    if (stage === "INTERVIEW") c.interviews++;
    if (stage === "OFFER" || stage === "HIRED") c.offers++;
    if (stage === "EVALUATED") c.evaluated++;
    // "Ever applied": everything past the decision, including outcomes.
    if (ACTIVE.has(stage) || ["OFFER", "HIRED", "REJECTED"].includes(stage)) c.applied++;
    if (["RESPONDED", "ASSESSMENT", "INTERVIEW", "OFFER", "HIRED"].includes(stage)) c.responded++;
  }
  return c;
}

/** "Good morning" / "Good afternoon" / "Good evening" for a local hour. */
export function greeting(hour) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
