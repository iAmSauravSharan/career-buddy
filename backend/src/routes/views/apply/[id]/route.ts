import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { careerOpsRoot, findApplication, isRegularContainedFile, readReport, rootScript } from "@/lib/career-ops";
import { resolvePdfIndexPath } from "@/lib/core/pdf-index";
import { parseReport } from "@shared/format";
import { resolvePostingUrl } from "@shared/posting-url.mjs";
import { answerCopyItems, cvCopyFields, indexedPdf, PORTAL_TIPS, reportNumberFor } from "@/lib/apply-checklist.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

function fileUnderOutput(root: string, abs: string): boolean {
  return isRegularContainedFile(abs, path.join(root, "output"));
}

function readIfPresent(file: string): string | null {
  try {
    return fs.readFileSync(file, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    return null;
  }
}

// The apply checklist: copy-ready answers, CV fields and the tailored PDFs.
export async function GET(_req: Request, { params }: RouteContext) {
  const { id } = await params;
  const app = findApplication(id);
  const report = readReport(id);
  if (!app && !report) return Response.json({ error: "Not found" }, { status: 404 });

  const reportNum = reportNumberFor(id, app, report?.file ?? null);
  const reportUrl = report ? parseReport(report.content).fields.find((field) => field.label === "URL")?.value : "";
  const postingUrl = resolvePostingUrl((app as { url?: string } | null)?.url, reportUrl);

  let answers: { label: string; text: string }[] = [];
  if (report?.content) {
    const mod = await import(/* webpackIgnore: true */ pathToFileURL(rootScript("application-answers")).href);
    const snapshot = mod.parseApplicationAnswersSection(report.content, { strict: true });
    answers = answerCopyItems(snapshot);
  }

  const root = careerOpsRoot();
  const cvText = readIfPresent(path.join(root, "cv.md"));
  const fields = cvText == null ? { work: [], education: "" } : cvCopyFields(cvText);

  const indexPath = await resolvePdfIndexPath();
  const indexText = (indexPath && readIfPresent(indexPath)) || "";
  const resumeHit = reportNum == null ? null : indexedPdf(indexText, reportNum, "cv", root, (abs: string) => fileUnderOutput(root, abs));
  const coverHit = reportNum == null ? null : indexedPdf(indexText, reportNum, "cover", root, (abs: string) => fileUnderOutput(root, abs));

  return Response.json({
    company: app?.company || parseReport(report?.content ?? "").title || `Report #${id}`,
    role: app?.role ?? "",
    postingUrl,
    resume: resumeHit ? { relativePath: resumeHit.relativePath, downloadHref: `/api/cv-pdf?n=${reportNum}` } : null,
    cover: coverHit ? { relativePath: coverHit.relativePath, downloadHref: `/api/cv-pdf?n=${reportNum}&kind=cover` } : null,
    answers,
    work: fields.work,
    education: fields.education,
    cvMissing: cvText == null,
    tips: PORTAL_TIPS,
    trackerNum: app?.n ?? null,
    reportNum,
    status: app?.status ?? "",
    pdfReady: (app?.pdf ?? "").includes("✅"),
  });
}
