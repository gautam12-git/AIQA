import Link from "next/link";

// Shown for unknown routes and notFound() calls.
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-[var(--radius-card)] border border-line bg-surface p-8 text-center shadow-[var(--shadow-card)]">
        <div className="gradient-text text-5xl font-bold">404</div>
        <h1 className="mt-3 text-lg font-semibold text-content">Page not found</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-secondary">
          The page you're looking for doesn't exist or may have moved.
        </p>
        <div className="mt-6 flex justify-center gap-2.5">
          <Link
            href="/dashboard"
            className="grad-brand rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all hover:brightness-110"
          >
            Go to dashboard
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-line-strong px-4 py-2 text-sm font-semibold text-content transition-colors hover:bg-surface-2"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
