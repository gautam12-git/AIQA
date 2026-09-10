import { notFound } from "next/navigation";
import { getRun, getProject, getBugs } from "@/lib/data";
import { SectionHeader, Button } from "@/components/ui/primitives";
import { PageHeader } from "@/components/features/page-header";
import { Pill } from "@/components/ui/badges";
import { BugList } from "@/components/features/bug-list";
import { RunLive } from "@/components/features/run-live";
import { AnalyzeUIButton } from "@/components/features/analyze-ui-button";
import { CancelRunButton } from "@/components/features/cancel-run-button";
import { statusMeta, modeMeta, timeAgo, formatDuration } from "@/lib/format";

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await getRun(id);
  if (!run) notFound();

  const [project, bugs] = await Promise.all([getProject(run.projectId), getBugs({ runId: id })]);
  const sm = statusMeta[run.status];
  const mm = modeMeta[run.mode];
  const isLive = run.status === "running";

  return (
    <div className="aiqa-fade-up">
      <PageHeader
        title={mm.label}
        breadcrumb={[
          { label: "Test Runs", href: "/runs" },
          { label: project?.name ?? run.projectId, href: `/projects/${run.projectId}` },
          { label: run.id },
        ]}
        description={run.instruction ?? mm.desc}
        actions={
          isLive ? (
            <CancelRunButton runId={run.id} />
          ) : (
            <Button href={`/scan?project=${run.projectId}`}>Re-run</Button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Pill color={sm.color}>{sm.label}</Pill>
        <Pill color="var(--warning)">{run.environment}</Pill>
        <span className="text-xs text-muted">
          {isLive ? "Started " : ""}
          {timeAgo(run.startedAt)}
          {run.status === "completed" && ` · ${formatDuration(run.durationMs)}`}
        </span>
      </div>

      {/* Live status: streams via SSE while the run is active. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <RunLive initialRun={run} />
      </div>

      <div className="mt-6">
        <SectionHeader
          title="Bugs from this run"
          sub={`${bugs.length} finding${bugs.length === 1 ? "" : "s"} · includes UI, network, API, headers & security`}
          action={<AnalyzeUIButton runId={run.id} />}
        />
        {bugs.length ? <BugList bugs={bugs} /> : <p className="text-sm text-muted">No findings recorded yet.</p>}
      </div>
    </div>
  );
}
