/* Resolve the backend base URL for a fetch.
 *
 * Three deployment shapes are supported via env:
 *
 * 1. Local dev (default): frontend :3000, backend :8010 on the same machine.
 *    - Client → same host as the page, port 8010 (works for localhost + LAN phone).
 *    - Server (SSR) → NEXT_PUBLIC_API_URL or 127.0.0.1:8010.
 *
 * 2. Single-origin prod (Railway, recommended): the Next app proxies /api/* to
 *    the backend (next.config rewrites). Set NEXT_PUBLIC_SAME_ORIGIN=true.
 *    - Client → "" (relative) so requests hit /api on the SAME origin → the
 *      session cookie is same-site and CORS is a non-issue.
 *    - Server (SSR) → BACKEND_ORIGIN (the rewrite target, reached directly).
 *
 * 3. Explicit remote API: set NEXT_PUBLIC_API_URL to a non-local URL and it's
 *    used verbatim on the client (cross-site; needs SameSite=None cookies).
 */

const ENV_API = process.env.NEXT_PUBLIC_API_URL;
const SAME_ORIGIN = process.env.NEXT_PUBLIC_SAME_ORIGIN === "true";
const BACKEND_PORT = "8010";

function isLocal(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(url);
}

export function apiBase(): string {
  // Server-side render always needs an absolute URL to reach the backend.
  if (typeof window === "undefined") {
    return process.env.BACKEND_ORIGIN ?? ENV_API ?? "http://127.0.0.1:8010";
  }
  // Single-origin: call /api on this same origin (Next rewrite proxies it).
  if (SAME_ORIGIN) return "";
  // An explicitly-configured remote API (cross-site deployment).
  if (ENV_API && !isLocal(ENV_API)) return ENV_API;
  // Local dev: same host as the page, backend port — works for localhost & LAN.
  return `${window.location.protocol}//${window.location.hostname}:${BACKEND_PORT}`;
}
