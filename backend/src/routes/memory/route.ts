import { readMemory, rememberFact } from "@/lib/career-ops";
import { readJsonObject } from "@/lib/json-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ memory: readMemory() });
}

// Append a durable fact the assistant learned about the user. Written to the
// CANONICAL modes/_profile.md (single source of truth) so the CLI/TUI see it too
// — never a web-only memory store.
export async function POST(req: Request) {
  const b = await readJsonObject<{ fact?: string }>(req);
  if (!b) return Response.json({ error: "bad json" }, { status: 400 });
  const fact = (b.fact ?? "").toString();
  if (!fact.trim()) return Response.json({ error: "fact required" }, { status: 400 });

  const result = rememberFact(fact);
  if (result === "error") return Response.json({ error: "write failed" }, { status: 500 });
  return Response.json({ ok: true, deduped: result === "deduped" });
}
