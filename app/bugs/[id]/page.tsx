import { notFound } from "next/navigation";
import Link from "next/link";
import { getBug, getProject, getBugs } from "@/lib/data";
import { Card, SectionHeader } from "@/components/ui/primitives";
import { PageHeader } from "@/components/features/page-header";
import { SeverityBadge, ConfidenceBadge, CategoryBadge, Pill } from "@/components/ui/badges";
import { EvidenceTabs } from "@/components/features/evidence-tabs";
import { severityMeta, confidenceMeta, timeAgo } from "@/lib/format";

export default async function BugDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bug = await getBug(id);
  if (!bug) notFound();

  const [project, allBugs] = await Promise.all([getProject(bug.projectId), getBugs()]);
  const related = (bug.relatedBugIds ?? [])
    .map((rid) => allBugs.find((b) => b.id === rid))
    .filter(Boolean);

  const target = bug.affectedApi ?? bug.affectedUrl;

  return (
    <div className="aiqa-fade-up">
      <PageHeader
        title={bug.title}
        breadcrumb={[
          { label: "Bugs", href: "/bugs" },
          { label: bug.id },
        ]}
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <SeverityBadge severity={bug.severity} />
        <ConfidenceBadge confidence={bug.confidence} />
        <CategoryBadge category={bug.category} />
        {bug.isRegression && <Pill color="var(--p1)">Regression</Pill>}
        <span className="ml-auto font-mono text-xs text-muted">{bug.id}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-4 lg:col-span-2">
          <Card className="p-5">
            <p className="text-sm leading-relaxed text-secondary">{bug.description}</p>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-line bg-surface-2 p-3.5">
                <div className="mb-1 text-[10px] uppercase tracking-wider text-success">Expected</div>
                <div className="text-sm text-content">{bug.expectedBehavior}</div>
              </div>
              <div className="rounded-lg border border-line bg-surface-2 p-3.5">
                <div className="mb-1 text-[10px] uppercase tracking-wider text-p0">Actual</div>
                <div className="text-sm text-content">{bug.actualBehavior}</div>
              </div>
            </div>
          </Card>

          {/* Reproduction */}
          <Card className="p-5">
            <SectionHeader
              title="Reproduction"
              sub={bug.frequency ? `Reproduced — ${bug.frequency}` : undefined}
            />
            <ol className="relative space-y-0">
              {bug.reproSteps.map((s, i) => (
                <li key={s.n} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line bg-surface-2 font-mono text-[11px] text-secondary">
                      {s.n}
                    </span>
                    {i < bug.reproSteps.length - 1 && <span className="w-px flex-1 bg-line" />}
                  </div>
                  <div className="pb-3.5 pt-0.5">
                    <span className="text-sm text-content">{s.action}</span>
                    {s.target && <span className="ml-1.5 font-mono text-xs text-accent">{s.target}</span>}
                    {s.detail && <div className="mt-0.5 text-xs text-muted">{s.detail}</div>}
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          {/* Evidence */}
          <div>
            <SectionHeader title="Evidence" sub="Captured automatically during the run" />
            <EvidenceTabs evidence={bug.evidence} />
          </div>
        </div>

        {/* Side column */}
        <div className="space-y-4">
          <Card className="p-5">
            <SectionHeader title="Details" />
            <dl className="space-y-2.5 text-sm">
              <Row label="Project">
                {project ? (
                  <Link href={`/projects/${project.id}`} className="text-accent hover:text-accent-hover">
                    {project.name}
                  </Link>
                ) : (
                  "—"
                )}
              </Row>
              <Row label="Run">
                <Link href={`/runs/${bug.runId}`} className="font-mono text-xs text-accent hover:text-accent-hover">
                  {bug.runId}
                </Link>
              </Row>
              <Row label="Environment">{bug.environment}</Row>
              {target && (
                <Row label={bug.affectedApi ? "API" : "URL"}>
                  <span className="break-all font-mono text-xs text-secondary">{target}</span>
                </Row>
              )}
              <Row label="Confidence">{confidenceMeta[bug.confidence].label}</Row>
              <Row label="Severity">
                <span style={{ color: severityMeta[bug.severity].color }}>{severityMeta[bug.severity].label}</span>
              </Row>
              <Row label="Found">{timeAgo(bug.createdAt)}</Row>
            </dl>
          </Card>

          <Card className="p-5">
            <SectionHeader title="Potential impact" />
            <p className="text-sm leading-relaxed text-secondary">{bug.impact}</p>
          </Card>

          {bug.suggestedFix && (
            <Card className="border-accent-line p-5" >
              <SectionHeader title="Suggested fix" />
              <p className="text-sm leading-relaxed text-secondary">{bug.suggestedFix}</p>
            </Card>
          )}

          {related.length > 0 && (
            <Card className="p-5">
              <SectionHeader title="Related bugs" />
              <div className="space-y-2">
                {related.map(
                  (r) =>
                    r && (
                      <Link
                        key={r.id}
                        href={`/bugs/${r.id}`}
                        className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm hover:border-line-strong"
                      >
                        <SeverityBadge severity={r.severity} size="sm" />
                        <span className="truncate text-content">{r.title}</span>
                      </Link>
                    ),
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="text-right text-content">{children}</dd>
    </div>
  );
}
