import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { legitimacyTone, scoreTone } from "@shared/format";
import { backendJson, toQuery } from "@/lib/backend";
import { Badge } from "@/components/ui/badge";
import { CompanyLogo } from "@/components/company-logo";
import { PageFrame } from "@/components/page-frame";

export const dynamic = "force-dynamic";

type Column = {
  n: string;
  company: string;
  role: string;
  score: string;
  legitimacy: string | null;
  fields: Map<string, string>;
};

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ n?: string | string[] }> }) {
  const { n } = await searchParams;
  const { columns: raw } = await backendJson<{ columns: (Omit<Column, "fields"> & { fields: [string, string][] })[] }>(
    `/api/views/compare${toQuery({ n })}`,
  );
  const columns: Column[] = raw.map((c) => ({ ...c, fields: new Map(c.fields) }));
  const labels = [...new Set(columns.flatMap((c) => [...c.fields.keys()]))];

  return (
    <PageFrame>
      <Link href="/pipeline?tab=all" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-brand">
        <ArrowLeft className="size-4" /> Applications
      </Link>
      <h1 className="mt-5 font-display text-2xl tracking-tight text-landing">Compare</h1>
      {columns.length < 2 ? (
        <p className="mt-4 text-sm text-muted">Select two or three applications in the Pipeline to compare them.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[40rem] table-fixed text-sm">
            <thead className="bg-surface text-left align-top">
              <tr>
                <th className="w-32 px-4 py-3" />
                {columns.map((c) => (
                  <th key={c.n} scope="col" className="px-4 py-3 font-normal">
                    <Link href={`/pipeline/${c.n}`} className="flex items-center gap-2 hover:text-brand">
                      <CompanyLogo name={c.company} size={24} />
                      <span className="font-medium">{c.company}</span>
                    </Link>
                    <p className="mt-1 text-xs text-muted">{c.role}</p>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border align-top">
              <tr>
                <th scope="row" className="px-4 py-2.5 text-left text-xs font-medium text-faint">Score</th>
                {columns.map((c) => (
                  <td key={c.n} className="px-4 py-2.5">
                    {c.score && <Badge tone={scoreTone(c.score)}>{c.score}</Badge>}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row" className="px-4 py-2.5 text-left text-xs font-medium text-faint">Legitimacy</th>
                {columns.map((c) => (
                  <td key={c.n} className="px-4 py-2.5">
                    {c.legitimacy && <Badge tone={legitimacyTone(c.legitimacy)}>{c.legitimacy}</Badge>}
                  </td>
                ))}
              </tr>
              {labels.map((label) => (
                <tr key={label}>
                  <th scope="row" className="px-4 py-2.5 text-left text-xs font-medium text-faint">{label}</th>
                  {columns.map((c) => (
                    <td key={c.n} className="px-4 py-2.5">{c.fields.get(label) ?? ""}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageFrame>
  );
}
