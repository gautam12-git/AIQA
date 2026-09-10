import { getRuns, getProjects } from "@/lib/data";
import { PageHeader } from "@/components/features/page-header";
import { RunList } from "@/components/features/run-list";
import { Button } from "@/components/ui/primitives";

export default async function RunsPage() {
  const [runs, projects] = await Promise.all([getRuns(), getProjects()]);
  const projectName = (id: string) => projects.find((p) => p.id === id)?.name;

  return (
    <div className="aiqa-fade-up">
      <PageHeader
        title="Test Runs"
        description="Every exploration AIQA has executed, live or finished, with the bugs each surfaced."
        actions={<Button href="/scan">New scan</Button>}
      />
      <RunList runs={runs} projectNameOf={projectName} />
    </div>
  );
}
