import type { ComponentProps } from "react";
import { backendJson } from "@/lib/backend";
import { pipelineQuery } from "@shared/pipeline-navigation.mjs";
import { ApplyChecklist } from "@/components/apply-checklist";

export const dynamic = "force-dynamic";

type ApplyData = Omit<ComponentProps<typeof ApplyChecklist>, "backHref" | "reportHref">;

export default async function ApplyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = pipelineQuery(await searchParams);
  const view = await backendJson<ApplyData>(`/api/views/apply/${encodeURIComponent(id)}`);
  const suffix = query ? `?${query}` : "";
  return <ApplyChecklist {...view} backHref={`/pipeline${suffix}`} reportHref={`/pipeline/${encodeURIComponent(id)}${suffix}`} />;
}
