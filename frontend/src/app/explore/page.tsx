import type { ComponentProps } from "react";
import { backendJson } from "@/lib/backend";
import { ExplorerView } from "@/components/explore/explorer-view";

export const dynamic = "force-dynamic";

export default async function ExplorePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [view, sp] = await Promise.all([backendJson<ComponentProps<typeof ExplorerView>>("/api/views/explore"), searchParams]);
  // Pick the segment on the server so the first paint is already right: an
  // explicit ?tab=, else any search parameter means "open on Search".
  const initialTab = sp.tab === "new" ? "new" : sp.tab === "search" || Object.keys(sp).some((k) => k !== "tab") ? "search" : undefined;
  return (
    <ExplorerView seed={view.seed} inboxSnapshot={view.inboxSnapshot} appsSnapshot={view.appsSnapshot} rootExists={view.rootExists} initialTab={initialTab} />
  );
}
