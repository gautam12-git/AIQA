"use client";

import { useState } from "react";
import type { Evidence } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8010";

type Tab = "screenshot" | "network" | "console" | "state";

export function EvidenceTabs({ evidence }: { evidence: Evidence }) {
  const tabs: { key: Tab; label: string; count?: number; available: boolean }[] = [
    { key: "screenshot", label: "Screenshot", available: !!(evidence.screenshotUrl || evidence.screenshotLabel) },
    { key: "network", label: "Network", count: evidence.network?.length, available: !!evidence.network?.length },
    { key: "console", label: "Console", count: evidence.console?.length, available: !!evidence.console?.length },
    { key: "state", label: "State", available: !!evidence.relevantState },
  ];
  const firstAvailable = tabs.find((t) => t.available)?.key ?? "screenshot";
  const [tab, setTab] = useState<Tab>(firstAvailable);

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
      <div className="flex border-b border-line bg-surface-2/50">
        {tabs.map((t) => (
          <button
            key={t.key}
            disabled={!t.available}
            onClick={() => setTab(t.key)}
            className={`relative px-4 py-2.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              tab === t.key ? "text-content" : "text-muted hover:text-secondary"
            }`}
          >
            {t.label}
            {t.count != null && t.count > 0 && (
              <span className="ml-1.5 rounded bg-surface-3 px-1.5 py-0.5 text-[10px] text-secondary">{t.count}</span>
            )}
            {tab === t.key && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-accent" />}
          </button>
        ))}
      </div>

      <div className="p-4">
        {tab === "screenshot" && <ScreenshotView label={evidence.screenshotLabel} url={evidence.screenshotUrl} />}
        {tab === "network" && <NetworkView evidence={evidence} />}
        {tab === "console" && <ConsoleView evidence={evidence} />}
        {tab === "state" && <StateView evidence={evidence} />}
      </div>
    </div>
  );
}

function ScreenshotView({ label, url }: { label?: string; url?: string }) {
  if (url) {
    const src = url.startsWith("http") ? url : `${API_URL}${url}`;
    return (
      <div className="overflow-hidden rounded-lg border border-line">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={label ?? "Captured screenshot"} className="w-full" />
        {label && <div className="border-t border-line bg-surface-2 px-3 py-1.5 font-mono text-[11px] text-muted">{label}</div>}
      </div>
    );
  }
  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center rounded-lg border border-dashed border-line bg-[repeating-linear-gradient(45deg,var(--surface-2),var(--surface-2)_10px,var(--surface)_10px,var(--surface)_20px)]">
      <div className="rounded-md bg-surface px-3 py-2 text-center">
        <div className="text-xs text-secondary">Captured screenshot</div>
        <div className="mt-0.5 font-mono text-[11px] text-muted">{label ?? "—"}</div>
      </div>
    </div>
  );
}

function statusColor(status: number) {
  if (status >= 500) return "var(--p0)";
  if (status >= 400) return "var(--p1)";
  if (status >= 300) return "var(--p2)";
  return "var(--success)";
}

function NetworkView({ evidence }: { evidence: Evidence }) {
  if (!evidence.network?.length) return <Empty>No network activity captured.</Empty>;
  return (
    <div className="space-y-3">
      {evidence.network.map((n, i) => (
        <div key={i} className="rounded-lg border border-line bg-surface-2">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2 text-xs">
            <span className="rounded bg-surface-3 px-1.5 py-0.5 font-mono font-semibold text-secondary">{n.method}</span>
            <span className="font-mono text-content">{n.url}</span>
            <span className="ml-auto font-mono font-semibold" style={{ color: statusColor(n.status) }}>
              {n.status}
            </span>
            <span className="font-mono text-muted">{n.durationMs}ms</span>
          </div>
          {(n.requestBody || n.responseBody) && (
            <div className="grid grid-cols-1 divide-y divide-line md:grid-cols-2 md:divide-x md:divide-y-0">
              {n.requestBody && (
                <div className="p-3">
                  <div className="mb-1.5 text-[10px] uppercase tracking-wider text-muted">Request</div>
                  <pre className="overflow-x-auto font-mono text-[11px] leading-relaxed text-secondary">{n.requestBody}</pre>
                </div>
              )}
              {n.responseBody && (
                <div className="p-3">
                  <div className="mb-1.5 text-[10px] uppercase tracking-wider text-muted">Response</div>
                  <pre className="overflow-x-auto font-mono text-[11px] leading-relaxed text-secondary">{n.responseBody}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ConsoleView({ evidence }: { evidence: Evidence }) {
  if (!evidence.console?.length) return <Empty>No console output captured.</Empty>;
  const color = { log: "var(--text-secondary)", info: "var(--info)", warn: "var(--p2)", error: "var(--p0)" };
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-[#0b0c10] font-mono text-[11px]">
      {evidence.console.map((c, i) => (
        <div key={i} className="flex gap-2 border-b border-line/60 px-3 py-1.5 last:border-b-0">
          <span className="shrink-0 uppercase" style={{ color: color[c.level] }}>
            {c.level}
          </span>
          <span className="text-secondary">{c.message}</span>
          <span className="ml-auto shrink-0 text-muted">{c.at}</span>
        </div>
      ))}
    </div>
  );
}

function StateView({ evidence }: { evidence: Evidence }) {
  const s = evidence.relevantState;
  if (!s) return <Empty>No state captured.</Empty>;
  return (
    <div className="overflow-hidden rounded-lg border border-line">
      {Object.entries(s).map(([k, v], i) => (
        <div key={k} className={`flex justify-between px-3 py-2 text-xs ${i % 2 ? "bg-surface-2/40" : ""}`}>
          <span className="font-mono text-muted">{k}</span>
          <span className="font-mono text-content">{v}</span>
        </div>
      ))}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="py-8 text-center text-xs text-muted">{children}</div>;
}
