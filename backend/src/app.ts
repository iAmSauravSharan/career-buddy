import { Hono } from "hono";
import { checkRequest, parseAllowedHosts, parseAllowedOrigins } from "@shared/origin-guard.mjs";
import { METHODS, type RouteHandler } from "./route-module";
import { routes } from "./routes.gen";

/**
 * The API application, separate from server.ts so tests can call
 * `app.request()` without opening a socket.
 */
export function createApp() {
  const app = new Hono();

  app.get("/healthz", (c) => c.json({ ok: true }));

  // Same-origin + loopback guard over every API request (see origin-guard.mjs).
  // The frontend proxies the browser's `/api/*` calls here and forwards its
  // Fetch Metadata headers, so a cross-site page is refused exactly as before.
  const allowedHosts = parseAllowedHosts(process.env.CAREER_OPS_WEB_ALLOWED_HOSTS);
  const allowedOrigins = parseAllowedOrigins(process.env.CAREER_OPS_ALLOWED_ORIGINS);
  app.use("/api/*", async (c, next) => {
    const decision = checkRequest({
      secFetchSite: c.req.header("sec-fetch-site") ?? null,
      origin: c.req.header("origin") ?? null,
      host: c.req.header("host") ?? null,
      allowedHosts,
      allowedOrigins,
    });
    if (!decision.ok) return c.json({ error: decision.reason }, decision.status as 403);
    await next();
  });

  for (const { path, mod } of routes) {
    for (const method of METHODS) {
      const handler = mod[method] as RouteHandler | undefined;
      if (!handler) continue;
      app.on(method, path, (c) => handler(c.req.raw, { params: Promise.resolve(c.req.param() as Record<string, string>) }));
    }
  }

  app.notFound((c) => c.json({ error: "Not found" }, 404));
  app.onError((err, c) => {
    console.error(`[api] ${c.req.method} ${c.req.path}:`, err);
    return c.json({ error: "Internal error" }, 500);
  });
  return app;
}
