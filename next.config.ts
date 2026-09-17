import type { NextConfig } from "next";

// When BACKEND_ORIGIN is set (e.g. on Railway), proxy /api/* to the FastAPI
// backend so the browser only ever talks to this one origin — same-site
// cookies and no CORS. Locally (BACKEND_ORIGIN unset) this is a no-op and the
// client calls the backend directly (see lib/api-base.ts).
const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN;

const nextConfig: NextConfig = {
  async rewrites() {
    if (!BACKEND_ORIGIN) return [];
    return [
      { source: "/api/:path*", destination: `${BACKEND_ORIGIN}/api/:path*` },
      { source: "/evidence/:path*", destination: `${BACKEND_ORIGIN}/evidence/:path*` },
    ];
  },
};

export default nextConfig;
