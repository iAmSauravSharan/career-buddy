import { findApplication, readReport } from "@/lib/career-ops";
import { parseReport } from "@shared/format";
import { compareIds, summaryFields } from "@shared/pipeline-compare.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Column = {
  n: string;
  company: string;
  role: string;
  score: string;
  legitimacy: string | null;
  // Ordered [label, value] pairs: a Map does not survive JSON.
  fields: [string, string][];
};

function column(n: string): Column | null {
  const app = findApplication(n);
  const report = readReport(n);
  if (!app && !report) return null;
  const meta = report ? parseReport(report.content) : null;
  const field = (label: string) => meta?.fields.find((f) => f.label === label)?.value ?? "";
  const fields = new Map<string, string>();
  if (app?.status) fields.set("Status", app.status);
  if (app?.date || field("Date")) fields.set("Date", app?.date || field("Date"));
  if (field("Archetype")) fields.set("Archetype", field("Archetype"));
  for (const f of meta ? summaryFields(meta.body) : []) fields.set(f.label, f.value);
  return {
    n,
    company: app?.company ?? meta?.title ?? `#${n}`,
    role: app?.role ?? "",
    score: app?.score || field("Score"),
    legitimacy: meta?.legitimacy ?? null,
    fields: [...fields.entries()],
  };
}

export async function GET(req: Request) {
  const columns = compareIds(new URL(req.url).searchParams.getAll("n"))
    .map(column)
    .filter((c: Column | null): c is Column => c !== null);
  return Response.json({ columns });
}
