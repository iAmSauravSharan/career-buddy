import path from "node:path";

// Where the backend API listens. Server components call it directly (see
// src/lib/backend.ts); the browser's relative `/api/*` calls are proxied to it
// by the rewrite below, so the browser only ever talks to this origin.
const backendUrl = (process.env.BACKEND_URL || "http://127.0.0.1:3001").replace(/\/+$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pinned explicitly: two lockfiles exist on purpose, and on Windows a
  // misinferred root can send Turbopack's postcss workers into an unbounded
  // respawn loop (vercel/next.js#92978). The repo root, not this app, because
  // `@shared/*` resolves to ../shared, which must sit inside the root.
  turbopack: { root: path.join(import.meta.dirname, "..") },
  outputFileTracingRoot: path.join(import.meta.dirname, ".."),
  // Allow a throwaway build dir (e.g. BUILD_DIST=.next-prod) so a production
  // `next build` can run without clobbering a live `next dev` .next.
  ...(process.env.BUILD_DIST ? { distDir: process.env.BUILD_DIST } : {}),
  experimental: {
    // Evaluations, scans and apply runs stream for many minutes through the
    // `/api/*` rewrite; the default proxy timeout (30s) would cut them off.
    proxyTimeout: 15 * 60 * 1000,
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backendUrl}/api/:path*` }];
  },
};

export default nextConfig;
