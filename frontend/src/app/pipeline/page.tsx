import { Suspense, type ComponentProps } from "react";
import { backendJson, toQuery } from "@/lib/backend";
import { PipelineView } from "@/components/pipeline-view";

export const dynamic = "force-dynamic";

export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const { tab } = await searchParams;
  const view = await backendJson<ComponentProps<typeof PipelineView>>(`/api/views/pipeline${toQuery({ tab })}`);
  return (
    <Suspense>
      <PipelineView applications={view.applications} inbox={view.inbox} inboxCount={view.inboxCount} />
    </Suspense>
  );
}
