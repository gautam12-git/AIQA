"use client";

import { useEffect, useState } from "react";
import { getMe, logout, type AuthUser } from "@/lib/data-api";

export function UserMenu() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    getMe().then(setUser);
  }, []);

  async function onLogout() {
    await logout();
    // Hard nav so the cleared session cookie is reflected on the next request.
    window.location.href = "/login";
  }

  const initials = user?.name
    ? user.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "··";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface-2 text-xs font-semibold text-secondary hover:border-accent-line"
      >
        {initials}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-lg border border-line bg-surface p-1 shadow-[var(--shadow-card)]">
            <div className="px-3 py-2">
              <div className="truncate text-sm font-medium text-content">{user?.name ?? "Not signed in"}</div>
              {user?.email && <div className="truncate text-xs text-muted">{user.email}</div>}
            </div>
            <div className="my-1 border-t border-line" />
            <button
              onClick={onLogout}
              className="w-full rounded-md px-3 py-2 text-left text-sm text-secondary transition-colors hover:bg-surface-2 hover:text-content"
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
