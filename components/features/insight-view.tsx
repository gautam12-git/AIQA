import { getBugs, getProjects } from "@/lib/data";
import { PageHeader } from "@/components/features/page-header";
import { BugList } from "@/components/features/bug-list";
import { Card, EmptyState } from "@/components/ui/primitives";
import type { BugCategory, Severity } from "@/lib/types";
import { severityMeta } from "@/lib/format";

export async function InsightView({
  category,
  title,
  description,
}: {
  category: BugCategory;
  title: string;
  description: string;
}) {
  const [bugs, projects] = await Promise.all([getBugs({ category }), getProjects()]);
  const counts: Record<Severity, number> = { P0: 0, P1: 0, P2: 0, P3: 0 };
  for (const b of bugs) counts[b.severity]++;

  return (
    <div className="aiqa-fade-up">
      <PageHeader title={title} description={description} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Card className="card-hover hairline-top overflow-hidden p-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted">Total</div>
          <div className="tabular mt-2 text-[28px] font-semibold leading-none text-content">{bugs.length}</div>
        </Card>
        {(["P0", "P1", "P2", "P3"] as const).map((s) => (
          <Card key={s} className="card-hover p-4">
            <div className="text-[11px] font-medium uppercase tracking-wider" style={{ color: severityMeta[s].color }}>
              {s}
            </div>
            <div className="tabular mt-2 text-[28px] font-semibold leading-none text-content">{counts[s]}</div>
          </Card>
        ))}
      </div>

      {bugs.length ? (
        <BugList bugs={bugs} showProject projects={projects} />
      ) : (
        <EmptyState title={`No ${title.toLowerCase()} findings yet`} sub="Run a scan to populate this view." />
      )}
    </div>
  );
}
