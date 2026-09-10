import { PageHeader } from "@/components/features/page-header";
import { CodeReviewWorkspace } from "@/components/code-review/workspace";

export default function CodeReviewPage() {
  return (
    <div className="aiqa-fade-up">
      <PageHeader
        title="Code Review"
        description="Review source code — paste a file or point AIQA at a GitHub repo. It checks syntax, logic, formatting, and style, then suggests fixes and returns corrected code."
      />
      <CodeReviewWorkspace />
    </div>
  );
}
