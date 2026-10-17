# career-buddy CI/CD

Two fork-only workflows, kept separate from upstream's so `git pull --rebase upstream main` never conflicts.

| Workflow | Trigger | What it does |
|---|---|---|
| `.github/workflows/buddy-ci.yml` | every push, every PR | core: `npm run lint` + `node test-all.mjs --quick`; web: `npm test`, `tsc --noEmit`, `next build` |
| `.github/workflows/buddy-vercel-preview.yml` | every push, every PR | builds `web/` and deploys a Vercel **preview**; PRs get the URL as a comment |

## One-time Vercel setup

1. Create a Vercel project from this repo (or `vercel link` locally). In **Settings > General**, set **Root Directory** to `web`. Leave "Include source files outside of the Root Directory" on.
2. Take the IDs from `.vercel/project.json` after `vercel link`: `orgId` and `projectId`. Create a token at https://vercel.com/account/tokens.
3. Add three repo secrets (Settings > Secrets and variables > Actions): `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.

Until the secrets exist the preview job logs a notice and exits green.

If you would rather use Vercel's own GitHub integration (auto-previews, no secrets), import the repo in the Vercel dashboard with Root Directory `web` and delete `buddy-vercel-preview.yml` so you do not deploy twice.

## What the preview is

A UI preview only. The dashboard is local-first: it reads your CV, tracker and reports from disk and runs your local AI CLI. A Vercel deployment has none of that, so it starts empty and the AI-backed actions do not work. Your personal files are gitignored and are never part of what CI builds.
