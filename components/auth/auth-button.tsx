"use client";

import Link from "next/link";
import { openAuth } from "@/components/auth/auth-drawer";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== "false";

/** A CTA that opens the sliding auth drawer — or, in demo/mock mode (no
 *  backend), links straight into the app. */
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
  if (USE_MOCK) {
    return (
      <Link href="/dashboard" className={className} style={style}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={() => openAuth(mode)} className={className} style={style}>
      {children}
    </button>
  );
}
