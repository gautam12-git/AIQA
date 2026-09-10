"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { runUIReview } from "@/lib/data";
import { IconEye } from "@/components/layout/icons";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== "false";

export function AnalyzeUIButton({ runId }: { runId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (USE_MOCK) return null; // needs the live backend + vision model

  async function analyze() {
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      const r = await runUIReview(runId, 3);
      setMsg(`Added ${r.added} visual finding${r.added === 1 ? "" : "s"} across ${r.pagesAnalyzed} page${r.pagesAnalyzed === 1 ? "" : "s"}.`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "UI analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={analyze}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-lg border border-accent-line bg-accent-soft px-3 py-2 text-sm font-medium text-content transition-colors hover:bg-accent hover:text-white disabled:opacity-60"
      >
        <IconEye className="h-4 w-4" />
        {loading ? "Analyzing UI…" : "Analyze UI (vision)"}
      </button>
      {loading && <span className="text-[11px] text-muted">Vision inspects page screenshots — this can take a few minutes.</span>}
      {msg && <span className="text-[11px] text-success">{msg}</span>}
      {error && <span className="text-[11px] text-p0">{error}</span>}
    </div>
  );
}
