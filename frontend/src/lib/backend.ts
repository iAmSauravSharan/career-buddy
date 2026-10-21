import { headers } from "next/headers";
import { notFound } from "next/navigation";

/**
 * Server-side client for the backend API. Pages are server components that
 * render from backend data; they never touch the filesystem themselves.
 *
 * Browser code keeps calling relative `/api/*` URLs, which next.config.mjs
 * rewrites to the same backend, so both paths reach one origin.
 */
export function backendUrl(): string {
  return (process.env.BACKEND_URL || "http://127.0.0.1:3001").replace(/\/+$/, "");
}

// The caller's identity travels with every server-side request, so the
// backend can authorize a page load exactly as it does a browser fetch.
const FORWARDED = ["cookie", "authorization"];

export class BackendError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    message: string,
  ) {
    super(message);
  }
}

export async function backendJson<T>(path: string, init?: RequestInit): Promise<T> {
  const incoming = await headers();
  const forwarded = new Headers(init?.headers);
  for (const name of FORWARDED) {
    const value = incoming.get(name);
    if (value && !forwarded.has(name)) forwarded.set(name, value);
  }
  const res = await fetch(`${backendUrl()}${path}`, { ...init, headers: forwarded, cache: "no-store" });
  if (res.status === 404) notFound();
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* non-JSON error body */
    }
    throw new BackendError(res.status, path, `Backend ${path} failed: ${message}`);
  }
  return (await res.json()) as T;
}

/** A query string from Next's searchParams, dropping undefined values. */
export function toQuery(params: Record<string, string | string[] | undefined>): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) q.append(key, v);
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}
