import { pipelineSummary } from "@/lib/career-ops";
import { pendingInbox } from "@/lib/inbox-pending.mjs";
import { pipelineTab } from "@shared/pipeline-navigation.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Tracker tabs show the inbox only as a count, so they get the count and not
// the postings. The inbox is most of the payload on a large pipeline.
export async function GET(req: Request) {
  const tab = new URL(req.url).searchParams.get("tab") ?? undefined;
  const onInbox = pipelineTab(tab) === "INBOX";
  const { inbox, applications } = pipelineSummary();
  const pending = pendingInbox(inbox);
  return Response.json({ applications, inbox: onInbox ? pending : null, inboxCount: pending.length });
}
