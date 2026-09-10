import { getProjects } from "@/lib/data";
import { PageHeader } from "@/components/features/page-header";
import { ScanForm } from "@/components/scan/scan-form";

export default async function ScanPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project } = await searchParams;
  const projects = await getProjects();

  return (
    <div className="aiqa-fade-up mx-auto max-w-2xl">
      <PageHeader
        title="New scan"
        description="Give AIQA an application. It explores, understands, tests, verifies, and reports."
      />
      <ScanForm projects={projects} initialProject={project} />
    </div>
  );
}
