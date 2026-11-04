"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { btnPrimary, btnSecondary } from "./parts";

/** Approve / cancel for a run awaiting approval (run detail page). */
export function RunActions({ runId, amountUsd, provider }: { runId: string; amountUsd: string; provider: string }) {
  const [busy, setBusy] = useState<"approve" | "cancel" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function act(action: "approve" | "cancel") {
    setBusy(action); setErr(null);
    const res = await fetch(`/api/console/workflows/workflows/runs/${runId}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const data = await res.json().catch(() => ({ ok: false }));
    setBusy(null);
    if (!data.ok) { setErr(data.message || data.error || `Could not ${action}.`); return; }
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-sl-text">This run is waiting for you: one call to <span className="font-medium">{provider}</span> for <span className="tnum font-semibold">${amountUsd}</span>. Failed or unverified calls are not charged.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => act("approve")} className={btnPrimary} disabled={busy !== null}>
          {busy === "approve" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Check aria-hidden className="size-4" />} Approve & run
        </button>
        <button type="button" onClick={() => act("cancel")} className={btnSecondary} disabled={busy !== null}><X aria-hidden className="size-4" /> Cancel</button>
      </div>
      {err && <p role="alert" className="text-sm text-sl-warn">{err}</p>}
    </div>
  );
}
