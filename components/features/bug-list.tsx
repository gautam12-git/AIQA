import Link from "next/link";
import type { Bug, Project } from "@/lib/types";
import { SeverityBadge, ConfidenceBadge, CategoryBadge } from "@/components/ui/badges";
import { timeAgo } from "@/lib/format";
import { IconChevron } from "@/components/layout/icons";

export function BugRow({ bug, projectName }: { bug: Bug; projectName?: string }) {
  const target = bug.affectedApi ?? bug.affectedUrl;
  return (
    <Link
      href={`/bugs/${bug.id}`}
      className="group flex items-center gap-4 border-b border-line px-4 py-3 transition-colors last:border-b-0 hover:bg-surface-2"
    >
      <SeverityBadge severity={bug.severity} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-content group-hover:text-white">
            {bug.title}
          </span>
          {bug.isRegression && (
            <span className="shrink-0 rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-medium text-p1">
              REGRESSION
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted">
          {projectName && (
            <>
              <span className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-secondary">
                {projectName}
              </span>
              <span className="text-line-strong">·</span>
            </>
          )}
          <span className="font-mono text-[11px] text-muted">{bug.id}</span>
          {target && (
            <>
              <span className="text-line-strong">·</span>
              <span className="truncate font-mono text-[11px]">{target}</span>
            </>
          )}
          <span className="text-line-strong">·</span>
          <span>{timeAgo(bug.createdAt)}</span>
        </div>
      </div>
      <div className="hidden items-center gap-2 sm:flex">
        <CategoryBadge category={bug.category} />
        <ConfidenceBadge confidence={bug.confidence} />
      </div>
      <IconChevron className="h-4 w-4 shrink-0 text-line-strong group-hover:text-secondary" />
    </Link>
  );
}

export function BugList({
  bugs,
  showProject,
  projects,
}: {
  bugs: Bug[];
  showProject?: boolean;
  projects?: Project[];
}) {
  const nameById = new Map((projects ?? []).map((p) => [p.id, p.name]));
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
      {bugs.map((b) => (
        <BugRow
          key={b.id}
          bug={b}
          projectName={showProject ? nameById.get(b.projectId) ?? b.projectId : undefined}
        />
      ))}
    </div>
  );
}
