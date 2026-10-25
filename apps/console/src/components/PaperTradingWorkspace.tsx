"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  DollarSign,
  Info,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sliders,
  Terminal,
} from "lucide-react";
import type { TradingDiscovery, SimulationReport } from "@/lib/trading";

type KeyOption = {
  id: number;
  label: string;
  hint: string;
  fingerprint: string;
  balanceUsdt: number;
};

type Props = {
  discovery: TradingDiscovery;
  keys: KeyOption[];
  activeFp: string | null;
};

function generateIdempotencyKey(): string {
  const rand = Math.random().toString(36).substring(2, 8);
  const ts = Date.now().toString(36).slice(-4);
  return `sim_${ts}_${rand}`;
}

export function PaperTradingWorkspace({ discovery, keys, activeFp }: Props) {
  const defaultKey = keys.find((k) => k.fingerprint === activeFp) || keys[0] || null;

  const [selectedKeyId, setSelectedKeyId] = useState<number | "custom">(defaultKey ? defaultKey.id : "custom");
  const [customKey, setCustomKey] = useState("");
  const [instrumentId, setInstrumentId] = useState(discovery.supported_instruments[0] || "BINANCE:BTCUSDT");
  const [strategy, setStrategy] = useState(discovery.supported_strategies[0] || "sma-crossover");
  const [fastPeriod, setFastPeriod] = useState(3);
  const [slowPeriod, setSlowPeriod] = useState(5);
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [idempotencyKey, setIdempotencyKey] = useState(() => generateIdempotencyKey());

  const [isConfirming, setIsConfirming] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [stepStatus, setStepStatus] = useState<string | null>(null);
  const [result, setResult] = useState<SimulationReport | null>(null);
  const [error, setError] = useState<{ status: number; message: string; code?: string; howToPay?: unknown[] } | null>(null);
  const [copied, setCopied] = useState(false);
  const [viewTab, setViewTab] = useState<"overview" | "signals" | "risk" | "settlement" | "json">("overview");

  const selectedKey = typeof selectedKeyId === "number" ? keys.find((k) => k.id === selectedKeyId) : null;
  const currentBalance = selectedKey ? selectedKey.balanceUsdt : null;
  const isUnfunded = currentBalance !== null && currentBalance < discovery.price_usdt;

  const curlCommand = useMemo(() => {
    const payload = JSON.stringify(
      {
        idempotencyKey,
        instrumentId,
        strategy,
        strategyParams: {
          fastPeriod: Number(fastPeriod),
          slowPeriod: Number(slowPeriod),
        },
        orderQuantity: Number(orderQuantity),
      },
      null,
      2,
    );

    const keyPlaceholder = selectedKey ? `$KEY_${selectedKey.hint}` : "$SATELINK_API_KEY";

    return `curl -X POST https://api.satelink.network/v1/trading/paper/simulate \\
  -H "X-API-Key: ${keyPlaceholder}" \\
  -H "Content-Type: application/json" \\
  -d '${payload}'`;
  }, [idempotencyKey, instrumentId, strategy, fastPeriod, slowPeriod, orderQuantity, selectedKey]);

  const copyCurl = useCallback(async () => {
    await navigator.clipboard.writeText(curlCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [curlCommand]);

  const handleRun = useCallback(async () => {
    setIsConfirming(false);
    setIsExecuting(true);
    setError(null);
    setResult(null);
    setStepStatus("Prechecking API credentials & credit balance…");

    try {
      const bodyPayload: Record<string, unknown> = {
        idempotencyKey,
        instrumentId,
        strategy,
        strategyParams: {
          fastPeriod: Number(fastPeriod),
          slowPeriod: Number(slowPeriod),
        },
        orderQuantity: Number(orderQuantity),
      };

      if (selectedKeyId === "custom" && customKey.trim()) {
        bodyPayload.apiKey = customKey.trim();
      } else if (typeof selectedKeyId === "number") {
        bodyPayload.keyId = selectedKeyId;
      }

      setStepStatus("Executing simulated strategy and fetching snapshot market data…");

      const res = await fetch("/api/console/trading/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json().catch(() => ({ ok: false, error: "bad_response" }));

      if (res.ok && data.ok) {
        setResult(data as SimulationReport);
      } else {
        setError({
          status: res.status,
          message: data.message || data.error || `HTTP ${res.status}`,
          code: data.error,
          howToPay: data.how_to_pay,
        });
      }
    } catch (e) {
      setError({
        status: 0,
        message: e instanceof Error ? e.message : "Network failure executing simulation",
      });
    } finally {
      setIsExecuting(false);
      setStepStatus(null);
    }
  }, [idempotencyKey, instrumentId, strategy, fastPeriod, slowPeriod, orderQuantity, selectedKeyId, customKey]);

  return (
    <div className="space-y-6">
      {/* Header & Product Identity */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-sl-display text-2xl font-medium tracking-tight text-sl-text">Paper Trading Simulation</h1>
            <span className="rounded bg-sl-surface-hover px-2 py-0.5 font-mono text-[11px] text-sl-text-muted">
              {discovery.mode}
            </span>
          </div>
          <p className="mt-1 text-sm text-sl-text-muted">
            Execute deterministic algorithmic trading simulations. Metered at{" "}
            <span className="font-semibold text-sl-text">${discovery.price_usdt.toFixed(2)} USDT</span> per successful run.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/developers"
            className="inline-flex h-8 items-center gap-1.5 rounded border border-sl-border bg-sl-surface px-3 text-xs font-medium text-sl-text hover:bg-sl-surface-hover"
          >
            <Code2Icon className="size-3.5" /> API Reference
          </Link>
          <Link
            href="/billing"
            className="inline-flex h-8 items-center gap-1.5 rounded border border-sl-border bg-sl-surface px-3 text-xs font-medium text-sl-text hover:bg-sl-surface-hover"
          >
            <DollarSign className="size-3.5 text-sl-accent" /> Credits & Billing
          </Link>
        </div>
      </div>

      {/* Mandatory Disclaimer Banner */}
      <div className="flex items-start gap-3 rounded-md border border-sl-border bg-sl-surface p-3 text-xs text-sl-text-muted">
        <Info className="mt-0.5 size-4 shrink-0 text-sl-accent" />
        <div className="space-y-1">
          <p className="font-mono font-medium text-sl-text">{discovery.disclaimer}</p>
          <p>
            Simulated paper execution for quantitative research, backtesting, and AI agent evaluation. Live broker
            execution remains strictly disabled. No actual capital or market fills occur.
          </p>
        </div>
      </div>

      {/* Workspace Grid */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Simulation Controls (5 cols) */}
        <div className="space-y-5 lg:col-span-5">
          <div className="rounded-[var(--sl-radius-lg)] border border-sl-border bg-sl-surface p-4 shadow-sm">
            <h2 className="flex items-center gap-2 font-medium text-sl-text">
              <Sliders className="size-4 text-sl-accent" /> Simulation Parameters
            </h2>

            <div className="mt-4 space-y-4 text-xs">
              {/* API Key Selection */}
              <div>
                <label className="block font-medium text-sl-text">API Key</label>
                <p className="mt-0.5 text-[11px] text-sl-text-subtle">
                  Simulations are metered against this key&apos;s available USDT credit balance.
                </p>

                {keys.length > 0 ? (
                  <select
                    value={String(selectedKeyId)}
                    onChange={(e) => setSelectedKeyId(e.target.value === "custom" ? "custom" : Number(e.target.value))}
                    className="mt-1.5 h-8 w-full rounded border border-sl-border bg-sl-bg px-2 font-mono text-xs text-sl-text focus:border-sl-accent focus:outline-none"
                  >
                    {keys.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.label} ({k.hint}) · ${k.balanceUsdt.toFixed(4)} USDT
                      </option>
                    ))}
                    <option value="custom">Enter custom API key…</option>
                  </select>
                ) : (
                  <div className="mt-1.5">
                    <input
                      type="password"
                      placeholder="sk_live_..."
                      value={customKey}
                      onChange={(e) => setCustomKey(e.target.value)}
                      className="h-8 w-full rounded border border-sl-border bg-sl-bg px-2 font-mono text-xs text-sl-text placeholder:text-sl-text-subtle focus:border-sl-accent focus:outline-none"
                    />
                  </div>
                )}

                {selectedKeyId === "custom" && keys.length > 0 && (
                  <input
                    type="password"
                    placeholder="sk_live_..."
                    value={customKey}
                    onChange={(e) => setCustomKey(e.target.value)}
                    className="mt-2 h-8 w-full rounded border border-sl-border bg-sl-bg px-2 font-mono text-xs text-sl-text placeholder:text-sl-text-subtle focus:border-sl-accent focus:outline-none"
                  />
                )}

                {selectedKey && (
                  <div className="mt-2 flex items-center justify-between rounded bg-sl-bg px-2.5 py-1.5 text-[11px]">
                    <span className="text-sl-text-muted">Available Key Balance:</span>
                    <span className={`font-mono font-medium ${isUnfunded ? "text-sl-warn" : "text-sl-accent"}`}>
                      ${selectedKey.balanceUsdt.toFixed(4)} USDT
                    </span>
                  </div>
                )}

                {isUnfunded && (
                  <div className="mt-2 flex items-center justify-between rounded border border-sl-warn/30 bg-sl-warn-soft p-2 text-[11px] text-sl-text">
                    <span className="flex items-center gap-1.5 text-sl-warn">
                      <AlertTriangle className="size-3.5" /> Insufficient credits for $0.05 run
                    </span>
                    <Link href="/billing/add" className="font-semibold text-sl-accent hover:underline">
                      Add Credits →
                    </Link>
                  </div>
                )}
              </div>

              {/* Instrument Selection */}
              <div>
                <label className="block font-medium text-sl-text">Instrument</label>
                <p className="mt-0.5 text-[11px] text-sl-text-subtle">
                  Supported instruments from canonical capability discovery.
                </p>
                <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                  {discovery.supported_instruments.map((inst) => {
                    const active = instrumentId === inst;
                    return (
                      <button
                        key={inst}
                        type="button"
                        onClick={() => setInstrumentId(inst)}
                        className={`flex flex-col items-start rounded border px-2.5 py-2 text-left transition-colors ${
                          active
                            ? "border-sl-accent bg-sl-accent-soft text-sl-text"
                            : "border-sl-border bg-sl-bg text-sl-text-muted hover:border-sl-border-strong"
                        }`}
                      >
                        <span className="font-mono text-[11px] font-semibold">{inst.split(":")[1] || inst}</span>
                        <span className="text-[10px] text-sl-text-subtle">{inst.split(":")[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Strategy Selection */}
              <div>
                <label className="block font-medium text-sl-text">Strategy</label>
                <select
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value)}
                  className="mt-1.5 h-8 w-full rounded border border-sl-border bg-sl-bg px-2 font-mono text-xs text-sl-text focus:border-sl-accent focus:outline-none"
                >
                  {discovery.supported_strategies.map((strat) => (
                    <option key={strat} value={strat}>
                      {strat} (Moving Average Crossover)
                    </option>
                  ))}
                </select>
              </div>

              {/* Strategy Parameters (Fast & Slow periods) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-sl-text">Fast Period</label>
                  <input
                    type="number"
                    min={2}
                    max={50}
                    value={fastPeriod}
                    onChange={(e) => setFastPeriod(Number(e.target.value))}
                    className="mt-1.5 h-8 w-full rounded border border-sl-border bg-sl-bg px-2 font-mono text-xs text-sl-text focus:border-sl-accent focus:outline-none"
                  />
                  <span className="text-[10px] text-sl-text-subtle">Default: 3</span>
                </div>
                <div>
                  <label className="block font-medium text-sl-text">Slow Period</label>
                  <input
                    type="number"
                    min={3}
                    max={200}
                    value={slowPeriod}
                    onChange={(e) => setSlowPeriod(Number(e.target.value))}
                    className="mt-1.5 h-8 w-full rounded border border-sl-border bg-sl-bg px-2 font-mono text-xs text-sl-text focus:border-sl-accent focus:outline-none"
                  />
                  <span className="text-[10px] text-sl-text-subtle">Default: 5</span>
                </div>
              </div>

              {/* Order Quantity */}
              <div>
                <label className="block font-medium text-sl-text">Order Quantity</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={orderQuantity}
                  onChange={(e) => setOrderQuantity(Number(e.target.value))}
                  className="mt-1.5 h-8 w-full rounded border border-sl-border bg-sl-bg px-2 font-mono text-xs text-sl-text focus:border-sl-accent focus:outline-none"
                />
              </div>

              {/* Idempotency Key */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="font-medium text-sl-text">Idempotency Key</label>
                  <button
                    type="button"
                    onClick={() => setIdempotencyKey(generateIdempotencyKey())}
                    className="flex items-center gap-1 text-[11px] text-sl-accent hover:underline"
                    title="Generate a new key"
                  >
                    <RefreshCw className="size-3" /> New Key
                  </button>
                </div>
                <input
                  type="text"
                  value={idempotencyKey}
                  onChange={(e) => setIdempotencyKey(e.target.value)}
                  className="mt-1.5 h-8 w-full rounded border border-sl-border bg-sl-bg px-2 font-mono text-xs text-sl-text focus:border-sl-accent focus:outline-none"
                />
                <p className="mt-1 text-[10px] text-sl-text-subtle">
                  Prevents accidental duplicate charges. Retrying with this key replays cached output at $0.00 extra cost.
                </p>
              </div>

              {/* Preflight Pricing Box */}
              <div className="rounded border border-sl-border bg-sl-bg p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-sl-text-muted">Estimated Simulation Charge:</span>
                  <span className="font-mono font-semibold text-sl-accent">${discovery.price_usdt.toFixed(2)} USDT</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-sl-text-subtle">
                  <span>Billing Timing:</span>
                  <span>Charged upon successful execution only</span>
                </div>
              </div>

              {/* Run CTA Button */}
              <button
                type="button"
                disabled={isExecuting}
                onClick={() => setIsConfirming(true)}
                className="flex h-9 w-full items-center justify-center gap-2 rounded bg-sl-accent px-4 text-xs font-semibold text-sl-accent-ink hover:bg-sl-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isExecuting ? (
                  <>
                    <RefreshCw className="size-4 animate-spin" /> Executing Simulation…
                  </>
                ) : (
                  <>
                    <PlayCircle className="size-4" /> Run Paper Simulation ($0.05 USDT)
                  </>
                )}
              </button>
            </div>
          </div>

          {/* cURL Snippet Panel */}
          <div className="rounded-[var(--sl-radius-lg)] border border-sl-border bg-sl-surface p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-medium text-sl-text">
                <Terminal className="size-3.5 text-sl-text-muted" /> Equivalent cURL Request
              </span>
              <button
                type="button"
                onClick={copyCurl}
                className="flex items-center gap-1 text-[11px] text-sl-text-muted hover:text-sl-text"
              >
                {copied ? <Check className="size-3 text-sl-accent" /> : <Copy className="size-3" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <pre tabIndex={0} className="mt-2.5 overflow-x-auto rounded border border-sl-border bg-sl-bg p-2.5 font-mono text-[11px] leading-relaxed text-sl-text-muted">
              {curlCommand}
            </pre>
          </div>
        </div>

        {/* Right Column: Execution Results & Inspectors (7 cols) */}
        <div className="space-y-5 lg:col-span-7">
          {/* Progress / Loading State */}
          {isExecuting && (
            <div className="rounded-[var(--sl-radius-lg)] border border-sl-border bg-sl-surface p-6 text-center">
              <RefreshCw className="mx-auto size-8 animate-spin text-sl-accent" />
              <h3 className="mt-3 font-medium text-sl-text">Executing Deterministic Paper Simulation</h3>
              <p className="mt-1 font-mono text-xs text-sl-text-muted">{stepStatus}</p>
              <div className="mx-auto mt-4 max-w-sm rounded border border-sl-border bg-sl-bg p-3 text-left text-[11px] text-sl-text-subtle">
                <div className="flex items-center gap-2 text-sl-text">
                  <span className="size-1.5 rounded-full bg-sl-accent animate-pulse" />
                  <span>Pipeline: Market Data Snapshot → Strategy Engine → Risk Gate → Paper Broker</span>
                </div>
              </div>
            </div>
          )}

          {/* Error / 402 / 422 State */}
          {!isExecuting && error && (
            <div className="rounded-[var(--sl-radius-lg)] border border-sl-down/40 bg-sl-surface p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 size-5 text-sl-down" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-sl-down/10 px-2 py-0.5 font-mono text-xs font-semibold text-sl-down">
                      HTTP {error.status}
                    </span>
                    <span className="font-mono text-xs font-medium text-sl-text">{error.code || "execution_failed"}</span>
                  </div>
                  <p className="text-sm text-sl-text">{error.message}</p>

                  {error.status === 402 && (
                    <div className="mt-3 rounded border border-sl-border bg-sl-bg p-3 text-xs">
                      <p className="font-medium text-sl-text">How to fund this call ($0.05 USDT):</p>
                      <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sl-text-muted">
                        <li>
                          Deposit USDT on Polygon to your account wallet address. Credits apply automatically.
                        </li>
                        <li>
                          Use the x402 protocol rail with USDC on Base for autonomous AI agent invocations.
                        </li>
                      </ul>
                      <div className="mt-3">
                        <Link
                          href="/billing/add"
                          className="inline-flex h-7 items-center gap-1.5 rounded bg-sl-accent px-3 text-xs font-semibold text-sl-accent-ink hover:bg-sl-accent-strong"
                        >
                          Add Credits on Billing Page <ArrowRight className="size-3" />
                        </Link>
                      </div>
                    </div>
                  )}

                  {error.code === "idempotency_payload_mismatch" && (
                    <div className="mt-2 rounded bg-sl-bg p-2.5 text-xs text-sl-text-muted">
                      <p>
                        This idempotency key was previously executed with different parameters. To change parameters,
                        click <strong>New Key</strong> above.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Success State */}
          {!isExecuting && result && (
            <div className="space-y-4 rounded-[var(--sl-radius-lg)] border border-sl-border bg-sl-surface p-5 shadow-sm">
              {/* Result Status Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sl-border pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-sl-accent" />
                  <span className="font-mono text-xs font-bold text-sl-text">
                    {result.simulation?.status || "COMPLETED"}
                  </span>
                  <span className="rounded bg-sl-accent-soft px-2 py-0.5 font-mono text-[11px] text-sl-accent">
                    Billed: ${result.billed_usdt?.toFixed(2) ?? "0.05"} USDT
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={handleRun}
                    className="flex items-center gap-1 text-sl-text-muted hover:text-sl-text"
                    title="Retry with same key to verify cached replay"
                  >
                    <RotateCcw className="size-3" /> Idempotent Replay
                  </button>
                  <span className="text-sl-border">|</span>
                  <button
                    type="button"
                    onClick={() => {
                      setIdempotencyKey(generateIdempotencyKey());
                      setResult(null);
                    }}
                    className="flex items-center gap-1 text-sl-accent hover:underline"
                  >
                    <PlayCircle className="size-3" /> New Run
                  </button>
                </div>
              </div>

              {/* Result View Tabs */}
              <div className="flex items-center gap-1 border-b border-sl-border text-xs">
                {(["overview", "signals", "risk", "settlement", "json"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setViewTab(tab)}
                    className={`border-b-2 px-3 py-1.5 capitalize transition-colors ${
                      viewTab === tab
                        ? "border-sl-accent font-medium text-sl-text"
                        : "border-transparent text-sl-text-muted hover:text-sl-text"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Tab 1: Overview */}
              {viewTab === "overview" && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded border border-sl-border bg-sl-bg p-2.5">
                      <span className="text-[10px] text-sl-text-subtle">Workflow ID</span>
                      <p className="mt-1 truncate font-mono text-xs font-medium text-sl-text" title={result.simulation?.workflow_id}>
                        {result.simulation?.workflow_id?.slice(0, 14)}…
                      </p>
                    </div>
                    <div className="rounded border border-sl-border bg-sl-bg p-2.5">
                      <span className="text-[10px] text-sl-text-subtle">Instrument</span>
                      <p className="mt-1 font-mono text-xs font-medium text-sl-text">{result.instrument_id}</p>
                    </div>
                    <div className="rounded border border-sl-border bg-sl-bg p-2.5">
                      <span className="text-[10px] text-sl-text-subtle">Signal</span>
                      <p className="mt-1 font-mono text-xs font-bold text-sl-accent">
                        {result.simulation?.model_proposal?.signal || "—"}
                      </p>
                    </div>
                    <div className="rounded border border-sl-border bg-sl-bg p-2.5">
                      <span className="text-[10px] text-sl-text-subtle">Receipt ID</span>
                      <p className="mt-1 truncate font-mono text-xs text-sl-text" title={result.revenue_receipt?.revenue_request_id || result.simulation?.financial_settlement?.revenueRequestId}>
                        {result.revenue_receipt?.revenue_request_id ? result.revenue_receipt.revenue_request_id.slice(0, 14) + "…" : result.simulation?.financial_settlement?.revenueRequestId ? result.simulation.financial_settlement.revenueRequestId.slice(0, 14) + "…" : "recorded"}
                      </p>
                    </div>
                  </div>

                  <div className="rounded border border-sl-border bg-sl-bg p-3">
                    <p className="font-medium text-sl-text">Simulated Order Execution Fill</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 text-[11px]">
                      <div>
                        <span className="text-sl-text-subtle">Order ID:</span>
                        <p className="font-mono text-sl-text">{result.simulation?.order_execution?.order_id || "—"}</p>
                      </div>
                      <div>
                        <span className="text-sl-text-subtle">Side:</span>
                        <p className="font-mono font-medium text-sl-text">{result.simulation?.order_execution?.side || "—"}</p>
                      </div>
                      <div>
                        <span className="text-sl-text-subtle">Execution Price:</span>
                        <p className="font-mono text-sl-text">{result.simulation?.order_execution?.price || "—"}</p>
                      </div>
                      <div>
                        <span className="text-sl-text-subtle">Status:</span>
                        <span className="rounded bg-sl-accent-soft px-1.5 py-0.5 font-mono text-sl-accent">
                          {result.simulation?.order_execution?.status || "—"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded border border-sl-border bg-sl-bg p-3">
                    <p className="font-medium text-sl-text">Market Data Validation</p>
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-sl-text-muted">
                      <span>Source: <strong className="font-mono text-sl-text">{result.simulation?.market_data?.source || "—"}</strong></span>
                      <span>Freshness: <strong className="font-mono text-sl-text">{result.simulation?.market_data?.freshness || "—"}</strong></span>
                      <span>Licensing: <strong className={result.simulation?.market_data?.licensing_valid !== false ? "text-sl-accent" : "text-sl-down"}>{result.simulation?.market_data?.licensing_valid !== false ? "VALID" : "NOT_VALID"}</strong></span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Signals & Model Proposal */}
              {viewTab === "signals" && (
                <div className="space-y-3 text-xs">
                  <div className="rounded border border-sl-border bg-sl-bg p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sl-text">Model Signal Proposal</span>
                      <span className="rounded bg-sl-accent-soft px-2 py-0.5 font-mono font-semibold text-sl-accent">
                        {result.simulation?.model_proposal?.signal || "—"}{result.simulation?.model_proposal?.confidence != null ? ` (Confidence: ${result.simulation.model_proposal.confidence})` : ""}
                      </span>
                    </div>
                    <p className="mt-2 text-sl-text-muted">
                      {result.simulation?.model_proposal?.rationale || "No rationale provided."}
                    </p>
                    {result.simulation?.model_proposal?.risks && (
                      <div className="mt-3">
                        <span className="text-[11px] font-medium text-sl-text">Identified Risks:</span>
                        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-sl-text-muted">
                          {result.simulation.model_proposal.risks.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 3: Risk Authorization */}
              {viewTab === "risk" && (
                <div className="space-y-3 text-xs">
                  <div className="rounded border border-sl-border bg-sl-bg p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sl-text">Risk Authorization Engine</span>
                      <span className={`flex items-center gap-1 font-mono ${result.simulation?.risk_authorization?.authorized ? "text-sl-accent" : "text-sl-down"}`}>
                        <ShieldCheck className="size-4" /> {result.simulation?.risk_authorization?.authorized ? "AUTHORIZED" : "REJECTED"}
                      </span>
                    </div>
                    <p className="mt-1 text-sl-text-muted">
                      {result.simulation?.risk_authorization?.authorized
                        ? "Pre-trade risk checks passed according to mandated risk limits:"
                        : `Pre-trade risk check failed: ${result.simulation?.risk_authorization?.reason || result.simulation?.risk_authorization?.failed_gate || "Rejected"}`}
                    </p>
                    {result.simulation?.risk_authorization?.passed_gates && result.simulation.risk_authorization.passed_gates.length > 0 && (
                      <ul className="mt-2 space-y-1 font-mono text-[11px] text-sl-text">
                        {result.simulation.risk_authorization.passed_gates.map((g) => (
                          <li key={g} className="flex items-center gap-1.5 text-sl-accent">
                            <Check className="size-3.5" /> Gate passed: {g}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 4: Financial Settlement */}
              {viewTab === "settlement" && (
                <div className="space-y-3 text-xs">
                  <div className="rounded border border-sl-border bg-sl-bg p-3">
                    <p className="font-medium text-sl-text">Authoritative Billing Receipt</p>
                    <div className="mt-2 space-y-1.5 font-mono text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-sl-text-muted">Revenue Request ID:</span>
                        <span className="text-sl-text">{result.revenue_receipt?.revenue_request_id || result.simulation?.financial_settlement?.revenueRequestId || "—"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sl-text-muted">Metered Charge:</span>
                        <span className="text-sl-accent">${(result.billed_usdt ?? result.price_usdt ?? 0.05).toFixed(4)} USDT</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sl-text-muted">Ledger Recording:</span>
                        <span className={result.revenue_receipt?.recorded ? "text-sl-accent" : "text-sl-text-muted"}>
                          {result.revenue_receipt?.recorded ? "Financial OS Ledger (CONFIRMED)" : "Pending confirmation"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 5: Raw JSON */}
              {viewTab === "json" && (
                <div>
                  <pre tabIndex={0} className="max-h-96 overflow-auto rounded border border-sl-border bg-sl-bg p-3 font-mono text-[11px] text-sl-text-muted">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              )}

              {/* Mandatory Disclaimer on every Simulation Result */}
              <div className="mt-4 border-t border-sl-border pt-3">
                <p className="font-mono text-[11px] text-sl-text-subtle">
                  <span className="font-semibold text-sl-text">{result.disclaimer || "SIMULATED_PAPER_EXECUTION: NOT_ACTUAL_RETURNS"}</span> · Live broker execution remains disabled.
                </p>
              </div>
            </div>
          )}

          {/* Idle / Initial State Guide */}
          {!isExecuting && !result && !error && (
            <div className="rounded-[var(--sl-radius-lg)] border border-sl-border bg-sl-surface p-6">
              <h3 className="font-medium text-sl-text">Deterministic Simulation Engine Ready</h3>
              <p className="mt-1 text-xs text-sl-text-muted">
                Configure your strategy parameters on the left and click <strong>Run Paper Simulation</strong>.
                Each run evaluates live algorithmic pipelines against paper execution adapters.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 text-xs">
                <div className="rounded border border-sl-border bg-sl-bg p-3">
                  <span className="font-medium text-sl-text">1. Pure Simulation</span>
                  <p className="mt-1 text-[11px] text-sl-text-muted">
                    Zero live market fills. Validates signal consensus, moving average crossovers, and risk limits in a controlled sandbox.
                  </p>
                </div>
                <div className="rounded border border-sl-border bg-sl-bg p-3">
                  <span className="font-medium text-sl-text">2. Metered Truth</span>
                  <p className="mt-1 text-[11px] text-sl-text-muted">
                    Charges are processed through canonical api_credits. Precheck failures (402/422) never incur deductions.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {isConfirming && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
        >
          <div className="w-full max-w-md rounded-[var(--sl-radius-lg)] border border-sl-border bg-sl-surface p-6 shadow-2xl">
            <h3 className="font-sl-display text-lg font-medium text-sl-text">Confirm Paper Simulation Run</h3>
            <p className="mt-2 text-xs leading-relaxed text-sl-text-muted">
              You are about to execute a simulated trading run for{" "}
              <strong className="text-sl-text">{instrumentId}</strong> with the{" "}
              <strong className="text-sl-text">{strategy}</strong> strategy.
            </p>

            <div className="mt-4 space-y-2 rounded border border-sl-border bg-sl-bg p-3 text-xs">
              <div className="flex justify-between">
                <span className="text-sl-text-muted">Execution Mode:</span>
                <span className="font-mono text-sl-text">SIMULATED_PAPER_EXECUTION</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sl-text-muted">Authoritative Fee:</span>
                <span className="font-mono font-semibold text-sl-accent">${discovery.price_usdt.toFixed(2)} USDT</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sl-text-muted">Idempotency Key:</span>
                <span className="truncate font-mono text-[11px] text-sl-text-muted">{idempotencyKey}</span>
              </div>
            </div>

            <p className="mt-3 font-mono text-[10px] text-sl-text-subtle">
              SIMULATED_PAPER_EXECUTION: NOT_ACTUAL_RETURNS · Live broker execution remains disabled.
            </p>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsConfirming(false)}
                className="h-8 rounded border border-sl-border px-3 text-xs font-medium text-sl-text-muted hover:text-sl-text"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRun}
                className="h-8 rounded bg-sl-accent px-4 text-xs font-semibold text-sl-accent-ink hover:bg-sl-accent-strong"
              >
                Confirm &amp; Execute ($0.05)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Code2Icon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m18 16 4-4-4-4" />
      <path d="m6 8-4 4 4 4" />
      <path d="m14.5 4-5 16" />
    </svg>
  );
}
