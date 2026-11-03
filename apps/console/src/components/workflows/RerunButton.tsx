"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FlaskConical, Loader2 } from "lucide-react";
import type { StrategySpec } from "@/lib/workflows-shared";
import { btnPrimary } from "./parts";

function idemKey() {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return "lab_" + Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

/** Run a saved strategy's backtest again (new run, same spec). One key per click intent. */
export function RerunButton({ spec }: { spec: StrategySpec }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [key] = useState(idemKey);
  const router = useRouter();

  async function run() {
    setBusy(true); setErr(null);
    const res = await fetch("/api/console/workflows/workflows/runs", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template: "strategy_lab.backtest.v1", input: { spec }, idempotency_key: key }),
    });
    const data = await res.json().catch(() => ({ ok: false }));
    setBusy(false);
    if (!data.ok || !data.run) { setErr(data.message || data.error || "Could not start the backtest."); return; }
    router.push(`/workflows/${data.run.id}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={run} className={btnPrimary} disabled={busy}>
        {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <FlaskConical aria-hidden className="size-4" />}
        {busy ? "Running walk-forward backtest…" : "Run backtest again"}
      </button>
      {err && <p role="alert" className="text-sm text-sl-warn">{err}</p>}
    </div>
  );
}
