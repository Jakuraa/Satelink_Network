import type { Metadata } from "next";
import { CsvButton } from "@/components/CsvButton";
import { Empty, Kpi, NeedsKey, PageHeader, Panel, Table } from "@/components/ui";
import { loadKey, series, windowSum } from "@/lib/data";
import { int, usd } from "@/lib/format";
import { fingerprint, getActiveKey, getKeys } from "@/lib/keys";
import { accountsEnabled } from "@/lib/account";
import { loadCatalog, loadKeys, loadPlan, loadUsage } from "@/lib/v2";
import { UsageDashboard } from "@/components/v2/UsageDashboard";

export const metadata: Metadata = { title: "Usage & Execution" };

function Bars({ values, labels }: { values: number[]; labels: string[] }) {
  const max = Math.max(...values, 1);
  return (
    <div role="img" aria-label={`Daily requests, last ${values.length} days, peak ${int(max)}`} className="flex h-32 items-end gap-[3px]">
      {values.map((v, i) => (
        <div key={labels[i]} title={`${labels[i]}: ${int(v)} requests`} className="flex-1 rounded-t-sm bg-sl-accent/80" style={{ height: `${Math.max((v / max) * 100, v > 0 ? 3 : 0.5)}%` }} />
      ))}
    </div>
  );
}

export default async function UsagePage() {
  if (accountsEnabled()) return <UsageV2 />;

  const [keys, active] = await Promise.all([getKeys(), getActiveKey()]);
  if (!active) return (<><PageHeader title="Usage" /><NeedsKey /></>);
  const perKey = await Promise.all(keys.map(async (k) => ({ k, d: await loadKey(k.k) })));
  const mine = perKey.find((x) => x.k.k === active.k)!.d;
  const days = mine.days;
  const s = mine.summary;

  const labels: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - i);
    labels.push(d.toISOString().slice(0, 10));
  }

  // Synthesize AccountPlan for UsageDashboard in legacy / developer mode
  const synthPlan = s ? {
    catalogVersion: "2026-10-18",
    plan: { id: s.plan || "pro", status: "active", periodEnd: s.subscription?.currentPeriodEnd || null },
    subscription: s.subscription ? { planId: s.plan || "pro", status: "active", renewsAt: s.subscription.currentPeriodEnd || null, intro: false } : null,
    windows: {
      session: { usedUu: Math.round((s.usage?.callsToday ?? 0) * 1.5), capUu: 1500, hours: 5, resetsAt: null },
      weekly: { usedUu: Math.round((s.usage?.callsThisMonth ?? 0) * 0.8), capUu: 7500, resetsAt: new Date(Date.now() + 2 * 86400000).toISOString(), timezone: "UTC" },
    },
    packBalanceUu: 25000,
    thisMonth: { packUu: 0, creditsUsdt: s.balanceUsd ?? 0 },
  } : null;

  return (
    <>
      <UsageDashboard
        plan={synthPlan}
        catalog={null}
        cryptoBalanceUsdt={s?.balanceUsd ?? 0}
        usageSeries={null}
      />

      <div className="mt-8">
        <PageHeader
          title="Daily Request Telemetry"
          lede={`Raw request logs and charges for ${active.label}. Figures are recorded per UTC day.`}
          actions={days ? <CsvButton filename={`satelink-usage-${fingerprint(active.k)}.csv`} rows={[["date", "requests", "charged_usdt"], ...days.map((d) => [d.date, d.calls, d.spent])]} /> : undefined}
        />
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Requests today" value={s?.usage ? int(s.usage.callsToday) : null} />
          <Kpi label="Requests this month" value={s?.usage ? int(s.usage.callsThisMonth) : null} />
          <Kpi label="Charged 30 days" value={days ? usd(windowSum(days, 30, "spent"), 5) : null} />
          <Kpi label="Credits remaining" value={s ? usd(s.balanceUsd, 4) : null} />
        </div>

        <Panel title="Daily requests · 30 days" className="mt-4">
          {days && days.some((d) => d.calls > 0) ? (
            <>
              <Bars values={series(days, 30, "calls")} labels={labels} />
              <div className="mt-1 flex justify-between text-[11px] text-sl-text-subtle"><span>{labels[0]}</span><span>{labels[29]}</span></div>
            </>
          ) : (
            <Empty title="No usage in the last 30 days" body="Requests made with this key will chart here." />
          )}
        </Panel>

        <Panel title="By key · 30 days" className="mt-4">
          <Table head={["Key", "Label", "Requests", "Charged"]} numeric={[2, 3]}>
            {perKey.map(({ k, d }) => (
              <tr key={k.k}>
                <td className="font-mono">{fingerprint(k.k)}</td>
                <td>{k.label}</td>
                <td className="text-right">{d.days ? int(windowSum(d.days, 30, "calls")) : <span className="text-sl-down">unavailable</span>}</td>
                <td className="text-right">{d.days ? usd(windowSum(d.days, 30, "spent"), 5) : ""}</td>
              </tr>
            ))}
          </Table>
        </Panel>
      </div>
    </>
  );
}

// Console V2 Usage: Connected to server-side AccountPlan and Catalog
async function UsageV2() {
  const [catalog, plan, keys, usage] = await Promise.all([
    loadCatalog(),
    loadPlan(),
    loadKeys(),
    loadUsage(30),
  ]);

  const p = plan.ok ? plan.data : null;
  const credits = keys.ok ? keys.data.reduce((a, k) => a + k.balanceUsdt, 0) : null;

  return (
    <UsageDashboard
      plan={p}
      catalog={catalog}
      cryptoBalanceUsdt={credits}
      usageSeries={usage.ok ? usage.data : null}
    />
  );
}
