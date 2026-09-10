"use client";

import { useState } from "react";
import type { RepoReviewResult, CodeFinding } from "@/lib/types";
import { reviewRepo } from "@/lib/data";
import { SeverityBadge } from "@/components/ui/badges";
import { Card, Button, SectionHeader } from "@/components/ui/primitives";

const catColor: Record<string, string> = {
  syntax: "var(--p0)", logic: "var(--p1)", bug: "var(--p1)", security: "var(--p0)",
  performance: "var(--p2)", formatting: "var(--p3)", style: "var(--p3)", "best-practice": "var(--p3)",
};

export function RepoReview() {
  const [repoUrl, setRepoUrl] = useState("");
  const [subpath, setSubpath] = useState("");
  const [maxFiles, setMaxFiles] = useState(6);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RepoReviewResult | null>(null);

  async function review() {
    if (!repoUrl.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(await reviewRepo({ repoUrl: repoUrl.trim(), subpath: subpath.trim() || undefined, maxFiles }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Repo review failed.");
    } finally {
      setLoading(false);
    }
  }

  const totalFindings = result?.files.reduce((n, f) => n + f.findings.length, 0) ?? 0;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            className="flex-1 rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-content placeholder:text-muted focus:border-accent-line focus:outline-none"
          />
          <Button onClick={review} disabled={loading || !repoUrl.trim()} className="min-w-32">
            {loading ? "Reviewing…" : "Review repo"}
          </Button>
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={subpath}
            onChange={(e) => setSubpath(e.target.value)}
            placeholder="subpath (optional, e.g. src/)"
            className="flex-1 rounded-lg border border-line bg-surface px-3.5 py-2 text-sm text-content placeholder:text-muted focus:border-accent-line focus:outline-none"
          />
          <label className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs text-muted">
            Max files
            <select
              value={maxFiles}
              onChange={(e) => setMaxFiles(Number(e.target.value))}
              className="bg-surface text-content focus:outline-none"
            >
              {[3, 6, 10, 15].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        </div>
        {error && <p className="mt-2 text-xs text-p0">{error}</p>}
        {loading && (
          <p className="mt-2 flex items-center gap-2 text-xs text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-accent aiqa-pulse" />
            Fetching the repo and reviewing files with AI — a few minutes for several files.
          </p>
        )}
        <p className="mt-2 text-[11px] text-muted">Public repos only for now. Reviews a bounded set of source files to keep it fast.</p>
      </Card>

      {result && (
        <>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <SectionHeader title={result.repo} sub={`branch ${result.ref}`} />
              <span
                className="rounded-md px-2 py-0.5 text-[11px]"
                style={{ color: result.llmUsed ? "var(--success)" : "var(--text-muted)", background: result.llmUsed ? "var(--success-soft)" : "var(--surface-2)" }}
              >
                {result.llmUsed ? "AI review ✓" : "Deterministic only"}
              </span>
            </div>
            <p className="text-sm text-secondary">{result.summary}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="rounded-md bg-surface-2 px-2 py-1 text-secondary">{result.filesReviewed} / {result.filesAvailable} files</span>
              <span className="rounded-md bg-surface-2 px-2 py-1 text-secondary">{totalFindings} findings</span>
            </div>
            {result.note && <p className="mt-2 text-[11px] text-muted">{result.note}</p>}
          </Card>

          {result.files.map((file) => (
            <Card key={file.path} className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-sm text-content">{file.path}</span>
                <span className="text-[11px] text-muted">
                  {file.language} · {file.findings.length} finding{file.findings.length === 1 ? "" : "s"}
                </span>
              </div>
              {file.findings.length === 0 ? (
                <p className="text-xs text-muted">No issues found.</p>
              ) : (
                <div className="space-y-2">
                  {file.findings.map((f) => (
                    <FindingRow key={f.id} f={f} />
                  ))}
                </div>
              )}
            </Card>
          ))}
        </>
      )}
    </div>
  );
}

function FindingRow({ f }: { f: CodeFinding }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2 p-3">
      <div className="flex items-start gap-2.5">
        <SeverityBadge severity={f.severity} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-content">{f.title}</span>
            {f.line != null && <span className="font-mono text-[11px] text-muted">line {f.line}</span>}
          </div>
          <span
            className="mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide"
            style={{ color: catColor[f.category] ?? "var(--text-muted)", background: "var(--surface)" }}
          >
            {f.category} · {f.source === "ai" ? "AI" : "deterministic"}
          </span>
          {f.description && <p className="mt-2 text-sm leading-relaxed text-secondary">{f.description}</p>}
          {f.suggestion && (
            <div className="mt-2 rounded-md border border-line bg-surface px-2.5 py-1.5">
              <span className="text-[10px] uppercase tracking-wider text-success">Fix</span>
              <p className="mt-0.5 text-sm text-content">{f.suggestion}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
