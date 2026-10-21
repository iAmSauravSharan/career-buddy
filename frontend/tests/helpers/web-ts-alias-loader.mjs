// The alias hook lives in shared/test-support so every package resolves `@/`
// and `@shared/` the same way; see that file for how it works and how to use it.
import "../../../shared/test-support/ts-alias-loader.mjs?default=frontend";
