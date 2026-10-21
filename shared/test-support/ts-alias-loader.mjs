// Node ESM resolver hook that teaches `node --test` (no ts-node/tsx in the test
// runs) to follow the import aliases the TypeScript sources use:
//
//   @/…        → <package>/src/… of the importing file (frontend or backend)
//   @shared/…  → shared/src/…
//
// mirroring each package's tsconfig `paths`, which only bundlers understand
// natively. Node 22 already type-strips .ts on import — this hook is ONLY about
// specifier resolution, not transpilation.
//
// Usage: import this module for side effect (each package re-exports it as
// tests/helpers/web-ts-alias-loader.mjs), THEN reach the aliased module with a
// dynamic import, so the hook is installed before that specifier is resolved:
//
//   import "../helpers/web-ts-alias-loader.mjs";
//   const { thing } = await import("../../src/lib/thing.ts");
//
// A static `import … from "…/thing.ts"` would NOT work: ESM resolves every static
// specifier in a module before any of its bodies run, so the hook would still be
// uninstalled at the moment it is needed.
import { register } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

// register() re-imports THIS file in a separate loader realm to install the
// resolve() hook below. The flag is an observable, not a guard: that realm gets
// its own globalThis, so it re-enters this branch and calls register() again on
// the hooks thread — harmlessly, the resolve chain gains no second link.
if (!globalThis.__careerOpsWebAliasRegistered) {
  globalThis.__careerOpsWebAliasRegistered = true;
  register(import.meta.url, import.meta.url);
}

// Anchored to this file, not process.cwd(), so a package's `npm test` and a
// root-level `node --test <package>/tests/…` resolve the same files.
const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = {
  frontend: path.join(REPO, "frontend", "src"),
  backend: path.join(REPO, "backend", "src"),
  shared: path.join(REPO, "shared", "src"),
};
const HAS_EXT = /\.(m?[jt]sx?|json)$/i;
// Which package `@/` means when the importer names none (an --eval driver, a
// temp-dir script): the package whose helper imported this loader, carried in
// its URL as `?default=<package>` so it survives into the hooks realm.
const DEFAULT_PKG = new URL(import.meta.url).searchParams.get("default");
const TRY = [".ts", ".tsx", ".mjs"];

/** The package (frontend | backend | shared) a file belongs to, or null. */
function packageOf(file) {
  const rel = path.relative(REPO, file);
  const top = rel.split(path.sep)[0];
  return top in SRC && !rel.startsWith("..") ? top : null;
}

function inAnySrc(dir) {
  return Object.values(SRC).some((src) => dir === src || dir.startsWith(src + path.sep));
}

function pick(base, specifier) {
  // Specifiers that already name an extension resolve as-is; extensionless
  // ones (the TS convention) try .ts, .tsx then .mjs. Falling back to the FIRST
  // candidate keeps Node's own error useful: a miss reports the absent file.
  const candidates = HAS_EXT.test(specifier) ? [base] : TRY.map((e) => base + e);
  return candidates.find((c) => existsSync(c)) ?? candidates[0];
}

export async function resolve(specifier, context, nextResolve) {
  const parent = context.parentURL?.startsWith("file:") ? fileURLToPath(context.parentURL) : null;
  // Extensionless RELATIVE specifiers ("./portals") are the same TS convention
  // as the alias form; only those from inside a package's src are followed, so
  // no other module's resolution changes.
  if (parent && /^\.\.?\//.test(specifier) && !HAS_EXT.test(specifier)) {
    const from = path.dirname(parent);
    if (inAnySrc(from)) {
      const hit = TRY.map((e) => path.resolve(from, specifier) + e).find((c) => existsSync(c));
      if (hit) return nextResolve(pathToFileURL(hit).href, context);
    }
  }
  if (specifier.startsWith("@shared/")) {
    return nextResolve(pathToFileURL(pick(path.join(SRC.shared, specifier.slice(8)), specifier)).href, context);
  }
  if (specifier.startsWith("@/")) {
    // A driver written to a temp dir belongs to no package; it runs with its
    // package as cwd, so that names the src its `@/` means.
    const pkg =
      (parent && packageOf(parent)) || packageOf(path.join(process.cwd(), "x")) || DEFAULT_PKG || "frontend";
    const root = pkg === "shared" ? SRC.frontend : SRC[pkg];
    return nextResolve(pathToFileURL(pick(path.join(root, specifier.slice(2)), specifier)).href, context);
  }
  return nextResolve(specifier, context);
}
