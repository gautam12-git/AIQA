import type {
  Severity,
  Confidence,
  BugCategory,
  TestMode,
  RunStatus,
  Coverage,
} from "@/lib/types";

export const severityMeta: Record<
  Severity,
  { label: string; color: string; desc: string }
> = {
  P0: { label: "P0 · Critical", color: "var(--p0)", desc: "Data loss, account takeover, financial corruption" },
  P1: { label: "P1 · High", color: "var(--p1)", desc: "Major workflow, payment, or permission failure" },
  P2: { label: "P2 · Medium", color: "var(--p2)", desc: "Feature malfunction or significant UX failure" },
  P3: { label: "P3 · Low", color: "var(--p3)", desc: "Minor UI, a11y, or non-critical inconsistency" },
};

export const confidenceMeta: Record<Confidence, { label: string; pct: number }> = {
  confirmed: { label: "Confirmed", pct: 100 },
  high: { label: "High confidence", pct: 80 },
  medium: { label: "Medium confidence", pct: 55 },
  low: { label: "Low confidence", pct: 30 },
  suspected: { label: "Suspected", pct: 15 },
};

export const categoryMeta: Record<BugCategory, { label: string; icon: string }> = {
  functional: { label: "Functional", icon: "⚙" },
  ui: { label: "UI", icon: "▦" },
  api: { label: "API", icon: "⇄" },
  security: { label: "Security", icon: "🛡" },
  "business-logic": { label: "Business Logic", icon: "∑" },
  workflow: { label: "Workflow", icon: "⟶" },
  "data-consistency": { label: "Data Consistency", icon: "≠" },
  performance: { label: "Performance", icon: "⏱" },
  accessibility: { label: "Accessibility", icon: "♿" },
  regression: { label: "Regression", icon: "↩" },
};

export const modeMeta: Record<TestMode, { label: string; desc: string }> = {
  quick: { label: "Quick Scan", desc: "Basic bugs — links, errors, broken interactions" },
  standard: { label: "Standard QA", desc: "UI + forms + API + workflows" },
  deep: { label: "Deep QA", desc: "Extensive autonomous exploration" },
  security: { label: "Security Audit", desc: "Authorized OWASP-aligned testing" },
  "business-logic": { label: "Business Logic Audit", desc: "Deep functional & rule testing" },
  "full-autonomous": { label: "Full Autonomous Audit", desc: "Everything, prioritized by risk" },
};

export const statusMeta: Record<RunStatus, { label: string; color: string }> = {
  queued: { label: "Queued", color: "var(--text-muted)" },
  running: { label: "Running", color: "var(--info)" },
  completed: { label: "Completed", color: "var(--success)" },
  failed: { label: "Failed", color: "var(--danger)" },
  cancelled: { label: "Cancelled", color: "var(--text-muted)" },
};

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const s = Math.max(1, Math.round((now - then) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export function formatDuration(ms?: number): string {
  if (!ms) return "—";
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  return `${h}h ${min % 60}m`;
}

export function coveragePct(c: Coverage): number {
  const d =
    c.pages.discovered + c.buttons.discovered + c.forms.discovered + c.apis.discovered + c.workflows.discovered;
  const t = c.pages.tested + c.buttons.tested + c.forms.tested + c.apis.tested + c.workflows.tested;
  return d === 0 ? 0 : Math.round((t / d) * 100);
}
