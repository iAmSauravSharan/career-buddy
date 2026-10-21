import { readApplications, readInbox, readReport, doctorState } from "@/lib/career-ops";
import { pickAwaitingDecision } from "@shared/home/awaiting.mjs";
import { cardReason } from "@shared/machine-summary.mjs";
import type { CardReason } from "@shared/machine-summary.mjs";
import { todaySnapshot } from "@/lib/home/today-snapshot.mjs";
import { scoreNum, parseReport } from "@shared/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  return Response.json({ phase, onboardingNeeded, applications, inbox, reasons, legitimacy });
}
