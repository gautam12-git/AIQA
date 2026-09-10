"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/primitives";
import { cancelRun } from "@/lib/data";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== "false";

export function CancelRunButton({ runId }: { runId: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function onClick() {
    if (busy || USE_MOCK) return;
    setBusy(true);
    setErr(null);
    try {
      await cancelRun(runId);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {err && <span className="text-xs text-p0">{err}</span>}
      <Button variant="outline" onClick={onClick} disabled={busy || USE_MOCK}>
        {busy ? "Cancelling…" : "Cancel run"}
      </Button>
    </div>
  );
}
