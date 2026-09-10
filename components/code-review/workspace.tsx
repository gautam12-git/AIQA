"use client";

import { useState } from "react";
import { CodeReview } from "@/components/code-review/code-review";
import { RepoReview } from "@/components/code-review/repo-review";

type Mode = "paste" | "repo";

export function CodeReviewWorkspace() {
  const [mode, setMode] = useState<Mode>("paste");

  return (
    <div>
      <div className="mb-4 inline-flex rounded-lg border border-line p-0.5">
        {(["paste", "repo"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className="rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors"
            style={mode === m ? { background: "var(--surface-3)", color: "var(--text)" } : { color: "var(--text-muted)" }}
          >
            {m === "paste" ? "Paste code" : "GitHub repo"}
          </button>
        ))}
      </div>
      {mode === "paste" ? <CodeReview /> : <RepoReview />}
    </div>
  );
}
