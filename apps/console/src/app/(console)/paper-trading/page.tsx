import type { Metadata } from "next";
import { accountsEnabled } from "@/lib/account";
import { getActiveKey, getKeys, fingerprint } from "@/lib/keys";
import { loadKeys } from "@/lib/v2";
import { loadTradingDiscovery } from "@/lib/trading";
import { PaperTradingWorkspace } from "@/components/PaperTradingWorkspace";

export const metadata: Metadata = {
  title: "Paper Trading · Satelink Trading AI",
  description: "Execute deterministic algorithmic trading simulations through a developer-first API.",
};

export const dynamic = "force-dynamic";

export default async function PaperTradingPage() {
  const discovery = await loadTradingDiscovery();

  let keys: { id: number; label: string; hint: string; fingerprint: string; balanceUsdt: number }[] = [];
  let activeFp: string | null = null;

  if (accountsEnabled()) {
    const kRes = await loadKeys();
    if (kRes.ok && Array.isArray(kRes.data)) {
      keys = kRes.data
        .filter((k) => k.status === "active" && !k.limits.paused)
        .map((k) => ({
          id: k.id,
          label: k.label,
          hint: k.hint,
          fingerprint: k.fingerprint,
          balanceUsdt: k.balanceUsdt,
        }));
    }
  } else {
    const [browserKeys, active] = await Promise.all([getKeys(), getActiveKey()]);
    activeFp = active ? fingerprint(active.k) : null;
    keys = browserKeys.map((k, idx) => ({
      id: idx + 1,
      label: k.label,
      hint: k.k.slice(-4),
      fingerprint: fingerprint(k.k),
      balanceUsdt: 0,
    }));
  }

  return (
    <div className="mx-auto max-w-6xl pb-8">
      <PaperTradingWorkspace discovery={discovery} keys={keys} activeFp={activeFp} />
    </div>
  );
}
