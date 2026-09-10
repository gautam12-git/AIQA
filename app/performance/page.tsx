import { InsightView } from "@/components/features/insight-view";

export default function PerformancePage() {
  return (
    <InsightView
      category="performance"
      title="Performance"
      description="Slow pages and endpoints, heavy resources, and latency findings that hurt experience."
    />
  );
}
