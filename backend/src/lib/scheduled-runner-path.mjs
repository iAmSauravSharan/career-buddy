import path from "node:path";

// The single store-path resolver shared by the API server and the local
// scheduler runner (backend/scripts/scheduled-jobs-runner.mjs).
export function scheduledStorePath(root, configuredPath = process.env.CAREER_OPS_SCHEDULED_JOBS_PATH) {
  if (configuredPath) return path.isAbsolute(configuredPath) ? configuredPath : path.resolve(root, configuredPath);
  return path.join(root, "data", "scheduled-jobs.json");
}

export function scheduledRunnerResourcePath(storePath) {
  return `${storePath}.runner`;
}
