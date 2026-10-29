import fs from "node:fs";
import * as yaml from "js-yaml";
import { careerOpsRoot, portalsConfigPath } from "@/lib/career-ops";
import { getProfilePath } from "@/lib/core/profile-path.mjs";
import { formFromFiles } from "@/lib/onboarding.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The onboarding stepper's starting values. A file that is missing or does not
// parse reads as empty here; the save route is the one that refuses to
// overwrite a malformed file.
function readYaml(file: string): Record<string, unknown> | null {
  try {
    const parsed = yaml.load(fs.readFileSync(file, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const root = careerOpsRoot();
  const profileFile = getProfilePath(root);
  const portalsFile = portalsConfigPath(root);
  return Response.json({
    form: formFromFiles(readYaml(profileFile), readYaml(portalsFile)),
    exists: { profile: fs.existsSync(profileFile), portals: fs.existsSync(portalsFile) },
  });
}
