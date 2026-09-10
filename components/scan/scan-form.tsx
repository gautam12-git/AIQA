"use client";

import { useState } from "react";
import type { Project, TestMode, Environment } from "@/lib/types";
import { modeMeta } from "@/lib/format";
import { startScan } from "@/lib/data";
import { Button } from "@/components/ui/primitives";

// Inlined at build time. When the real backend is on, actually POST /api/scans.
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== "false";

const modes: TestMode[] = ["quick", "standard", "deep", "security", "business-logic", "full-autonomous"];
const environments: Environment[] = ["staging", "qa", "local", "production"];

// Which action-risk tiers each mode may exercise (drives the safety preview).
const modeRisk: Record<TestMode, { caution: boolean; highRisk: boolean }> = {
  quick: { caution: false, highRisk: false },
  standard: { caution: true, highRisk: false },
  deep: { caution: true, highRisk: false },
  security: { caution: true, highRisk: true },
  "business-logic": { caution: true, highRisk: false },
  "full-autonomous": { caution: true, highRisk: true },
};

export function ScanForm({ projects, initialProject }: { projects: Project[]; initialProject?: string }) {
  const [url, setUrl] = useState(projects.find((p) => p.id === initialProject)?.url ?? "");
  const [environment, setEnvironment] = useState<Environment>("staging");
  const [mode, setMode] = useState<TestMode>("standard");
  const [instruction, setInstruction] = useState("");
  const [authed, setAuthed] = useState(false);
  const [credUser, setCredUser] = useState("");
  const [credPass, setCredPass] = useState("");
  const [credRole, setCredRole] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [queued, setQueued] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const risk = modeRisk[mode];
  const isProd = environment === "production";
  const canStart = url.trim().length > 0 && authorized && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canStart) return;
    setSubmitting(true);
    setError(null);
    try {
      if (USE_MOCK) {
        // No backend in mock mode — simulate queueing.
        await new Promise((r) => setTimeout(r, 700));
      } else {
        // Real path: POST /api/scans (CONTRACT.md).
        const credentials =
          authed && credUser.trim() && credPass
            ? [{ label: credRole.trim() || "User", username: credUser.trim(), password: credPass }]
            : undefined;
        await startScan({
          url: url.trim(),
          environment,
          mode,
          instruction: instruction.trim() || undefined,
          authorized,
          credentials,
        });
      }
      setQueued(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start scan.");
    } finally {
      setSubmitting(false);
    }
  }

  if (queued) {
    return (
      <div className="aiqa-fade-up rounded-[var(--radius-card)] border border-success/40 bg-success/5 p-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-2xl text-success">
          ✓
        </div>
        <h2 className="text-lg font-semibold text-content">Scan queued</h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-secondary">
          AIQA will discover the application, generate risk-ranked test hypotheses, then execute and
          verify each finding by replay before it surfaces.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Button href="/runs">View runs</Button>
          <Button variant="outline" onClick={() => setQueued(false)}>
            Start another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Target */}
      <Section title="Target" desc="The application AIQA will explore and test.">
        <label className="block text-xs font-medium text-secondary">Application URL</label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://staging.yourapp.com"
          aria-label="Application URL"
          className="mt-1.5 w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-content placeholder:text-muted focus:border-accent-line focus:outline-none"
        />
        <div className="mt-3 flex flex-wrap gap-1.5">
          {environments.map((env) => (
            <button
              key={env}
              type="button"
              onClick={() => setEnvironment(env)}
              className="rounded-md border px-3 py-1.5 text-xs font-medium capitalize transition-colors"
              style={
                environment === env
                  ? { borderColor: env === "production" ? "var(--p0)" : "var(--accent-line)", background: "var(--surface-2)", color: "var(--text)" }
                  : { borderColor: "var(--line)", color: "var(--text-muted)" }
              }
            >
              {env}
            </button>
          ))}
        </div>
        {isProd && (
          <p className="mt-2.5 flex items-start gap-2 rounded-lg border border-p0/30 bg-danger/5 px-3 py-2 text-xs text-p0">
            <span>⚠</span>
            <span>
              Production is read-limited. AIQA restricts itself to safe, non-destructive actions and will
              refuse writes, payments, and account changes. Point at staging for full testing.
            </span>
          </p>
        )}
      </Section>

      {/* Test mode */}
      <Section title="Test mode" desc="How aggressively AIQA explores.">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {modes.map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className="rounded-lg border p-3.5 text-left transition-colors"
                style={
                  active
                    ? { borderColor: "var(--accent-line)", background: "var(--accent-soft)" }
                    : { borderColor: "var(--line)", background: "transparent" }
                }
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-content">{modeMeta[m].label}</span>
                  <span
                    className="flex h-4 w-4 items-center justify-center rounded-full border"
                    style={{ borderColor: active ? "var(--accent)" : "var(--line-strong)" }}
                  >
                    {active && <span className="h-2 w-2 rounded-full bg-accent" />}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">{modeMeta[m].desc}</p>
              </button>
            );
          })}
        </div>
      </Section>

      {/* Instructions */}
      <Section title="Instructions" desc="Optional. Plain English — AIQA turns it into a test plan.">
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          rows={3}
          placeholder="e.g. Test whether users can access other users' projects. Focus on checkout and coupons."
          aria-label="Test instructions"
          className="w-full resize-none rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-content placeholder:text-muted focus:border-accent-line focus:outline-none"
        />
      </Section>

      {/* Authenticated testing */}
      <Section title="Authenticated testing" desc="Optional. Let AIQA test as one or more signed-in roles.">
        <label className="flex items-center gap-2.5 text-sm text-secondary">
          <input
            type="checkbox"
            checked={authed}
            onChange={(e) => setAuthed(e.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          Provide test credentials
        </label>
        {authed && (
          <div className="mt-3 rounded-lg border border-line bg-surface-2 p-3.5">
            <p className="text-xs text-muted">
              AIQA logs in with these and tests behind the login. Credentials are used only against the
              authorized target and are never stored. Use dedicated <strong>test</strong> accounts.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <input
                value={credUser}
                onChange={(e) => setCredUser(e.target.value)}
                placeholder="username / email"
                autoComplete="off"
                aria-label="Test account username or email"
                className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-content placeholder:text-muted focus:border-accent-line focus:outline-none"
              />
              <input
                value={credPass}
                onChange={(e) => setCredPass(e.target.value)}
                type="password"
                placeholder="password"
                autoComplete="off"
                aria-label="Test account password"
                className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-content placeholder:text-muted focus:border-accent-line focus:outline-none"
              />
              <input
                value={credRole}
                onChange={(e) => setCredRole(e.target.value)}
                placeholder="role (e.g. Customer)"
                aria-label="Test account role"
                className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-content placeholder:text-muted focus:border-accent-line focus:outline-none"
              />
            </div>
          </div>
        )}
      </Section>

      {/* Safety preview + authorization */}
      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Action policy for this run</div>
        <div className="flex flex-wrap gap-2">
          <RiskTag label="Safe" desc="navigate · read · screenshot · GET" tone="var(--success)" on />
          <RiskTag label="Caution" desc="POST · PUT · DELETE · uploads" tone="var(--p2)" on={risk.caution} />
          <RiskTag label="High risk" desc="payments · deletion · real emails" tone="var(--p0)" on={risk.highRisk} />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          AIQA proposes actions; a policy layer gates every write. High-risk actions run only in a safe
          test environment with explicit authorization, and never in production.
        </p>

        <label className="mt-4 flex items-start gap-2.5 text-sm text-secondary">
          <input
            type="checkbox"
            checked={authorized}
            onChange={(e) => setAuthorized(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
          />
          I confirm I am authorized to test this target and its data.
        </label>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!canStart} className="min-w-40">
          {submitting ? "Queuing…" : "Start AIQA scan"}
        </Button>
        {!authorized && <span className="text-xs text-muted">Confirm authorization to continue.</span>}
        {error && <span className="text-xs text-p0">{error}</span>}
      </div>
    </form>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
      <h3 className="text-sm font-semibold text-content">{title}</h3>
      {desc && <p className="mb-3 mt-0.5 text-xs text-muted">{desc}</p>}
      {!desc && <div className="mb-3" />}
      {children}
    </div>
  );
}

function RiskTag({ label, desc, tone, on }: { label: string; desc: string; tone: string; on: boolean }) {
  return (
    <div
      className="rounded-lg border px-3 py-2"
      style={{
        borderColor: on ? `color-mix(in srgb, ${tone} 40%, transparent)` : "var(--line)",
        background: on ? `color-mix(in srgb, ${tone} 8%, transparent)` : "transparent",
        opacity: on ? 1 : 0.5,
      }}
    >
      <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: on ? tone : "var(--text-muted)" }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: on ? tone : "var(--text-muted)" }} />
        {label}
      </div>
      <div className="mt-0.5 text-[11px] text-muted">{desc}</div>
    </div>
  );
}
