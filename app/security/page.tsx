import { InsightView } from "@/components/features/insight-view";

export default function SecurityPage() {
  return (
    <InsightView
      category="security"
      title="Security"
      description="Authentication, authorization, access-control, and OWASP-aligned findings across your applications."
    />
  );
}
