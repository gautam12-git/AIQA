import Link from "next/link";

export function Card({
  children,
  className = "",
  as: As = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
}) {
  return (
    <As
      className={`rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)] ${className}`}
    >
      {children}
    </As>
  );
}

export function SectionHeader({
  title,
  action,
  sub,
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-sm font-semibold tracking-wide text-content">{title}</h2>
        {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function ProgressBar({
  value,
  color = "var(--accent)",
  className = "",
  height = 6,
}: {
  value: number;
  color?: string;
  className?: string;
  height?: number;
}) {
  return (
    <div
      className={`w-full overflow-hidden rounded-full bg-surface-3 ${className}`}
      style={{ height }}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }}
      />
    </div>
  );
}

export function Donut({
  value,
  size = 44,
  stroke = 5,
  color = "var(--accent)",
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (Math.min(100, Math.max(0, value)) / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={off}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <span className="absolute text-[11px] font-semibold text-content">{label ?? `${value}%`}</span>
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  href,
  onClick,
  type = "button",
  className = "",
  disabled,
}: {
  children: React.ReactNode;
  variant?: "primary" | "ghost" | "outline";
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  className?: string;
  disabled?: boolean;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";
  const styles = {
    primary:
      "text-white bg-[linear-gradient(120deg,var(--grad-start),var(--grad-mid)_55%,var(--grad-end))] shadow-[0_8px_24px_-10px_rgba(236,72,153,0.45)] hover:brightness-110",
    ghost: "text-secondary hover:text-content hover:bg-surface-2",
    outline: "border border-line-strong text-content hover:bg-surface-2 hover:border-accent-line",
  }[variant];
  const cls = `${base} ${styles} ${className}`;
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}

export function EmptyState({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-line bg-surface/50 px-6 py-12 text-center">
      <p className="text-sm font-medium text-secondary">{title}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}
