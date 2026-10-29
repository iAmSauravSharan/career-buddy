import { Suspense, type ComponentProps } from "react";
import { redirect } from "next/navigation";
import { backendJson, toQuery } from "@/lib/backend";
import { PipelineView } from "@/components/pipeline-view";

export const dynamic = "force-dynamic";

export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const { tab } = await searchParams;
  // The inbox moved to Find jobs ("New for you"); old links still land there.
  if (String((Array.isArray(tab) ? tab[0] : tab) ?? "").toUpperCase() === "INBOX") redirect("/explore?tab=new");
  const view = await backendJson<ComponentProps<typeof PipelineView>>(`/api/views/pipeline${toQuery({ tab })}`);
  return (
    <Suspense>
      <PipelineView applications={view.applications} inboxCount={view.inboxCount} />
    </Suspense>
  );
}
