import Link from "next/link";
import { getDashboardStats, getProjects, getRuns, getBugs } from "@/lib/data";
import { Card, SectionHeader, ProgressBar, Donut, Button } from "@/components/ui/primitives";
import { PageHeader } from "@/components/features/page-header";
import { BugList } from "@/components/features/bug-list";
import { RunRow } from "@/components/features/run-list";
import { severityMeta, coveragePct } from "@/lib/format";
import { IconChevron } from "@/components/layout/icons";

export default async function DashboardPage() {
  const [stats, projects, runs, bugs] = await Promise.all([
    getDashboardStats(),
    getProjects(),
    getRuns(),
    getBugs(),
  ]);

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name;
  const activeRun = runs.find((r) => r.status === "running");
  const recentBugs = bugs.slice(0, 5);

  const severityOrder = ["P0", "P1", "P2", "P3"] as const;
  const maxSev = Math.max(1, ...severityOrder.map((s) => stats.bugsBySeverity[s]));

  return (
    <div className="aiqa-fade-up">
      <PageHeader
        title="Dashboard"
        description="A live view of everything AIQA is testing — verified defects, coverage, and application health."
        actions={<Button href="/scan">Start a scan</Button>}
      />

      {/* Top metric row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Open bugs" value={stats.totalBugs} hint={`${stats.bugsBySeverity.P0} critical`} hintColor="var(--p0)" />
        <Metric label="Active runs" value={stats.activeRuns} hint="1 running now" hintColor="var(--info)" />
        <Metric label="Regressions" value={stats.regressions} hint="vs previous runs" />
        <Metric label="Avg. coverage" value={`${stats.avgCoverage}%`} hint="meaningful behavior" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Severity breakdown */}
        <Card className="p-5">
          <SectionHeader title="Bugs by severity" sub="Open findings, all projects" />
          <div className="flex flex-col gap-3">
            {severityOrder.map((s) => {
              const n = stats.bugsBySeverity[s];
              return (
                <Link key={s} href={`/bugs?severity=${s}`} className="group flex items-center gap-3">
                  <span className="w-6 text-xs font-semibold" style={{ color: severityMeta[s].color }}>
                    {s}
                  </span>
                  <div className="flex-1">
                    <ProgressBar value={(n / maxSev) * 100} color={severityMeta[s].color} height={8} />
                  </div>
                  <span className="w-6 text-right font-mono text-sm text-content">{n}</span>
                </Link>
              );
            })}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-4 text-center">
            <MiniStat label="Security" value={stats.securityFindings} color="var(--p0)" href="/bugs?category=security" />
            <MiniStat label="A11y" value={stats.a11yIssues} color="var(--p3)" href="/bugs?category=accessibility" />
            <MiniStat label="API health" value={`${stats.apiHealth}%`} color="var(--success)" />
          </div>
        </Card>

        {/* Active run spotlight */}
        <Card className="p-5 lg:col-span-2">
          <SectionHeader
            title="Active run"
            sub={activeRun ? projectName(activeRun.projectId) : undefined}
            action={
              activeRun && (
                <Button variant="ghost" href={`/runs/${activeRun.id}`} className="!px-2 !py-1 text-xs">
                  Open <IconChevron className="h-3.5 w-3.5" />
                </Button>
              )
            }
          />
          {activeRun ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-4">
                <Donut value={activeRun.progress} size={72} stroke={7} color="var(--info)" />
                <div>
                  <div className="text-sm font-medium text-content">Full Autonomous Audit</div>
                  <div className="mt-0.5 text-xs text-muted">
                    {activeRun.actionsExecuted.toLocaleString()} actions · {coveragePct(activeRun.coverage)}% covered
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    {(["P0", "P1", "P2", "P3"] as const).map((s) =>
                      activeRun.bugCounts[s] > 0 ? (
                        <span
                          key={s}
                          className="rounded px-1.5 py-0.5 text-[11px] font-semibold"
                          style={{ color: severityMeta[s].color, background: `color-mix(in srgb, ${severityMeta[s].color} 13%, transparent)` }}
                        >
                          {activeRun.bugCounts[s]} {s}
                        </span>
                      ) : null,
                    )}
                  </div>
                </div>
              </div>
              <div className="flex-1 space-y-2 sm:border-l sm:border-line sm:pl-5">
                {activeRun.phases.map((p) => (
                  <div key={p.name} className="flex items-center gap-2.5 text-xs">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${p.status === "active" ? "aiqa-pulse" : ""}`}
                      style={{
                        background:
                          p.status === "done" ? "var(--success)" : p.status === "active" ? "var(--info)" : "var(--surface-3)",
                      }}
                    />
                    <span className={p.status === "pending" ? "text-muted" : "text-secondary"}>{p.name}</span>
                    {p.detail && <span className="truncate text-muted">· {p.detail}</span>}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">No runs are active right now.</p>
          )}
        </Card>
      </div>

      {/* Recent bugs + projects */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionHeader
            title="Recent findings"
            action={<Button variant="ghost" href="/bugs" className="!px-2 !py-1 text-xs">View all</Button>}
          />
          <BugList bugs={recentBugs} showProject projects={projects} />
        </div>
        <div>
          <SectionHeader
            title="Projects"
            action={<Button variant="ghost" href="/projects" className="!px-2 !py-1 text-xs">All</Button>}
          />
          <div className="flex flex-col gap-2.5">
            {projects.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} className="group">
                <Card className="p-3.5 transition-colors hover:border-line-strong hover:bg-surface-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-content">{p.name}</span>
                    <span className="font-mono text-xs" style={{ color: p.healthScore >= 80 ? "var(--success)" : p.healthScore >= 60 ? "var(--p2)" : "var(--p0)" }}>
                      {p.healthScore}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-xs text-muted">{p.url}</div>
                  <div className="mt-2.5 flex items-center gap-3 text-xs text-secondary">
                    <span>{p.openBugs} bugs</span>
                    {p.criticalBugs > 0 && <span className="text-p0">{p.criticalBugs} critical</span>}
                    <span className="ml-auto text-muted">{coveragePct(p.coverage)}% cov</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, hint, hintColor }: { label: string; value: string | number; hint?: string; hintColor?: string }) {
  return (
    <Card className="card-hover hairline-top overflow-hidden p-4">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted">{label}</div>
      <div className="tabular mt-2 text-[28px] font-semibold leading-none tracking-tight text-content">{value}</div>
      {hint && (
        <div className="mt-2 text-xs" style={{ color: hintColor ?? "var(--text-muted)" }}>
          {hint}
        </div>
      )}
    </Card>
  );
}

function MiniStat({ label, value, color, href }: { label: string; value: string | number; color: string; href?: string }) {
  const inner = (
    <>
      <div className="text-lg font-semibold" style={{ color }}>
        {value}
      </div>
      <div className="text-[11px] text-muted">{label}</div>
    </>
  );
  return href ? (
    <Link href={href} className="rounded-md py-1 transition-colors hover:bg-surface-2">
      {inner}
    </Link>
  ) : (
    <div className="py-1">{inner}</div>
  );
}
