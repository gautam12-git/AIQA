import Link from "next/link";

export function PageHeader({
  title,
  description,
  breadcrumb,
  actions,
}: {
  title: string;
  description?: string;
  breadcrumb?: { label: string; href?: string }[];
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      {breadcrumb && (
        <nav className="mb-2 flex items-center gap-1.5 text-xs text-muted">
          {breadcrumb.map((c, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {c.href ? (
                <Link href={c.href} className="hover:text-secondary">
                  {c.label}
                </Link>
              ) : (
                <span className="text-secondary">{c.label}</span>
              )}
              {i < breadcrumb.length - 1 && <span className="text-line-strong">/</span>}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-content">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-sm text-secondary">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
