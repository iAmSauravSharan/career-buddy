import type { ComponentProps } from "react";
import { backendJson } from "@/lib/backend";
import { ExplorerView } from "@/components/explore/explorer-view";

export const dynamic = "force-dynamic";

export default async function ExplorePage() {
  const view = await backendJson<ComponentProps<typeof ExplorerView>>("/api/views/explore");
  return (
    <ExplorerView seed={view.seed} inboxSnapshot={view.inboxSnapshot} appsSnapshot={view.appsSnapshot} rootExists={view.rootExists} />
  );
}
