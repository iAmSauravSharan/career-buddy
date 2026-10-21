import type { ComponentProps } from "react";
import { backendJson, toQuery } from "@/lib/backend";
import { PipelineSankey } from "@/components/analytics/pipeline-sankey";
import { AnalyticsShell, ProgressPanel, StatsPanel } from "@/components/analytics-view";
import { FunnelRates } from "@/components/analytics/funnel-rates";
import { SearchInsights } from "@/components/analytics/search-insights";

export const dynamic = "force-dynamic";

type AnalyticsView = {
  view: ComponentProps<typeof AnalyticsShell>["view"];
  total: number;
  progress?: ComponentProps<typeof ProgressPanel> & ComponentProps<typeof PipelineSankey>;
  stats?: ComponentProps<typeof StatsPanel>;
};

export default async function Analytics({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { view: requested } = await searchParams;
  // One URL contract for all three views; the backend resolves which one.
  const data = await backendJson<AnalyticsView>(`/api/views/analytics${toQuery({ view: requested })}`);
  return (
    <AnalyticsShell total={data.total} view={data.view}>
      {data.view === "insights" ? (
        <SearchInsights />
      ) : data.view === "search-stats" ? (
        data.stats && <StatsPanel metrics={data.stats.metrics} insights={data.stats.insights} />
      ) : (
        data.progress && (
          <>
            <ProgressPanel metrics={data.progress.metrics} />
            <PipelineSankey applications={data.progress.applications} statusLog={data.progress.statusLog} />
            <FunnelRates />
          </>
        )
      )}
    </AnalyticsShell>
  );
}
