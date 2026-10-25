import type { Metadata } from "next";
import { accountsEnabled } from "@/lib/account";
import { getActiveKey, getKeys } from "@/lib/keys";
import { loadKey } from "@/lib/data";
import { loadKeys } from "@/lib/v2";
import { getSession } from "@/lib/session";
import { loadTradingDiscovery } from "@/lib/trading";
import { OverviewWorkspace } from "@/components/OverviewWorkspace";

export const metadata: Metadata = {
  title: "Overview · Satelink Trading AI",
  description: "Overview of your algorithmic trading simulations, API keys, and credit balances.",
};

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const [session, discovery] = await Promise.all([getSession(), loadTradingDiscovery()]);

  let totalCredits = 0;
  let keysCount = 0;
  let hasActiveKey = false;

  if (accountsEnabled()) {
    const kRes = await loadKeys();
    if (kRes.ok && Array.isArray(kRes.data)) {
      const activeKeys = kRes.data.filter((k) => k.status === "active" && !k.limits.paused);
      keysCount = activeKeys.length;
      totalCredits = activeKeys.reduce((acc, k) => acc + (k.balanceUsdt || 0), 0);
      hasActiveKey = keysCount > 0;
    }
  } else {
    const [keys, active] = await Promise.all([getKeys(), getActiveKey()]);
    keysCount = keys.length;
    hasActiveKey = !!active;
    if (active) {
      const d = await loadKey(active.k);
      totalCredits = d?.summary?.balanceUsd || 0;
    }
  }

  return (
    <div className="mx-auto max-w-6xl pb-8">
      <OverviewWorkspace
        userName={session?.user.name || session?.user.email || ""}
        discovery={discovery}
        totalCredits={totalCredits}
        keysCount={keysCount}
        hasActiveKey={hasActiveKey}
      />
    </div>
  );
}
