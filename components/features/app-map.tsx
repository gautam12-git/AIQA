import type { AppMapNode } from "@/lib/types";

const kindMeta: Record<AppMapNode["kind"], { icon: string; tint: string }> = {
  page: { icon: "▦", tint: "var(--text-secondary)" },
  auth: { icon: "🔑", tint: "var(--info)" },
  api: { icon: "⇄", tint: "var(--accent)" },
  admin: { icon: "★", tint: "var(--p1)" },
  flow: { icon: "⟶", tint: "var(--success)" },
};

function Node({ node, depth }: { node: AppMapNode; depth: number }) {
  const k = kindMeta[node.kind];
  const sev = node.worstSeverity;
  return (
    <li className="relative">
      <div className="flex items-center gap-2.5 py-1.5">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-line bg-surface-2 text-xs"
          style={{ color: k.tint }}
          aria-hidden
        >
          {k.icon}
        </span>
        <span className="text-sm text-content">{node.label}</span>
        <span className="font-mono text-[11px] text-muted">{node.path}</span>
        {node.bugCount > 0 && (
          <span
            className="ml-1 inline-flex h-5 items-center gap-1 rounded px-1.5 text-[11px] font-semibold"
            style={{
              color: sev ? `var(--${sev.toLowerCase()})` : "var(--text-muted)",
              background: sev ? `color-mix(in srgb, var(--${sev.toLowerCase()}) 14%, transparent)` : "var(--surface-3)",
            }}
          >
            {node.bugCount} {node.bugCount === 1 ? "bug" : "bugs"}
          </span>
        )}
      </div>
      {node.children && node.children.length > 0 && (
        <ul className="ml-3.5 border-l border-line pl-4">
          {node.children.map((c) => (
            <Node key={c.id} node={c} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function AppMap({ root }: { root: AppMapNode }) {
  return (
    <ul className="text-sm">
      <Node node={root} depth={0} />
    </ul>
  );
}
