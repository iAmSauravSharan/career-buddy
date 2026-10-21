// Read a posting's text on the server, through fetch-jd.mjs, before the agent starts.
//
// The Evaluate run is headless and only has WebFetch, which cannot run JavaScript.
// Ashby (and some Greenhouse boards) render the job description client-side, so
// WebFetch returns a title-only shell and the run correctly refuses to score it.
// fetch-jd.mjs reads the same posting from the ATS's public JSON API, which is
// what the CLI's own batch mode does. A miss (unknown ATS, offline, closed
// posting) returns null and the run falls back to WebFetch exactly as before.
import { execFile } from "node:child_process";
import fs from "node:fs";

const TIMEOUT_MS = 25_000;
const MIN_CHARS = 200; // a title-only answer is a shell, not a job description

/**
 * @param {string} url
 * @param {{ script: string, cwd: string, exec?: typeof execFile }} opts
 * @returns {Promise<string | null>}
 */
export function fetchPostingText(url, { script, cwd, exec = execFile }) {
  if (!/^https?:\/\//i.test(url) || !fs.existsSync(script)) return Promise.resolve(null);
  return new Promise((resolve) => {
    exec(
      process.execPath,
      [script, url],
      { cwd, timeout: TIMEOUT_MS, maxBuffer: 4 << 20, windowsHide: true },
      (err, stdout) => {
        const text = typeof stdout === "string" ? stdout.trim() : "";
        resolve(!err && text.length >= MIN_CHARS ? text : null);
      },
    );
  });
}
