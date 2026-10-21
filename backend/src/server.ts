import { serve } from "@hono/node-server";
import { createApp } from "./app";

// Loopback unless told otherwise: the API reads and writes the user's data and
// spawns AI CLIs, so exposing it is an explicit deployment decision.
const hostname = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 3001);

const server = serve({ fetch: createApp().fetch, hostname, port }, (info) => {
  console.error(`career-buddy api: listening on http://${info.address}:${info.port}`);
});

// Evaluations, scans and apply runs stream for many minutes (the routes
// declared up to 800s as Next.js maxDuration). Node's default 300s request
// timeout would cut them off mid-stream.
const http = server as unknown as { requestTimeout: number; headersTimeout: number };
http.requestTimeout = 0;
http.headersTimeout = 60_000;

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5_000).unref();
  });
}
