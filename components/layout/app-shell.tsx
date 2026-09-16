"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

// Full-bleed routes that render without the app chrome: the public landing
// page ("/") and the auth pages (which have their own layouts).
const NO_CHROME_ROUTES = ["/login", "/signup", "/forgot-password"];

/** Renders the app chrome (sidebar + topbar) everywhere except landing/auth. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const noChrome =
    pathname === "/" || NO_CHROME_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"));

  if (noChrome) return <>{children}</>;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="mx-auto w-full max-w-[1200px] flex-1 px-5 py-6 sm:px-7">
          {children}
        </main>
      </div>
    </div>
  );
}
