"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  DollarSign,
  Activity,
  Users,
  Server,
  Copy,
  Key,
  Wallet,
} from "lucide-react";
import {
  KPIStat,
  StatRow,
  AlertBand,
  TimeseriesPanel,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  StatusPill,
  EmptyState,
  useEndpoint,
  TimeRangeFilter,
  windowParams,
  type SystemState,
  type TimeWindow,
} from "@satelink/ui";

// ---------------------------------------------------------------------------
// API contracts (real endpoints — no mock/fallback values)
// ---------------------------------------------------------------------------
interface FinancialTruth {
  ok: boolean;
  metered_value_usdt: number;
  external_revenue_usdt?: number;
  internal_revenue_usdt?: number;
  total_deposited_usdt?: number;
  treasury_real_usdt: number;
  withdrawable_now_usdt: number;
  cash_conversion_pct: number;
  status: string;
  settlement?: {
    batches_pending: number;
    batches_confirmed: number;
    batches_blocked_unfunded?: number;
    confirmed_batches_usdt?: number;
    blocked_unfunded_usdt?: number;
  };
  pipeline: {
    revenue_events_v2: {
      count: number;
      sum_usdt: number;
      external_count?: number;
      external_usdt?: number;
      internal_count?: number;
      internal_usdt?: number;
    };
    epoch_ledger: { open: number; closed: number; total_revenue: number };
    settlement_batches?: { confirmed: number; pending?: number; blocked_unfunded?: number };
    bottleneck?: string;
    bottleneck_reason?: string;
  };
  warnings?: { code: string; message: string; severity: "critical" | "warning" }[];
}

// GET /api/public/stats — sanitized network facts (no revenue/treasury fields).
interface PublicStats {
  ok: boolean;
  nodes_online: number | null;
  uptime_pct_24h: number | null;
  requests_24h: number | null;
}

interface EconomicsSummary {
  ok: boolean;
  totalRevenueUsdt: number | null;
  splitRatio: { nodeOperators: number; platform: number; distributors: number };
  lastEpochId: number;
  lastEpochRevenueUsdt: number | null;
  lastEpochClosedAt: string | null;
}

interface ExecutiveSummary {
  revenue_today_usdt: number;
  revenue_mtd_usdt: number;
  active_ips_24h: number;
  total_requests_24h: number;
  paying_customers: number;
  network_health_pct: number;
  open_alerts: number;
  signer_balance_pol: number | null;
  settlement_mode: string;
  window?: string;
  revenue_window_usdt?: number;
  revenue_window_events?: number;
  active_ips_window?: number;
}

interface RpcProviderStat {
  id: string;
  type?: string;
  latency: number | null;
  weight: number;
  requests: number;
  circuit: { state: string; failures: number; timeUntilReset: number };
}

interface RpcStats {
  ok: boolean;
  chain: string;
  providers: RpcProviderStat[];
  cache: { hits: number; misses: number; hitRate: string };
}

// Circuit-breaker state → design-system SystemState + human label.
// CLOSED = serving normally, HALF_OPEN = probing recovery, OPEN = tripped.
function circuitState(raw: string): SystemState {
  switch (raw) {
    case "CLOSED":
      return "healthy";
    case "HALF_OPEN":
      return "degraded";
    case "OPEN":
      return "critical";
    default:
      return "unknown";
  }
}

function circuitLabel(raw: string): string {
  switch (raw) {
    case "CLOSED":
      return "Operational";
    case "HALF_OPEN":
      return "Degraded";
    case "OPEN":
      return "Down";
    default:
      return "Unknown";
  }
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------
const usd5 = (n: number | null | undefined) =>
  n == null ? "—" : `$${n.toLocaleString(undefined, {
    minimumFractionDigits: 5,
    maximumFractionDigits: 5,
  })}`;

const compact = (n: number | null | undefined) => {
  const v = n ?? 0;
  return v >= 1000 ? `${(v / 1000).toFixed(1)}K` : `${v}`;
};

const RPC_URL = "https://rpc.satelink.network";

export default function MissionControlPage() {
  // Financial panels: /api/financial/truth is admin-only (401 without an
  // admin token). Public panels read /api/public/stats.
  const financial = useEndpoint<FinancialTruth>(["/api/financial/truth"]);
  const publicStats = useEndpoint<PublicStats>(["/api/public/stats"]);
  const economics = useEndpoint<EconomicsSummary>(["/api/economics/summary"]);
  const [execSummary, setExecSummary] = useState<ExecutiveSummary | null>(null);
  const [execLoading, setExecLoading] = useState(true);
  const [rpcStats, setRpcStats] = useState<RpcStats | null>(null);
  const [copied, setCopied] = useState(false);

  // Time window → /executive/summary ?window= (revenue in the selected range).
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("24h");
  const [customFrom, setCustomFrom] = useState<string | undefined>(undefined);
  const [customTo, setCustomTo] = useState<string | undefined>(undefined);
  const windowQS = useMemo(
    () => new URLSearchParams(windowParams(timeWindow, customFrom, customTo)).toString(),
    [timeWindow, customFrom, customTo]
  );
  const onTimeChange = useCallback((v: TimeWindow, from?: string, to?: string) => {
    setTimeWindow(v);
    setCustomFrom(from);
    setCustomTo(to);
  }, []);

  // Executive KPIs come through the admin proxy; re-fetched on window change.
  useEffect(() => {
    setExecLoading(true);
    fetch("/api/admin-proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: `/executive/summary?${windowQS}`, method: "GET" }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (res?.ok && res.data) setExecSummary(res.data as ExecutiveSummary);
      })
      .catch(() => {})
      .finally(() => setExecLoading(false));
  }, [windowQS]);

  // Provider health + cache metrics — real, already-live gateway telemetry
  // (public GET, CORS-open). Refreshed every 30s.
  useEffect(() => {
    const load = () => {
      fetch(`${RPC_URL}/rpc/stats/polygon`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((res) => {
          if (res?.ok) setRpcStats(res as RpcStats);
        })
        .catch(() => {});
    };
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  const fin = financial.data;
  const finMissing = financial.error === "HTTP 401" || financial.error === "HTTP 403" ? "admin only" : "—";
  const requests24h = publicStats.data?.requests_24h ?? null;
  const eco = economics.data;
  const pipeline = fin?.pipeline;
  const warnings = fin?.warnings ?? [];
  const confirmedBatches =
    pipeline?.settlement_batches?.confirmed ?? fin?.settlement?.batches_confirmed ?? 0;
  const openEpochs = pipeline?.epoch_ledger.open ?? 0;
  const pendingRevenue = pipeline?.revenue_events_v2.sum_usdt ?? 0;
  const settlementMode = execSummary?.settlement_mode ?? "";
  const isDryRun = /dry.?run/i.test(settlementMode);
  const cache = rpcStats?.cache;
  const providers = rpcStats?.providers ?? [];

  const copyEndpoint = () => {
    navigator.clipboard?.writeText(RPC_URL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="px-6 py-6">
      {/* FILTER BAR — time window drives /executive/summary ?window= */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <TimeRangeFilter value={timeWindow} onChange={onTimeChange} customFrom={customFrom} customTo={customTo} />
        <span className="text-xs font-mono text-zinc-500 tabular-nums">
          {execLoading
            ? "Loading window…"
            : execSummary
              ? `Window ${execSummary.window ?? timeWindow}: ${usd5(execSummary.revenue_window_usdt ?? 0)} · ${execSummary.revenue_window_events ?? 0} events`
              : "No data for this period"}
        </span>
      </div>

      {/* ROW 1 — KPI strip */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        {/* Card 1: EXTERNAL CUSTOMER REVENUE */}
        <div className="relative bg-zinc-900 border border-zinc-800 rounded-sm p-5 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-[hsl(174,80%,38%)]" />
          <div className="flex items-start justify-between mb-3">
            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500 block">External Customer Revenue</span>
              <span className="text-[10px] text-zinc-600 block">Metered, excl. founder/treasury & test data — not reconciled on-chain</span>
            </div>
            <DollarSign className="h-4 w-4 text-zinc-600" />
          </div>
          <div className="font-mono text-2xl font-bold text-white tabular-nums mb-1">
            {fin && fin.external_revenue_usdt != null ? usd5(fin.external_revenue_usdt) : finMissing === "—" ? "unavailable" : finMissing}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {(fin?.external_revenue_usdt ?? 0) > 0 ? (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-400">Unreconciled</span>
            ) : (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-zinc-500/15 text-zinc-400">—</span>
            )}
            <span className="text-xs text-zinc-500">
              {fin?.internal_revenue_usdt ? `+${usd5(fin.internal_revenue_usdt)} internal` : "External metered"}
            </span>
          </div>
        </div>

        {/* Card 2: API REQUESTS (24H) */}
        <div className="relative bg-zinc-900 border border-zinc-800 rounded-sm p-5 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-[hsl(174,80%,38%)]" />
          <div className="flex items-start justify-between mb-3">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">API Requests</span>
            <Activity className="h-4 w-4 text-zinc-600" />
          </div>
          <div className="font-mono text-2xl font-bold text-white tabular-nums mb-1">{requests24h != null ? compact(requests24h) : "—"}</div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-zinc-500">24h window</span>
          </div>
        </div>

        {/* Card 3: ACTIVE IPs */}
        <div className="relative bg-zinc-900 border border-zinc-800 rounded-sm p-5 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-[hsl(174,80%,38%)]" />
          <div className="flex items-start justify-between mb-3">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Active IPs</span>
            <Users className="h-4 w-4 text-zinc-600" />
          </div>
          <div className="font-mono text-2xl font-bold text-white tabular-nums mb-1">{execSummary ? compact(execSummary.active_ips_window ?? execSummary.active_ips_24h) : "—"}</div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-zinc-500">Unique callers, {execSummary?.window ?? "24h"} window</span>
          </div>
        </div>

        {/* Card 4: SETTLEMENT BATCHES */}
        <div className="relative bg-zinc-900 border border-zinc-800 rounded-sm p-5 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-[hsl(174,80%,38%)]" />
          <div className="flex items-start justify-between mb-3">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Settlement Batches</span>
            <Server className="h-4 w-4 text-zinc-600" />
          </div>
          <div className="font-mono text-2xl font-bold text-white tabular-nums mb-1">{fin ? confirmedBatches : finMissing}</div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-zinc-500/15 text-zinc-400">—</span>
            <span className="text-xs text-zinc-500">Confirmed on-chain</span>
          </div>
        </div>
      </div>

      {/* ROW 2 — Full width chart */}
      <div className="mb-6">
        <TimeseriesPanel
          title="Gateway Traffic"
          subtitle="Request rate over time"
          data={[]}
          series={[{ key: "requests", label: "Requests", type: "area", color: "hsl(var(--chart-1))" }]}
          className="w-full min-h-[300px]"
          showLegend={false}
          emptyHint="No request-history endpoint yet — 24h totals appear in the KPI strip above."
        />
      </div>

      {/* ROW 2.5 — Provider health + cache performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Left — RPC Provider Status */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-sm p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">RPC Provider Status</div>
          {providers.length > 0 ? (
            <div>
              {providers.map((p) => (
                <div
                  key={p.id}
                  className="flex justify-between items-center py-2 border-b border-zinc-800/50 last:border-0"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs text-zinc-300 truncate">{p.id}</span>
                    {p.latency != null && (
                      <span className="text-[10px] text-zinc-600 tabular-nums shrink-0">{p.latency}ms</span>
                    )}
                  </div>
                  <StatusPill
                    status={p.circuit.state}
                    state={circuitState(p.circuit.state)}
                    label={circuitLabel(p.circuit.state)}
                  />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Provider health not yet tracked"
              description="Circuit-breaker status appears once the gateway reports provider stats."
            />
          )}
        </div>

        {/* Right — Cache Performance */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-sm p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Cache Performance (24h)</div>
          {cache ? (
            <div>
              <div className="flex justify-between items-center py-2 border-b border-zinc-800/50">
                <span className="text-xs text-zinc-500">Hit Rate</span>
                <span className="text-sm font-mono text-white tabular-nums">{cache.hitRate}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-zinc-800/50">
                <span className="text-xs text-zinc-500">Hits</span>
                <span className="text-sm font-mono text-white tabular-nums">{cache.hits.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-zinc-800/50 last:border-0">
                <span className="text-xs text-zinc-500">Misses</span>
                <span className="text-sm font-mono text-white tabular-nums">{cache.misses.toLocaleString()}</span>
              </div>
            </div>
          ) : (
            <EmptyState
              title="Cache metrics unavailable"
              description="Hit-rate telemetry appears once requests flow through the gateway cache."
            />
          )}
        </div>
      </div>

      {/* ROW 3 — Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Left — Revenue Pipeline */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-sm p-5">
          <div className="text-sm font-semibold uppercase tracking-wider text-zinc-400 mb-3">Revenue Pipeline</div>
          {!fin ? (
            <p className="text-sm text-zinc-500">{finMissing === "admin only" ? "Admin only." : "Unavailable."}</p>
          ) : (
          <div className="space-y-3">
            <PipelineRow label="Metered Events" value={pipeline?.revenue_events_v2.count ?? 0} />
            <PipelineRow label="Open Epochs" value={pipeline?.epoch_ledger.open ?? 0} />
            <PipelineRow label="Confirmed Batches" value={confirmedBatches} />
            {eco ? (
              <PipelineRow
                label="Last Closed Epoch"
                value={`#${eco.lastEpochId} · ${usd5(eco.lastEpochRevenueUsdt)}`}
              />
            ) : null}
            {pipeline?.bottleneck_reason ? (
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-zinc-500">Bottleneck</span>
                <span className="text-xs font-medium text-amber-400">
                  {pipeline.bottleneck_reason}
                </span>
              </div>
            ) : null}
          </div>
          )}
        </div>

        {/* Right — Quick Start */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-sm p-5">
          <div className="text-sm font-semibold uppercase tracking-wider text-zinc-400 mb-3">Quick Start</div>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-zinc-500">Your RPC endpoint</p>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 truncate rounded-md bg-zinc-950 border border-zinc-800/50 px-3 py-2 font-mono text-sm text-zinc-300">
                  {RPC_URL}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyEndpoint}
                  aria-label="Copy RPC endpoint"
                  className="border-zinc-800 bg-zinc-900 hover:bg-zinc-800"
                >
                  <Copy className="size-4 text-zinc-400" />
                </Button>
              </div>
              {copied ? <p className="mt-1 text-xs text-emerald-400">Copied</p> : null}
            </div>
            <p className="text-xs text-zinc-500">Chain: Polygon Mainnet (137)</p>
            <div className="flex flex-wrap gap-2">
              <Button asChild className="bg-[hsl(174,80%,38%)] text-white hover:bg-[hsl(174,80%,30%)] border-0">
                <Link href="/satelink/os/keys">
                  <Key className="size-4 mr-2" />
                  Get API Key
                </Link>
              </Button>
              <Button asChild variant="outline" className="border-zinc-800 bg-transparent text-zinc-300 hover:bg-zinc-800/50">
                <Link href="/satelink/os/deposit">
                  <Wallet className="size-4 mr-2" />
                  Add Credits
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ROW 3.5 — Settlement pipeline accounting (network-wide) */}
      <div className="mb-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-sm p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
            Settlement Pipeline
            <span className="ml-2 normal-case tracking-normal text-zinc-600">· internal epoch rollups & distribution state</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="rounded-sm bg-zinc-950/40 p-3">
              <div className="text-xs text-zinc-500 mb-1">Open Epochs</div>
              <div className="text-2xl font-mono text-white tabular-nums">{fin ? openEpochs.toLocaleString() : finMissing}</div>
              <div className="text-[10px] text-zinc-600 mt-1">Pending aggregation</div>
            </div>
            <div className="rounded-sm bg-zinc-950/40 p-3">
              <div className="text-xs text-zinc-500 mb-1">Simulated Batches</div>
              <div className="text-2xl font-mono text-white tabular-nums">{fin ? confirmedBatches.toLocaleString() : finMissing}</div>
              <div className="text-[10px] text-zinc-600 mt-1">
                {fin?.settlement?.confirmed_batches_usdt ? `${usd5(fin.settlement.confirmed_batches_usdt)} internal` : "Simulated/internal"}
              </div>
            </div>
            <div className="rounded-sm bg-zinc-950/40 p-3">
              <div className="text-xs text-zinc-500 mb-1">Blocked (Unfunded)</div>
              <div className="text-2xl font-mono text-amber-400 tabular-nums">
                {fin?.settlement?.batches_blocked_unfunded != null ? fin.settlement.batches_blocked_unfunded.toLocaleString() : finMissing === "—" ? "unavailable" : finMissing}
              </div>
              <div className="text-[10px] text-amber-500/70 mt-1">Signer gas starved</div>
            </div>
            <div className="rounded-sm bg-zinc-950/40 p-3">
              <div className="text-xs text-zinc-500 mb-1">Total Metered Usage</div>
              <div className="text-2xl font-mono text-white tabular-nums">{fin ? usd5(pendingRevenue) : finMissing}</div>
              <div className="text-[10px] text-zinc-600 mt-1">All billable events</div>
            </div>
          </div>
          {isDryRun && (
            <div className="mt-3 flex items-center gap-2 rounded-sm border border-amber-500/30 bg-amber-500/10 px-3 py-2">
              <span className="size-1.5 shrink-0 rounded-full bg-amber-400" />
              <span className="text-xs text-amber-300">
                Settlement in DRY_RUN — on-chain broadcast disabled. Confirmed batches represent internal accounting aggregations, not external customer revenue.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ROW 4 — Alert strip */}
      <div className="mb-6">
        <AlertBand
          alerts={warnings.map((w) => ({
            code: w.code,
            message: w.message,
            severity: w.severity === "critical" ? "critical" : "warning",
          }))}
          className="[&>div]:h-9 [&>div]:py-0 [&>div]:min-h-9"
        />
      </div>
    </div>
  );
}

function PipelineRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-mono text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

