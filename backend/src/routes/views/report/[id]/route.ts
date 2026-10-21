import { readReport, findApplication, pdfReadyForReport, trackerCanDelete } from "@/lib/career-ops";
import { resolveTailoredCover } from "@/lib/apply/cover";
import { reportNumberFor } from "@/lib/apply-checklist.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteContext) {
  const { id } = await params;
  const app = findApplication(id);
  const report = readReport(id);
  if (!app && !report) return Response.json({ error: "Not found" }, { status: 404 });
  // Resolved here so the link is only rendered when THIS application's cover is
  // actually on disk. `id` is passed as the application number, never as a
  // company: a report with no tracker row has no identity to match on, and
  // guessing one from the id would surface another offer's cover.
  const coverReady = (await resolveTailoredCover(app?.company, id)) !== null;
  return Response.json({
    app: app ?? null,
    report: report?.content ?? null,
    file: report?.file ?? null,
    canDelete: trackerCanDelete(),
    pdfReadyFromIndex: await pdfReadyForReport(id),
    coverReady,
    reportNum: reportNumberFor(id, app, report?.file ?? null),
  });
}
