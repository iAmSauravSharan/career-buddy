# Working in `frontend/`

The UI of the web app. It renders what the backend (`../backend/`) returns and
never touches the user's files itself. Read `../backend/AGENTS.md` for the rules
about those files: they bind every change that reaches them, whichever side
starts it.

## The boundary rule

**No filesystem, no child processes, no core scripts here.** A page that needs
data calls the backend from the server with `backendJson()` (`src/lib/backend.ts`),
usually through a `/api/views/<page>` endpoint shaped for exactly that page. A
client component calls a relative `/api/...` URL, which `next.config.mjs` rewrites
to the backend. If a page needs something no endpoint returns, add the endpoint in
the backend; do not import `node:fs` here.

Code both sides use goes in `../shared/src/` and is imported as `@shared/...`. It
must stay pure: no Node built-ins and no I/O, because it is bundled into the browser.
A type that crosses the wire goes in `shared/src/types.ts`.

Nothing is ever submitted automatically. The apply flow fills in and previews; a
human presses send.

## Testing

Logic that deserves a test lives in a plain `.mjs` module so `node --test` can import
it with no build step. A component is not a place to put a rule you want to assert.

```
npm test          # node --test "tests/**/*.test.mjs"
npx tsc --noEmit  # typecheck
npm run dev       # the UI; start the backend too (or `npm run ui` at the repo root)
```

<!-- The block below is written and re-added by `next dev`. It is committed
     deliberately: keeping it in the file means Next updates only the marked
     region and never scaffolds a separate CLAUDE.md, so an agent's instructions
     here stay reviewable in a diff instead of appearing untracked. -->

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
