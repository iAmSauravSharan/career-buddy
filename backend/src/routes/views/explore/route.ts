import fs from "node:fs";
import { seedExploreFilters } from "@/lib/core/portals";
import { readInbox, readApplications, careerOpsRoot } from "@/lib/career-ops";
import { DEFAULT_FILTERS } from "@shared/explore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Discovery seeds are best-effort, so a bare data root still answers.
export async function GET() {
  let seed: { filters: typeof DEFAULT_FILTERS; seededFrom: string[] } = { filters: DEFAULT_FILTERS, seededFrom: [] };
  try {
    seed = seedExploreFilters();
  } catch {
    /* bare checkout → defaults */
  }
  let rootExists = false;
  try {
    rootExists = fs.existsSync(careerOpsRoot());
  } catch {
    /* ignore */
  }
  return Response.json({ seed, inboxSnapshot: readInbox(), appsSnapshot: readApplications(), rootExists });
}
