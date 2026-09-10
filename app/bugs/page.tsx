import Link from "next/link";
import { getBugs, getProjects } from "@/lib/data";
import { PageHeader } from "@/components/features/page-header";
import { BugList } from "@/components/features/bug-list";
import { EmptyState } from "@/components/ui/primitives";
import { categoryMeta, severityMeta } from "@/lib/format";
import type { BugCategory, Severity } from "@/lib/types";

const categories = Object.keys(categoryMeta) as BugCategory[];
const severities: Severity[] = ["P0", "P1", "P2", "P3"];

export default async function BugsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; severity?: string; project?: string }>;
}) {
  const sp = await searchParams;
  const [bugs, projects] = await Promise.all([
    getBugs({ category: sp.category, severity: sp.severity, projectId: sp.project }),
    getProjects(),
  ]);

  function qs(patch: Record<string, string | undefined>) {
    const next = { category: sp.category, severity: sp.severity, project: sp.project, ...patch };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v) params.set(k, v);
    const s = params.toString();
    return s ? `/bugs?${s}` : "/bugs";
  }

  const activeCat = sp.category as BugCategory | undefined;
  const activeSev = sp.severity as Severity | undefined;

  return (
    <div className="aiqa-fade-up">
      <PageHeader
        title="Bugs"
        description="Verified defects across every category. Each is backed by evidence and a replayable reproduction."
      />

      {/* Filter bar */}
      <div className="mb-4 space-y-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-muted">Severity</span>
          <Chip href={qs({ severity: undefined })} active={!activeSev}>All</Chip>
          {severities.map((s) => (
            <Chip key={s} href={qs({ severity: s })} active={activeSev === s} color={severityMeta[s].color}>
              {s}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-muted">Category</span>
          <Chip href={qs({ category: undefined })} active={!activeCat}>All</Chip>
          {categories.map((c) => (
            <Chip key={c} href={qs({ category: c })} active={activeCat === c}>
              {categoryMeta[c].label}
            </Chip>
          ))}
        </div>
        {sp.project && (
          <div className="text-xs text-muted">
            Filtered to {projects.find((p) => p.id === sp.project)?.name ?? sp.project} ·{" "}
            <Link href={qs({ project: undefined })} className="text-accent hover:text-accent-hover">
              clear
            </Link>
          </div>
        )}
      </div>

      <div className="mb-2 text-xs text-muted">
        {bugs.length} {bugs.length === 1 ? "bug" : "bugs"}
      </div>

      {bugs.length ? (
        <BugList bugs={bugs} showProject projects={projects} />
      ) : (
        <EmptyState title="No bugs match these filters" sub="Try widening the severity or category filter." />
      )}
    </div>
  );
}

function Chip({
  href,
  active,
  children,
  color,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-md border px-2.5 py-1 text-xs font-medium transition-colors"
      style={
        active
          ? { color: color ?? "var(--text)", background: "var(--surface-2)", borderColor: "var(--line-strong)" }
          : { color: "var(--text-muted)", background: "transparent", borderColor: "var(--line)" }
      }
    >
      {children}
    </Link>
  );
}
