import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

// Next 16 renamed `middleware.ts` → `proxy.ts`. Optimistic auth gate: it only
// checks for the presence of the session cookie (the backend verifies the JWT
// on every API call). No DB work here — it runs on every route.

// "/" is the public landing page; auth pages are public too. Everything else
// (the actual app) requires a session.
const PUBLIC_ROUTES = ["/", "/login", "/signup", "/forgot-password"];
const SESSION_COOKIE = "aiqa_session";
// Demo/mock builds have no backend to authenticate against — let everyone in.
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== "false";

export default async function proxy(req: NextRequest) {
  if (USE_MOCK) return NextResponse.next();
  const path = req.nextUrl.pathname;
  const isPublic = path === "/" || ["/login", "/signup", "/forgot-password"].some((r) => path === r || path.startsWith(r + "/"));
  const hasSession = Boolean((await cookies()).get(SESSION_COOKIE)?.value);

  // Not logged in and trying to reach a protected page → landing with the
  // auth drawer open.
  if (!hasSession && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    url.searchParams.set("auth", "login");
    return NextResponse.redirect(url);
  }

  // Already logged in but on the landing or an auth page → go to the app.
  if (hasSession && isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Skip static assets and API routes.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
