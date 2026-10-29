import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as yaml from "js-yaml";
import { careerOpsRoot, portalsConfigPath } from "@/lib/career-ops";
import { runCoreCli } from "@/lib/core-cli";
import { atomicWriteWithBackup } from "@/lib/core/safe-write";
import { getProfilePath } from "@/lib/core/profile-path.mjs";
import { isMapping, loadPortalsDocument, PortalsConfigError } from "@/lib/portals-config.mjs";
import { readJsonObject } from "@/lib/json-body";
import {
  deepMerge,
  mergeOnboardingPortals,
  OnboardingError,
  parseForm,
  toCoreAnswers,
  toProfilePatch,
} from "@/lib/onboarding.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Saves the onboarding stepper. config/profile.yml and portals.yml are
// USER-LAYER files, so the two cases differ:
//   - a file that does not exist yet is written by the root onboard-write.mjs,
//     the same writer the agent onboarding uses (built from the templates, with
//     the example person's contact details blanked);
//   - a file that exists gets only the stepper's fields merged in, with a .bak
//     beside it. Archetypes, narrative and tracked companies are never touched.
// Both existing files are read and validated before anything is written, so a
// malformed one refuses the whole save instead of leaving it half done.

const err = (error: string, status: number, field?: string) => Response.json({ error, field }, { status });

export async function POST(req: Request) {
  const body = await readJsonObject(req);
  if (!body) return err("bad json", 400);
  let form;
  try {
    form = parseForm(body);
  } catch (e) {
    if (e instanceof OnboardingError) return err(e.message, 400, e.field);
    throw e;
  }

  const root = careerOpsRoot();
  const profileFile = getProfilePath(root);
  const portalsFile = portalsConfigPath(root);

  let profile: Record<string, unknown> | null = null;
  if (fs.existsSync(profileFile)) {
    let parsed: unknown;
    try {
      parsed = yaml.load(fs.readFileSync(profileFile, "utf8"));
    } catch {
      return err("config/profile.yml exists but is not valid YAML. Fix it first; nothing was saved.", 409);
    }
    if (!isMapping(parsed)) return err("config/profile.yml must contain named settings. Fix it first; nothing was saved.", 409);
    profile = parsed as Record<string, unknown>;
  }

  let portals: Record<string, unknown> | null = null;
  if (fs.existsSync(portalsFile)) {
    try {
      ({ doc: portals } = loadPortalsDocument(portalsFile, path.join(root, "templates", "portals.example.yml")));
    } catch (e) {
      const status = e instanceof PortalsConfigError && e.kind === "invalid-user-config" ? 409 : 500;
      return err(`${e instanceof Error ? e.message : "could not read portals.yml"}. Nothing was saved.`, status);
    }
  }

  let written: string[] = [];
  if (!profile || !portals) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "co-onboarding-"));
    try {
      const answers = path.join(dir, "answers.json");
      fs.writeFileSync(answers, JSON.stringify(toCoreAnswers(form)));
      const result = await runCoreCli("onboard-write", ["--answers", answers]);
      if (result.code !== 0) {
        const reason = result.stderr.split("\n").find((l) => l.trim())?.replace(/^onboard-write:\s*/, "");
        console.error(`/onboarding: onboard-write exit ${result.code}: ${result.stderr.trim()}`);
        return err(reason || "could not write your profile", result.timedOut ? 504 : 500);
      }
      written = (JSON.parse(result.stdout) as { written: string[] }).written;
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  const merged: string[] = [];
  try {
    if (profile) {
      atomicWriteWithBackup(profileFile, yaml.dump(deepMerge(profile, toProfilePatch(form)), { lineWidth: 100, noRefs: true }));
      merged.push("config/profile.yml");
    }
    if (portals) {
      atomicWriteWithBackup(portalsFile, yaml.dump(mergeOnboardingPortals(portals, form), { lineWidth: 100, noRefs: true }));
      merged.push("portals.yml");
    }
  } catch (e) {
    return err(e instanceof Error ? e.message : "write failed", 500);
  }

  return Response.json({ ok: true, written, merged });
}
