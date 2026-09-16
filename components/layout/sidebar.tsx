"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconDashboard,
  IconProjects,
  IconRuns,
  IconBug,
  IconCode,
  IconShield,
  IconA11y,
  IconPerf,
  IconPlus,
} from "@/components/layout/icons";
import { LogoMark } from "@/components/layout/logo";

const mainNav = [
  { href: "/dashboard", label: "Dashboard", icon: IconDashboard, exact: true },
  { href: "/projects", label: "Projects", icon: IconProjects },
  { href: "/runs", label: "Test Runs", icon: IconRuns },
  { href: "/bugs", label: "Bugs", icon: IconBug },
  { href: "/code-review", label: "Code Review", icon: IconCode },
];

const insightsNav = [
  { href: "/security", label: "Security", icon: IconShield },
  { href: "/accessibility", label: "Accessibility", icon: IconA11y },
  { href: "/performance", label: "Performance", icon: IconPerf },
];

export function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string, exact?: boolean) {
    const base = href.split("?")[0];
    if (exact) return pathname === base;
    return pathname === base || pathname.startsWith(base + "/");
  }

  return (
    <aside className="glass sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r px-3 py-4 md:flex">
      <Link href="/dashboard" className="mb-6 flex items-center gap-2.5 px-2">
        <LogoMark className="h-9 w-9 rounded-xl" style={{ boxShadow: "0 6px 22px -6px rgba(236,72,153,0.45)" }} />
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-tight text-content">AIQA</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted">QA Engineer</div>
        </div>
      </Link>

      <Link
        href="/scan"
        className="mb-5 flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110"
        style={{ background: "linear-gradient(120deg, var(--grad-start), var(--grad-mid) 55%, var(--grad-end))", boxShadow: "0 8px 26px -10px rgba(236,72,153,0.45)" }}
      >
        <IconPlus className="h-4 w-4" />
        New Scan
      </Link>

      <nav className="flex flex-col gap-0.5">
        {mainNav.map((item) => (
          <NavItem key={item.href} {...item} active={isActive(item.href, item.exact)} />
        ))}
      </nav>

      <div className="mt-6 mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted">
        Insights
      </div>
      <nav className="flex flex-col gap-0.5">
        {insightsNav.map((item) => (
          <NavItem key={item.href} {...item} active={isActive(item.href)} />
        ))}
      </nav>

      <div className="mt-auto rounded-lg border border-line bg-surface-2 p-3">
        <div className="flex items-center gap-2 text-xs font-medium text-content">
          <span className="h-2 w-2 rounded-full bg-success aiqa-pulse" />
          1 run active
        </div>
        <p className="mt-1 text-[11px] leading-snug text-muted">
          Evidence-first testing. Findings are verified by replay before they surface.
        </p>
      </div>
    </aside>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all ${
        active
          ? "font-medium text-content"
          : "text-secondary hover:bg-surface-2 hover:text-content"
      }`}
      style={
        active
          ? { background: "var(--accent-soft)", boxShadow: "inset 0 0 0 1px var(--accent-line)" }
          : undefined
      }
    >
      <span
        className={`relative ${active ? "text-accent" : "text-muted group-hover:text-secondary"}`}
      >
        {active && (
          <span className="absolute -left-3 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent" />
        )}
        <Icon />
      </span>
      {label}
    </Link>
  );
}
