import { careerOpsRoot, readApplications, readInbox, readReport, doctorState } from "@/lib/career-ops";
import { pickAwaitingDecision } from "@shared/home/awaiting.mjs";
import { cardReason } from "@shared/machine-summary.mjs";
import type { CardReason } from "@shared/machine-summary.mjs";
import { todaySnapshot } from "@/lib/home/today-snapshot.mjs";
import { scoreNum, parseReport } from "@shared/format";
import fs from "node:fs";
import * as yaml from "js-yaml";
import { getProfilePath } from "@/lib/core/profile-path.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// First word of candidate.full_name, for the greeting. Empty when there is no
// profile yet or it does not parse; the page then greets without a name.
function firstName(): string {
  try {
    const doc = yaml.load(fs.readFileSync(getProfilePath(careerOpsRoot()), "utf8")) as { candidate?: { full_name?: unknown } } | null;
    const name = doc?.candidate?.full_name;
    return typeof name === "string" ? name.trim().split(/\s+/)[0] ?? "" : "";
  } catch {
    return "";
  }
}

// Everything the home page renders, read fresh per request. A first run (truly
// empty install) returns only the phase: the CV-upload takeover is the home.
export async function GET() {
  const snapshot = { applications: readApplications(), inbox: readInbox() };
  const { phase, onboardingNeeded } = doctorState(snapshot);
  if (phase === "first-run") return Response.json({ phase, onboardingNeeded });

  const { inbox, applications } = todaySnapshot(snapshot, scoreNum);
  const reasons: Record<string, CardReason> = {};
  const legitimacy: Record<string, string> = {};
  for (const app of pickAwaitingDecision(applications, scoreNum)) {
    const content = readReport(app.n)?.content ?? "";
    const reason = cardReason(content);
    if (reason) reasons[app.n] = reason;
    const tier = parseReport(content).legitimacy;
    if (tier) legitimacy[app.n] = tier;
  }
  return Response.json({ phase, onboardingNeeded, applications, inbox, reasons, legitimacy, firstName: firstName() });
}
