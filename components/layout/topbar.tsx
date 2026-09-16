import Link from "next/link";
import { IconPlus } from "@/components/layout/icons";
import { MobileNav } from "@/components/layout/mobile-nav";
import { UserMenu } from "@/components/auth/user-menu";
import { LogoMark } from "@/components/layout/logo";

export function Topbar() {
  return (
    <header className="glass sticky top-0 z-20 flex h-14 items-center gap-4 border-b px-5">
      <MobileNav />

      <Link href="/dashboard" className="flex items-center gap-2 md:hidden">
        <LogoMark className="h-7 w-7 rounded-lg" />
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
        <UserMenu />
      </div>
    </header>
  );
}
