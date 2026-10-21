import type { ComponentProps } from "react";
import { backendJson } from "@/lib/backend";
import { ReportView } from "@/components/report-view";
import { pipelineQuery } from "@shared/pipeline-navigation.mjs";

export const dynamic = "force-dynamic";

type ReportData = Omit<ComponentProps<typeof ReportView>, "id" | "backHref" | "applyHref">;

export default async function ReportPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = pipelineQuery(await searchParams);
  // 404s (no tracker row and no report) become notFound() in backendJson.
  const view = await backendJson<ReportData>(`/api/views/report/${encodeURIComponent(id)}`);
  return (
    <ReportView
      {...view}
      id={id}
      backHref={`/pipeline${query ? `?${query}` : ""}`}
      applyHref={`/pipeline/${encodeURIComponent(id)}/apply${query ? `?${query}` : ""}`}
    />
  );
}
