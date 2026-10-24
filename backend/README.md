# career-buddy web app — backend

The API server behind `../frontend/`: a [Hono](https://hono.dev) app on Node that
serves every `/api/*` route and drives the career-ops core scripts in the repository
root. See `AGENTS.md` for the rules any change here follows.

## Run

```bash
npm ci
npm start          # 127.0.0.1:3001
npm run dev        # same, restarting on change
```

| Variable | Default | What it does |
|----------|---------|--------------|
| `HOST` | `127.0.0.1` | Interface to bind. Anything wider exposes the user's data and the CLI runners. |
| `PORT` | `3001` | Port to listen on. The frontend reaches it through `BACKEND_URL`. |
| `CAREER_OPS_ROOT` | the repository root | Where the user's files (cv.md, data/, reports/) live. |
| `CAREER_OPS_CODE_ROOT` | the repository root | The checkout whose core scripts run. |
| `CAREER_OPS_WEB_ALLOWED_HOSTS` / `CAREER_OPS_ALLOWED_ORIGINS` | unset | Widen the same-origin + loopback guard; see `../frontend/README.md`. |

`GET /healthz` answers `{ "ok": true }` once the server is up.

## Routes

Each `src/routes/<path>/route.ts` exports one function per HTTP method. A `[name]`
directory is a path parameter. After adding or removing a route, run
`npm run gen:routes`; `npm run typecheck` fails while `src/routes.gen.ts` is stale.

`src/routes/views/*` return the data each frontend page renders, one endpoint per page.

## Check

```bash
npm test           # node --test "tests/**/*.test.mjs"
npm run typecheck  # route table + tsc --noEmit
```
