import { InsightView } from "@/components/features/insight-view";

export default function AccessibilityPage() {
  return (
    <InsightView
      category="accessibility"
      title="Accessibility"
      description="WCAG 2.2 findings — keyboard access, focus, labels, contrast, and screen-reader semantics."
    />
  );
}
