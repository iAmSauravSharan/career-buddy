import { readApplications, readApplicationStatusLog, readStatusLog } from "@/lib/career-ops";
import { canonStatus } from "@shared/format";
import { cumulativeProgressWithHistory } from "@/lib/funnel-tiles.mjs";
import { analyticsApplications } from "@/lib/analytics-data";
import { computeProgressMetrics, computeStatsMetrics, generateInsights, resolveAnalyticsView } from "@/lib/analytics-metrics.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Not pipelineSummary: besides the tracker it parses all of
// data/scan-history.tsv to date the inbox, and no analytics view reads the inbox.
// Each view owns its reads, so an incomplete Progress core install must not take
// Insights/Search stats down.
export async function GET(req: Request) {
  const view = resolveAnalyticsView(new URL(req.url).searchParams.get("view") ?? undefined);
  const applications = readApplications();
  const total = applications.length;
  if (view === "insights") return Response.json({ view, total });
  if (view === "search-stats") {
    const metrics = computeStatsMetrics(analyticsApplications(applications));
    return Response.json({ view, total, stats: { metrics, insights: generateInsights(metrics) } });
  }
  const achievements = await cumulativeProgressWithHistory(
    applications.map((app) => ({ n: app.n, status: canonStatus(app.status) })),
    readApplicationStatusLog(),
  );
  return Response.json({
    view,
    total,
    progress: { metrics: computeProgressMetrics(applications, achievements), applications, statusLog: readStatusLog() },
  });
}
