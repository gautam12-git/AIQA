import { notFound } from "next/navigation";
import Link from "next/link";
import { getProject, getRuns, getBugs, getAppMap } from "@/lib/data";
import { Card, SectionHeader, Button } from "@/components/ui/primitives";
import { PageHeader } from "@/components/features/page-header";
import { Pill } from "@/components/ui/badges";
import { CoveragePanel, CoverageMeaning } from "@/components/features/coverage-panel";
import { BugList } from "@/components/features/bug-list";
import { RunList } from "@/components/features/run-list";
import { AppMap } from "@/components/features/app-map";
import { coveragePct, timeAgo } from "@/lib/format";
import { IconExternal } from "@/components/layout/icons";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const [runs, bugs, appMap] = await Promise.all([
    getRuns(id),
    getBugs({ projectId: id }),
    getAppMap(id),
  ]);

  return (
    <div className="aiqa-fade-up">
      <PageHeader
        title={project.name}
        breadcrumb={[{ label: "Projects", href: "/projects" }, { label: project.name }]}
        description={project.appType}
        actions={
          <>
            <a
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-3 py-2 text-sm text-content hover:bg-surface-2"
            >
              Visit <IconExternal className="h-3.5 w-3.5" />
            </a>
            <Button href={`/scan?project=${project.id}`}>New scan</Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Pill color="var(--warning)">{project.environment}</Pill>
        {project.roles.map((r) => (
          <Pill key={r} color="var(--text-secondary)" dot={false}>
            {r}
          </Pill>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Health score" value={project.healthScore} color={project.healthScore >= 80 ? "var(--success)" : "var(--p2)"} />
        <Stat label="Open bugs" value={project.openBugs} hint={`${project.criticalBugs} critical`} />
        <Stat label="Coverage" value={`${coveragePct(project.coverage)}%`} />
        <Stat label="Last scan" value={project.lastScanAt ? timeAgo(project.lastScanAt) : "—"} small />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionHeader title="Findings" sub={`${bugs.length} open`} action={<Button variant="ghost" href={`/bugs?project=${id}`} className="!px-2 !py-1 text-xs">All</Button>} />
          {bugs.length ? <BugList bugs={bugs} /> : <p className="text-sm text-muted">No open findings.</p>}

          <div className="mt-6">
            <SectionHeader title="Recent runs" />
            <RunList runs={runs} />
          </div>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <SectionHeader title="Coverage" />
            <CoveragePanel coverage={project.coverage} />
            <CoverageMeaning />
          </Card>

          {appMap && (
            <Card className="p-5">
              <SectionHeader title="Application map" sub="Discovered structure & where bugs live" />
              <div className="-ml-1 overflow-x-auto">
                <AppMap root={appMap} />
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, hint, color, small }: { label: string; value: string | number; hint?: string; color?: string; small?: boolean }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1.5 font-semibold tracking-tight ${small ? "text-lg" : "text-2xl"}`} style={{ color: color ?? "var(--text)" }}>
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </Card>
  );
}
