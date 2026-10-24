# Working in `backend/`

The API server of the web app: a Hono app on Node (`src/app.ts`, started by
`src/server.ts`). It is a **view over the user's own files**, not a second engine.
Read this before changing anything under `backend/`.

## Layout

- `src/routes/**/route.ts` — one module per path, exporting `GET`/`POST`/... as
  plain `(req: Request, { params }) => Response` functions. A `[name]` directory is
  a path parameter. `npm run gen:routes` rewrites `src/routes.gen.ts`, the table
  the server mounts; `npm run typecheck` fails while it is stale.
- `src/routes/views/*` — one endpoint per frontend page, returning exactly the data
  that page renders.
- `src/lib/` — server code: file access, core-script runners, CLI spawning.
- `scripts/` — the scheduled-scan runner and its OS schedule installers.

## The three rules that are not style preferences

1. **Orchestrate the core; never reimplement it.** The CLI already resolves tracker
   paths, matches tailored CVs and canonicalises statuses: call it, or mirror it
   behind a parity test. A second implementation of the same rule is how the two
   halves start disagreeing, and the disagreement is always silent.
   `src/lib/core/` holds the access layer for exactly this.

2. **Markdown is the source of truth.** `data/applications.md`, `cv.md`, `reports/`
   are canonical; anything else is a derived index. Status changes go through
   `/api/status`, which delegates to the root `set-status.mjs`. That is the single
   write path, and it is single on purpose. Never write a user's file from a route
   that bypasses it.

3. **Nothing is ever submitted automatically.** The apply flow fills in and previews;
   a human presses send. There is no exception, no flag, and no "just for testing".
   The browser is the Playwright session from `apply-scope.mjs`. Do not attach to
   the user's open Chrome, read `DevToolsActivePort`, or pass a remote-debugging port.

## A missing file is not a malformed file

Treating a parse error as "not there yet" is how a user's config gets overwritten
with the shipped example. Distinguish `ENOENT` from every other failure, and let a
broken user-layer file surface as an error the user can act on rather than as an
empty default. (`src/lib/portals-config.mjs` is the worked example.)

## Testing

Logic that deserves a test lives in a plain `.mjs` module so `node --test` can import
it with no build step. Suites that import `.ts` load the alias hook first
(`tests/helpers/web-ts-alias-loader.mjs`).

```
npm test           # node --test "tests/**/*.test.mjs"
npm run typecheck  # route table check + tsc --noEmit
npm run dev        # the API on 127.0.0.1:3001, reading the sibling career-ops files
```

Point `CAREER_OPS_ROOT` at a scratch directory when you need data to test against;
it is how the API finds the user's files, and it keeps your real pipeline out of it.
