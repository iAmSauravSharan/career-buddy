import path from "node:path";
import { careerOpsRoot, portalsConfigPath } from "@/lib/career-ops";
import { loadPortalsDocument, watchedCompanies } from "@/lib/portals-config.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const root = careerOpsRoot();
  try {
    const { doc, seeded } = loadPortalsDocument(portalsConfigPath(root), path.join(root, "templates", "portals.example.yml"));
    return Response.json({ watched: seeded ? [] : watchedCompanies(doc), error: null });
  } catch (e) {
    return Response.json({ watched: [], error: e instanceof Error ? e.message : String(e) });
  }
}
