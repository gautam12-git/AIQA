import type { Severity, Confidence, BugCategory } from "@/lib/types";
import { severityMeta, confidenceMeta, categoryMeta } from "@/lib/format";

export function SeverityBadge({ severity, size = "md" }: { severity: Severity; size?: "sm" | "md" }) {
  const m = severityMeta[severity];
  const pad = size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-0.5 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md font-semibold ${pad}`}
      style={{ color: m.color, background: `color-mix(in srgb, ${m.color} 14%, transparent)` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />
      {severity}
    </span>
  );
}

export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const m = confidenceMeta[confidence];
  const strong = confidence === "confirmed" || confidence === "high";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium"
      style={{
        color: strong ? "var(--success)" : "var(--text-secondary)",
        background: strong ? "var(--success-soft)" : "var(--surface-3)",
      }}
    >
      {m.label}
    </span>
  );
}

export function CategoryBadge({ category }: { category: BugCategory }) {
  const m = categoryMeta[category];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-surface-3 px-2 py-0.5 text-xs text-secondary">
      <span aria-hidden className="text-[13px] leading-none">
        {m.icon}
      </span>
      {m.label}
    </span>
  );
}

export function Pill({
  children,
  color = "var(--text-muted)",
  dot = true,
}: {
  children: React.ReactNode;
  color?: string;
  dot?: boolean;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />}
      {children}
    </span>
  );
}
