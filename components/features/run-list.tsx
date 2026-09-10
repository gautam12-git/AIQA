import Link from "next/link";
import type { TestRun } from "@/lib/types";
import { Pill } from "@/components/ui/badges";
import { ProgressBar } from "@/components/ui/primitives";
import { statusMeta, modeMeta, timeAgo, formatDuration, coveragePct } from "@/lib/format";

function totalBugs(r: TestRun) {
  return r.bugCounts.P0 + r.bugCounts.P1 + r.bugCounts.P2 + r.bugCounts.P3;
}

export function RunRow({ run, projectName }: { run: TestRun; projectName?: string }) {
  const sm = statusMeta[run.status];
  return (
    <Link
      href={`/runs/${run.id}`}
      className="group block border-b border-line px-4 py-3.5 transition-colors last:border-b-0 hover:bg-surface-2"
    >
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-medium text-content group-hover:text-white">
              {modeMeta[run.mode].label}
            </span>
            <Pill color={sm.color}>
              {run.status === "running" && <span className="sr-only">running</span>}
              {sm.label}
            </Pill>
            {projectName && <span className="text-xs text-muted">· {projectName}</span>}
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted">
            <span className="font-mono text-[11px]">{run.id}</span>
            <span className="text-line-strong">·</span>
            <span>{run.status === "running" ? "started " : ""}{timeAgo(run.startedAt)}</span>
            {run.status === "completed" && (
              <>
                <span className="text-line-strong">·</span>
                <span>{formatDuration(run.durationMs)}</span>
              </>
            )}
          </div>
        </div>

        <div className="hidden w-40 shrink-0 sm:block">
          {run.status === "running" ? (
            <div>
              <div className="mb-1 flex justify-between text-[11px] text-muted">
                <span>Progress</span>
                <span className="font-mono text-info">{run.progress}%</span>
              </div>
              <ProgressBar value={run.progress} color="var(--info)" />
            </div>
          ) : run.status === "queued" ? (
            <span className="text-xs text-muted">Waiting to start</span>
          ) : (
            <div>
              <div className="mb-1 flex justify-between text-[11px] text-muted">
                <span>Coverage</span>
                <span className="font-mono">{coveragePct(run.coverage)}%</span>
              </div>
              <ProgressBar value={coveragePct(run.coverage)} />
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {(["P0", "P1", "P2", "P3"] as const).map((s) =>
            run.bugCounts[s] > 0 ? (
              <span
                key={s}
                className="inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 text-xs font-semibold"
                style={{ color: `var(--${s.toLowerCase()})`, background: `color-mix(in srgb, var(--${s.toLowerCase()}) 13%, transparent)` }}
                title={`${run.bugCounts[s]} ${s}`}
              >
                {run.bugCounts[s]}
              </span>
            ) : null,
          )}
          {totalBugs(run) === 0 && run.status === "completed" && (
            <span className="text-xs text-success">No bugs</span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function RunList({ runs, projectNameOf }: { runs: TestRun[]; projectNameOf?: (id: string) => string | undefined }) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
      {runs.map((r) => (
        <RunRow key={r.id} run={r} projectName={projectNameOf?.(r.projectId)} />
      ))}
    </div>
  );
}
