import type { Coverage } from "@/lib/types";
import { ProgressBar } from "@/components/ui/primitives";

export function CoveragePanel({ coverage }: { coverage: Coverage }) {
  const rows = [coverage.pages, coverage.buttons, coverage.forms, coverage.apis, coverage.workflows];
  return (
    <div className="flex flex-col gap-3.5">
      {rows.map((m) => {
        const pct = m.discovered === 0 ? 0 : Math.round((m.tested / m.discovered) * 100);
        return (
          <div key={m.label}>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-secondary">{m.label}</span>
              <span className="font-mono text-muted">
                {m.tested}
                <span className="text-line-strong"> / </span>
                {m.discovered}
              </span>
            </div>
            <ProgressBar value={pct} color={pct >= 85 ? "var(--success)" : pct >= 60 ? "var(--accent)" : "var(--p2)"} />
          </div>
        );
      })}
    </div>
  );
}

export function CoverageMeaning() {
  return (
    <p className="mt-4 text-[11px] leading-relaxed text-muted">
      Coverage measures <span className="text-secondary">meaningful behavior exercised</span>, not
      pages visited — buttons clicked, forms submitted, endpoints called, and workflows completed
      end-to-end.
    </p>
  );
}
