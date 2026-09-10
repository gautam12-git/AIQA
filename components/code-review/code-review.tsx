"use client";

import { useState } from "react";
import type { CodeReviewResult, CodeFinding } from "@/lib/types";
import { reviewCode } from "@/lib/data";
import { SeverityBadge } from "@/components/ui/badges";
import { Card, Button, SectionHeader } from "@/components/ui/primitives";

const LANGUAGES = [
  "auto", "python", "javascript", "typescript", "java", "go", "ruby", "php",
  "csharp", "c", "cpp", "rust", "json", "html", "css", "sql", "bash", "yaml",
];

const categoryColor: Record<string, string> = {
  syntax: "var(--p0)", logic: "var(--p1)", bug: "var(--p1)", security: "var(--p0)",
  performance: "var(--p2)", formatting: "var(--p3)", style: "var(--p3)", "best-practice": "var(--p3)",
};

const SAMPLE = `def divide(a, b)
    return a / b   # TODO: handle division by zero

print(divide(10, 0))`;

export function CodeReview() {
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("auto");
  const [filename, setFilename] = useState("");
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CodeReviewResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function analyze() {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await reviewCode({
        code,
        language,
        filename: filename.trim() || undefined,
        instruction: instruction.trim() || undefined,
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed.");
    } finally {
      setLoading(false);
    }
  }

  function copyCorrected() {
    if (result?.correctedCode) {
      navigator.clipboard?.writeText(result.correctedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Input */}
      <div className="space-y-3">
        <Card className="p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-content focus:border-accent-line focus:outline-none"
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l === "auto" ? "Auto-detect" : l}
                </option>
              ))}
            </select>
            <input
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="filename.ext (optional)"
              className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-content placeholder:text-muted focus:border-accent-line focus:outline-none"
            />
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Paste your code here…"
            spellCheck={false}
            rows={16}
            className="w-full resize-y rounded-lg border border-line bg-[#0b0c10] px-3.5 py-3 font-mono text-[13px] leading-relaxed text-content placeholder:text-muted focus:border-accent-line focus:outline-none"
          />
          <input
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Optional: what to focus on (e.g. security, performance)"
            className="mt-3 w-full rounded-lg border border-line bg-surface px-3.5 py-2 text-sm text-content placeholder:text-muted focus:border-accent-line focus:outline-none"
          />
          <div className="mt-3 flex items-center gap-3">
            <Button onClick={analyze} disabled={loading || !code.trim()} className="min-w-36">
              {loading ? "Analyzing…" : "Analyze code"}
            </Button>
            <button
              type="button"
              onClick={() => setCode(SAMPLE)}
              className="text-xs text-muted hover:text-secondary"
            >
              Try a sample
            </button>
            {error && <span className="text-xs text-p0">{error}</span>}
          </div>
        </Card>
      </div>

      {/* Results */}
      <div className="space-y-3">
        {!result && !loading && (
          <Card className="flex h-full min-h-64 items-center justify-center p-8 text-center">
            <div>
              <div className="text-sm text-secondary">Paste code and hit Analyze</div>
              <div className="mt-1 text-xs text-muted">
                AIQA checks syntax, logic, formatting & style — and returns corrected code.
              </div>
            </div>
          </Card>
        )}

        {loading && (
          <Card className="flex h-full min-h-64 items-center justify-center p-8">
            <div className="flex items-center gap-2 text-sm text-secondary">
              <span className="h-2 w-2 rounded-full bg-accent aiqa-pulse" />
              Reviewing your code…
            </div>
          </Card>
        )}

        {result && (
          <>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <SectionHeader title="Summary" />
                <span className="rounded-md bg-surface-3 px-2 py-0.5 text-[11px] text-secondary">
                  {result.language}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-secondary">{result.summary}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-md bg-surface-2 px-2 py-1 text-secondary">
                  {result.findings.length} finding{result.findings.length === 1 ? "" : "s"}
                </span>
                <span
                  className="rounded-md px-2 py-1"
                  style={{
                    color: result.llmUsed ? "var(--success)" : "var(--text-muted)",
                    background: result.llmUsed ? "var(--success-soft)" : "var(--surface-2)",
                  }}
                >
                  {result.llmUsed ? "AI review ✓" : "Deterministic only"}
                </span>
              </div>
              {result.note && <p className="mt-2 text-[11px] text-muted">{result.note}</p>}
            </Card>

            {result.findings.map((f) => (
              <FindingCard key={f.id} f={f} />
            ))}

            {result.correctedCode && (
              <Card className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-line bg-surface-2/50 px-4 py-2.5">
                  <span className="text-sm font-medium text-content">Corrected code</span>
                  <button
                    onClick={copyCorrected}
                    className="rounded-md border border-line-strong px-2.5 py-1 text-xs text-secondary hover:bg-surface-2"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <pre className="max-h-[480px] overflow-auto bg-[#0b0c10] p-4 font-mono text-[12.5px] leading-relaxed text-secondary">
                  {result.correctedCode}
                </pre>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function FindingCard({ f }: { f: CodeFinding }) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-2.5">
        <SeverityBadge severity={f.severity} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-content">{f.title}</span>
            {f.line != null && <span className="font-mono text-[11px] text-muted">line {f.line}</span>}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide"
              style={{ color: categoryColor[f.category] ?? "var(--text-muted)", background: "var(--surface-2)" }}
            >
              {f.category}
            </span>
            <span className="text-[10px] text-muted">{f.source === "ai" ? "AI" : "deterministic"}</span>
          </div>
        </div>
      </div>
      {f.description && <p className="mt-2.5 text-sm leading-relaxed text-secondary">{f.description}</p>}
      {f.suggestion && (
        <div className="mt-2 rounded-lg border border-line bg-surface-2 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-success">Suggestion</div>
          <p className="mt-0.5 text-sm text-content">{f.suggestion}</p>
        </div>
      )}
      {f.correctedSnippet && (
        <pre className="mt-2 overflow-x-auto rounded-lg border border-line bg-[#0b0c10] p-3 font-mono text-[12px] leading-relaxed text-secondary">
          {f.correctedSnippet}
        </pre>
      )}
    </Card>
  );
}
