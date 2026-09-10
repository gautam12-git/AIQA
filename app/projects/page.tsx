import Link from "next/link";
import { getProjects } from "@/lib/data";
import { Card } from "@/components/ui/primitives";
import { PageHeader } from "@/components/features/page-header";
import { Pill } from "@/components/ui/badges";
import { CoveragePanel } from "@/components/features/coverage-panel";
import { coveragePct, timeAgo } from "@/lib/format";
import { IconExternal } from "@/components/layout/icons";

export default async function ProjectsPage() {
  const projects = await getProjects();

  return (
    <div className="aiqa-fade-up">
      <PageHeader
        title="Projects"
        description="Each project is an application AIQA continuously explores and tests."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {projects.map((p) => {
          const healthColor = p.healthScore >= 80 ? "var(--success)" : p.healthScore >= 60 ? "var(--p2)" : "var(--p0)";
          return (
            <Card key={p.id} className="p-5 transition-colors hover:border-line-strong">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/projects/${p.id}`} className="text-base font-semibold text-content hover:text-white">
                    {p.name}
                  </Link>
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 flex items-center gap-1.5 text-xs text-muted hover:text-secondary"
                  >
                    <span className="truncate">{p.url}</span>
                    <IconExternal className="h-3 w-3 shrink-0" />
                  </a>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className="text-xl font-semibold" style={{ color: healthColor }}>
                    {p.healthScore}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-muted">Health</span>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Pill color="var(--text-secondary)" dot={false}>
                  {p.appType}
                </Pill>
                <Pill color="var(--warning)">{p.environment}</Pill>
                {p.criticalBugs > 0 && <Pill color="var(--p0)">{p.criticalBugs} critical</Pill>}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3 border-y border-line py-3 text-center">
                <div>
                  <div className="text-lg font-semibold text-content">{p.openBugs}</div>
                  <div className="text-[11px] text-muted">Open bugs</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-content">{coveragePct(p.coverage)}%</div>
                  <div className="text-[11px] text-muted">Coverage</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-content">{p.roles.length}</div>
                  <div className="text-[11px] text-muted">Roles</div>
                </div>
              </div>

              <div className="mt-4">
                <CoveragePanel coverage={p.coverage} />
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-muted">
                  {p.lastScanAt ? `Last scan ${timeAgo(p.lastScanAt)}` : "Never scanned"}
                </span>
                <Link href={`/projects/${p.id}`} className="text-xs font-medium text-accent hover:text-accent-hover">
                  View project →
                </Link>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
