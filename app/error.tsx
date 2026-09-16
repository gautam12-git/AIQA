"use client";

import Link from "next/link";

// Catches errors thrown while rendering a route (e.g. a failed data fetch).
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const message =
    error?.message && error.message.length < 200
      ? error.message
      : "Something went wrong while loading this page.";

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-[var(--radius-card)] border border-line bg-surface p-8 text-center shadow-[var(--shadow-card)]">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft text-2xl">
          ⚠️
        </div>
        <h1 className="text-lg font-semibold text-content">Something went wrong</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-secondary">{message}</p>
        <div className="mt-6 flex justify-center gap-2.5">
          <button
            onClick={reset}
            className="grad-brand rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all hover:brightness-110"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="rounded-lg border border-line-strong px-4 py-2 text-sm font-semibold text-content transition-colors hover:bg-surface-2"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
