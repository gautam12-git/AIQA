"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { TestRun } from "@/lib/types";
import { Card, SectionHeader, ProgressBar, Donut } from "@/components/ui/primitives";
import { CoveragePanel } from "@/components/features/coverage-panel";
import { coveragePct } from "@/lib/format";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== "false";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8010";
const TERMINAL = new Set(["completed", "failed", "cancelled"]);

export function RunLive({ initialRun }: { initialRun: TestRun }) {
  const [run, setRun] = useState<TestRun>(initialRun);
  const [conn, setConn] = useState<"live" | "reconnecting" | "offline">("live");
  const router = useRouter();
  const refreshed = useRef(false);

  useEffect(() => {
    // Only stream against the real backend for a non-terminal run.
    if (USE_MOCK || TERMINAL.has(initialRun.status)) return;

    let es: EventSource | null = null;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let closed = false;
    let finished = false;

    function connect() {
      es = new EventSource(`${API_URL}/api/runs/${initialRun.id}/events`);
      es.onopen = () => { attempts = 0; setConn("live"); };
      es.addEventListener("snapshot", (e) => {
        try { setRun(JSON.parse((e as MessageEvent).data)); setConn("live"); attempts = 0; } catch {}
      });
      es.addEventListener("done", () => {
        finished = true;
        es?.close();
        if (!refreshed.current) { refreshed.current = true; router.refresh(); }
      });
      es.onerror = () => {
        es?.close();
        if (closed || finished) return;
        attempts += 1;
        if (attempts <= 4) {
          setConn("reconnecting");
          timer = setTimeout(connect, Math.min(1000 * attempts, 5000)); // backoff, cap 5s
        } else {
          // Give up streaming; fall back to a one-off refresh for latest state.
          setConn("offline");
          router.refresh();
        }
      };
    }

    connect();
    return () => { closed = true; clearTimeout(timer); es?.close(); };
  }, [initialRun.id, initialRun.status, router]);

  const isLive = run.status === "running" || run.status === "queued";

  return (
    <>
      <Card className="p-5 lg:col-span-2">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <Donut
              value={isLive ? run.progress : 100}
              size={84}
              stroke={8}
              color={isLive ? "var(--info)" : run.status === "failed" ? "var(--p0)" : "var(--success)"}
              label={isLive ? `${run.progress}%` : run.status === "failed" ? "!" : "✓"}
            />
            <div>
              <div className="flex items-center gap-2 text-sm text-muted">
                {isLive && conn === "live" && <span className="h-2 w-2 rounded-full bg-info aiqa-pulse" />}
                {isLive && conn === "reconnecting" && <span className="h-2 w-2 rounded-full bg-warning aiqa-pulse" />}
                {isLive
                  ? conn === "reconnecting"
                    ? "Reconnecting to live updates…"
                    : conn === "offline"
                      ? "Live updates paused — refresh for the latest."
                      : "Exploring & verifying"
                  : run.status === "failed"
                    ? "Run failed"
                    : run.status === "cancelled"
                      ? "Run cancelled"
                      : "Run complete"}
              </div>
              <div className="mt-0.5 text-lg font-semibold text-content">
                {run.actionsExecuted.toLocaleString()} actions
              </div>
              <div className="text-xs text-muted">{coveragePct(run.coverage)}% meaningful coverage</div>
            </div>
          </div>
          <div className="flex-1 space-y-2.5 sm:border-l sm:border-line sm:pl-6">
            {run.phases.map((p) => (
              <div key={p.name} className="flex items-center gap-2.5 text-sm">
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${p.status === "active" ? "aiqa-pulse" : ""}`}
                  style={{
                    background:
                      p.status === "done" ? "var(--success)" : p.status === "active" ? "var(--info)" : "var(--surface-3)",
                  }}
                />
                <span className={p.status === "pending" ? "text-muted" : "text-content"}>{p.name}</span>
                {p.detail && <span className="truncate text-xs text-muted">· {p.detail}</span>}
              </div>
            ))}
          </div>
        </div>

        {isLive && (
          <div className="mt-5 border-t border-line pt-4">
            <div className="mb-1.5 flex justify-between text-xs">
              <span className="text-secondary">Overall progress</span>
              <span className="font-mono text-info">{run.progress}%</span>
            </div>
            <ProgressBar value={run.progress} color="var(--info)" height={8} />
          </div>
        )}
      </Card>

      <div className="space-y-4">
        <Card className="p-5">
          <SectionHeader title="Findings" />
          <div className="grid grid-cols-4 gap-2">
            {(["P0", "P1", "P2", "P3"] as const).map((s) => (
              <div key={s} className="rounded-lg bg-surface-2 py-2.5 text-center">
                <div className="text-lg font-semibold" style={{ color: `var(--${s.toLowerCase()})` }}>
                  {run.bugCounts[s]}
                </div>
                <div className="text-[10px] text-muted">{s}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <SectionHeader title="Coverage" />
          <CoveragePanel coverage={run.coverage} />
        </Card>
      </div>
    </>
  );
}
