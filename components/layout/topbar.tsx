import Link from "next/link";
import { IconPlus } from "@/components/layout/icons";
import { MobileNav } from "@/components/layout/mobile-nav";

export function Topbar() {
  return (
    <header className="glass sticky top-0 z-20 flex h-14 items-center gap-4 border-b px-5">
      <MobileNav />

      <Link href="/" className="flex items-center gap-2 md:hidden">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">
          A
        </span>
        <span className="text-sm font-semibold">AIQA</span>
      </Link>

      <div className="ml-auto flex items-center gap-3">
        <span className="hidden items-center gap-1.5 rounded-md bg-surface-2 px-2.5 py-1 text-xs text-secondary sm:inline-flex">
          <span className="h-1.5 w-1.5 rounded-full bg-warning" />
          Staging · sandboxed
        </span>
        <Link
          href="/scan"
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          <IconPlus className="h-4 w-4" />
          <span className="hidden sm:inline">New Scan</span>
        </Link>
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface-2 text-xs font-semibold text-secondary"
          aria-label="Account"
          title="Account"
        >
          MM
        </div>
      </div>
    </header>
  );
}
