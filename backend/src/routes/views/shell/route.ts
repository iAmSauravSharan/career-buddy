import { readFollowupsEnabled } from "@/lib/followups-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Settings the app shell (navigation) needs on every page.
export async function GET() {
  return Response.json({ followupsEnabled: readFollowupsEnabled() });
}
