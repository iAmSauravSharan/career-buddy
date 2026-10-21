import fs from "node:fs";
import path from "node:path";
import { careerOpsRoot } from "@/lib/career-ops";
import { atomicWriteWithBackup } from "@/lib/core/safe-write";
import { readJsonObject } from "@/lib/json-body";

function cvPath() {
  return path.join(careerOpsRoot(), "cv.md");
}

const MAX_CV_BYTES = 200_000;

export async function GET() {
  try {
    return Response.json({ content: fs.readFileSync(cvPath(), "utf8"), exists: true });
  } catch {
    return Response.json({ content: "", exists: false });
  }
}

export async function POST(req: Request) {
  const body = await readJsonObject<{ content?: string }>(req);
  if (!body) return Response.json({ error: "bad json" }, { status: 400 });
  if (typeof body.content !== "string") {
    return Response.json({ error: "content required" }, { status: 400 });
  }
  if (Buffer.byteLength(body.content, "utf8") > MAX_CV_BYTES) {
    return Response.json({ error: "CV is too large (over 200KB)" }, { status: 413 });
  }
  // DATA_CONTRACT: cv.md is user-layer and gitignored (no git recovery). Never
  // blind-overwrite — snapshot the prior CV to a .bak first, write atomically.
  try {
    const bak = atomicWriteWithBackup(cvPath(), body.content);
    return Response.json({ ok: true, backedUp: !!bak });
  } catch {
    return Response.json({ error: "write failed" }, { status: 500 });
  }
}
