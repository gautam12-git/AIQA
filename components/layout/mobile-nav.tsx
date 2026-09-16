"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconDashboard, IconProjects, IconRuns, IconBug, IconCode,
  IconShield, IconA11y, IconPerf,
} from "@/components/layout/icons";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: IconDashboard, exact: true },
  { href: "/projects", label: "Projects", icon: IconProjects },
  { href: "/runs", label: "Test Runs", icon: IconRuns },
  { href: "/bugs", label: "Bugs", icon: IconBug },
  { href: "/code-review", label: "Code Review", icon: IconCode },
  { href: "/security", label: "Security", icon: IconShield },
  { href: "/accessibility", label: "Accessibility", icon: IconA11y },
  { href: "/performance", label: "Performance", icon: IconPerf },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer whenever navigation lands on a new route.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  function isActive(href: string, exact?: boolean) {
    return exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-secondary hover:bg-surface-2"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="flex-1 bg-black/50" onClick={() => setOpen(false)} />
          <nav className="glass flex w-64 flex-col gap-1 border-l px-3 py-4">
            <div className="mb-3 flex items-center justify-between px-2">
              <span className="text-sm font-semibold text-content">AIQA</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation menu"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            {nav.map(({ href, label, icon: Icon, exact }) => {
              const active = isActive(href, exact);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    active ? "bg-surface-2 font-medium text-content" : "text-secondary hover:bg-surface-2 hover:text-content"
                  }`}
                >
                  <span className={active ? "text-accent" : "text-muted"}>
                    <Icon />
                  </span>
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </div>
  );
}
