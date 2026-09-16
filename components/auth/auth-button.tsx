"use client";

import { openAuth } from "@/components/auth/auth-drawer";

/** A CTA that opens the sliding auth drawer instead of navigating to a page. */
export function AuthButton({
  mode = "login",
  className,
  style,
  children,
}: {
  mode?: "login" | "signup";
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={() => openAuth(mode)} className={className} style={style}>
      {children}
    </button>
  );
}
