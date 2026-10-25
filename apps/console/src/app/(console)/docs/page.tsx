import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpen,
  DollarSign,
  ExternalLink,
  PlayCircle,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { loadTradingDiscovery } from "@/lib/trading";

export const metadata: Metadata = {
  title: "Documentation · Satelink Trading AI",
  description: "Getting started, paper simulation quickstart, API reference, pricing, and error handling for Satelink Trading AI.",
};

export const dynamic = "force-dynamic";

export default async function DocsPage() {
  const discovery = await loadTradingDiscovery();

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-12">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="font-sl-display text-2xl font-medium tracking-tight text-sl-text">Documentation</h1>
          <span className="rounded bg-sl-surface-hover px-2 py-0.5 font-mono text-[11px] text-sl-text-muted">
            Developer Reference
          </span>
        </div>
        <p className="mt-1 text-sm text-sl-text-muted">
          Comprehensive guides for integrating Satelink Trading AI into algorithmic bots, backtesting systems, and autonomous AI agents.
        </p>
      </div>

      {/* Mandatory Disclaimer */}
      <div className="flex items-start gap-3 rounded-md border border-sl-border bg-sl-surface p-3 text-xs text-sl-text-muted">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-sl-accent" />
        <div className="space-y-1">
          <p className="font-mono font-medium text-sl-text">{discovery.disclaimer}</p>
          <p>
            Simulated paper execution only. Live broker execution remains disabled across all endpoints. No actual trades are executed on live financial exchanges.
          </p>
        </div>
      </div>

      {/* Navigation Quick Links */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <a
          href="#getting-started"
          className="rounded-[var(--sl-radius)] border border-sl-border bg-sl-surface p-3 text-xs transition-colors hover:border-sl-border-strong"
        >
          <span className="font-medium text-sl-text">1. Getting Started</span>
          <p className="mt-1 text-[11px] text-sl-text-muted">Core concepts &amp; account setup.</p>
        </a>
        <a
          href="#quickstart"
          className="rounded-[var(--sl-radius)] border border-sl-border bg-sl-surface p-3 text-xs transition-colors hover:border-sl-border-strong"
        >
          <span className="font-medium text-sl-text">2. Paper Simulation Quickstart</span>
          <p className="mt-1 text-[11px] text-sl-text-muted">Run your first simulation in 4 steps.</p>
        </a>
        <a
          href="#pricing"
          className="rounded-[var(--sl-radius)] border border-sl-border bg-sl-surface p-3 text-xs transition-colors hover:border-sl-border-strong"
        >
          <span className="font-medium text-sl-text">3. Pricing &amp; Metering</span>
          <p className="mt-1 text-[11px] text-sl-text-muted">$0.05 USDT / run &amp; funding rails.</p>
        </a>
        <a
          href="#errors"
          className="rounded-[var(--sl-radius)] border border-sl-border bg-sl-surface p-3 text-xs transition-colors hover:border-sl-border-strong"
        >
          <span className="font-medium text-sl-text">4. Errors &amp; Idempotency</span>
          <p className="mt-1 text-[11px] text-sl-text-muted">HTTP status codes &amp; safe retries.</p>
        </a>
      </div>

      {/* Section 1: Getting Started */}
      <section id="getting-started" className="rounded-[var(--sl-radius-lg)] border border-sl-border bg-sl-surface p-6 shadow-sm space-y-4">
        <h2 className="flex items-center gap-2 font-sl-display text-xl text-sl-text">
          <BookOpen className="size-5 text-sl-accent" /> 1. Getting Started
        </h2>
        <p className="text-sm leading-relaxed text-sl-text-muted">
          Satelink Trading AI provides a developer-first execution simulation API. Quantitative researchers, bot builders, and AI agents can invoke full lifecycle simulations—including market data snapshot retrieval, baseline algorithmic evaluation (such as Moving Average Crossovers), model signal proposals, pre-trade risk authorization gates, and paper order settlement.
        </p>

        <div className="grid gap-3 sm:grid-cols-3 pt-2 text-xs">
          <div className="rounded border border-sl-border bg-sl-bg p-3">
            <span className="font-semibold text-sl-text">1. Create API Key</span>
            <p className="mt-1 text-sl-text-muted">Generate a key on the <Link href="/developers" className="text-sl-accent underline">Developers</Link> page. Key secrets are shown once.</p>
          </div>
          <div className="rounded border border-sl-border bg-sl-bg p-3">
            <span className="font-semibold text-sl-text">2. Fund with USDT</span>
            <p className="mt-1 text-sl-text-muted">Deposit USDT on Polygon to your account wallet address or use x402 on Base.</p>
          </div>
          <div className="rounded border border-sl-border bg-sl-bg p-3">
            <span className="font-semibold text-sl-text">3. Execute &amp; Inspect</span>
            <p className="mt-1 text-sl-text-muted">Call the simulation endpoint and receive fills, metrics, and receipts.</p>
          </div>
        </div>
      </section>

      {/* Section 2: Paper Simulation Quickstart */}
      <section id="quickstart" className="rounded-[var(--sl-radius-lg)] border border-sl-border bg-sl-surface p-6 shadow-sm space-y-4">
        <h2 className="flex items-center gap-2 font-sl-display text-xl text-sl-text">
          <PlayCircle className="size-5 text-sl-accent" /> 2. Paper Simulation Quickstart
        </h2>
        <p className="text-sm leading-relaxed text-sl-text-muted">
          Execute a deterministic paper trading simulation against real simulated pipelines in four simple steps:
        </p>

        <div className="space-y-4 pt-2">
          {/* Step 1 */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-sl-text">Step 1: Check Capability Discovery (Zero Auth)</h3>
            <p className="text-xs text-sl-text-muted">
              Inspect currently active instruments, strategies, and the published unit price:
            </p>
            <pre tabIndex={0} className="overflow-x-auto rounded border border-sl-border bg-sl-bg p-3 font-mono text-[11px] text-sl-text-muted">
              curl -X GET https://api.satelink.network/v1/trading/paper/simulate
            </pre>
          </div>

          {/* Step 2 */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-sl-text">Step 2: Submit a Simulation Request</h3>
            <p className="text-xs text-sl-text-muted">
              Pass your API key and a unique idempotency key with target parameters:
            </p>
            <pre tabIndex={0} className="overflow-x-auto rounded border border-sl-border bg-sl-bg p-3 font-mono text-[11px] text-sl-text-muted leading-relaxed">
{`curl -X POST https://api.satelink.network/v1/trading/paper/simulate \\
  -H "X-API-Key: $SATELINK_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "idempotencyKey": "sim_quickstart_001",
    "instrumentId": "BINANCE:BTCUSDT",
    "strategy": "sma-crossover",
    "strategyParams": {
      "fastPeriod": 3,
      "slowPeriod": 5
    },
    "orderQuantity": 1
  }'`}
            </pre>
          </div>

          {/* Step 3 */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-sl-text">Step 3: Verify Results &amp; Revenue Receipt</h3>
            <p className="text-xs text-sl-text-muted">
              A successful simulation returns an authoritative Financial OS revenue receipt and comprehensive execution report:
            </p>
            <pre tabIndex={0} className="overflow-x-auto rounded border border-sl-border bg-sl-bg p-3 font-mono text-[11px] text-sl-text-muted leading-relaxed">
{`{
  "ok": true,
  "disclaimer": "SIMULATED_PAPER_EXECUTION: NOT_ACTUAL_RETURNS",
  "service": "Satelink Multi-Market Trading AI",
  "billed_usdt": 0.05,
  "price_usdt": 0.05,
  "idempotency_key": "sim_quickstart_001",
  "revenue_receipt": {
    "revenue_request_id": "sim:key_...:17298...",
    "amount_usdt": 0.05,
    "recorded": true
  },
  "simulation": {
    "status": "COMPLETED",
    "order_execution": { "side": "BUY", "status": "FILLED" },
    "risk_authorization": { "authorized": true }
  }
}`}
            </pre>
          </div>
        </div>
      </section>

      {/* Section 3: Pricing & Metering */}
      <section id="pricing" className="rounded-[var(--sl-radius-lg)] border border-sl-border bg-sl-surface p-6 shadow-sm space-y-4">
        <h2 className="flex items-center gap-2 font-sl-display text-xl text-sl-text">
          <DollarSign className="size-5 text-sl-accent" /> 3. Pricing &amp; Billing Rules
        </h2>
        <div className="space-y-3 text-xs leading-relaxed text-sl-text-muted">
          <p>
            Satelink enforces truthful, meter-backed pricing. All costs are derived from canonical plan catalog definitions:
          </p>
          <div className="rounded border border-sl-border bg-sl-bg p-3 font-mono">
            <div className="flex justify-between py-1 border-b border-sl-border">
              <span>Paper Simulation Unit Price</span>
              <span className="font-semibold text-sl-accent">${discovery.price_usdt.toFixed(2)} USDT / successful call</span>
            </div>
            <div className="flex justify-between py-1 border-b border-sl-border">
              <span>Metering Unit (UU)</span>
              <span>50 UU (1 UU = $0.001 list value)</span>
            </div>
            <div className="flex justify-between py-1">
              <span>Precheck Rule</span>
              <span>Balance must be &gt;= $0.05 USDT; failed precheck (402/422) is never charged</span>
            </div>
          </div>

          <h4 className="font-medium text-sl-text pt-2">Supported Funding Rails:</h4>
          <ul className="list-disc pl-4 space-y-1">
            <li>
              <strong>USDT on Polygon (Proof of Stake):</strong> Deposit USDT to your account deposit address. Transactions are monitored and credited automatically upon on-chain confirmation.
            </li>
            <li>
              <strong>x402 Protocol (Base USDC):</strong> Autonomous agents can execute micropayments per call on the x402 rail with zero upfront registration required.
            </li>
          </ul>
        </div>
      </section>

      {/* Section 4: Errors & Idempotency */}
      <section id="errors" className="rounded-[var(--sl-radius-lg)] border border-sl-border bg-sl-surface p-6 shadow-sm space-y-4">
        <h2 className="flex items-center gap-2 font-sl-display text-xl text-sl-text">
          <RefreshCw className="size-5 text-sl-accent" /> 4. Errors &amp; Idempotency
        </h2>
        <p className="text-sm leading-relaxed text-sl-text-muted">
          All endpoints implement strict error semantics and durable idempotency:
        </p>

        <div className="space-y-3 text-xs">
          <div className="rounded border border-sl-border bg-sl-bg p-3 font-mono">
            <span className="font-semibold text-sl-warn">HTTP 402 Payment Required</span>
            <p className="mt-1 font-sans text-sl-text-muted">
              Returned when no API key is provided, or when the key balance has insufficient credits (&lt; $0.05 USDT). Carries payment rail guidance in the response payload.
            </p>
          </div>

          <div className="rounded border border-sl-border bg-sl-bg p-3 font-mono">
            <span className="font-semibold text-sl-down">HTTP 422 Unprocessable Entity</span>
            <p className="mt-1 font-sans text-sl-text-muted">
              Returned for validation errors:
              <br />• <code>missing_idempotency_key</code>: Key missing or &lt; 4 characters.
              <br />• <code>unsupported_instrument</code>: Instrument not in canonical catalog.
              <br />• <code>idempotency_payload_mismatch</code>: The idempotency key was previously used with different parameters.
            </p>
          </div>

          <div className="rounded border border-sl-border bg-sl-bg p-3 font-mono">
            <span className="font-semibold text-sl-text-subtle">HTTP 503 Service Unavailable</span>
            <p className="mt-1 font-sans text-sl-text-muted">
              Returned if the simulation runtime is warming up or an upstream data provider is momentarily unreachable. Safe to retry with the same idempotency key.
            </p>
          </div>
        </div>
      </section>

      {/* External Links */}
      <section className="rounded-[var(--sl-radius-lg)] border border-sl-border bg-sl-surface p-5 shadow-sm">
        <h3 className="font-medium text-sl-text">External Specifications &amp; Live References</h3>
        <p className="mt-1 text-xs text-sl-text-muted">
          Access complete OpenAPI definitions and machine-readable manifests:
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          <a
            href="https://satelink.network/docs"
            target="_blank"
            rel="noopener"
            className="flex items-center gap-1.5 rounded border border-sl-border bg-sl-bg px-3 py-1.5 text-sl-text hover:border-sl-border-strong font-mono text-[11px]"
          >
            Public Docs (satelink.network/docs) <ExternalLink className="size-3 text-sl-text-subtle" />
          </a>
          <a
            href="https://api.satelink.network/.well-known/satelink.json"
            target="_blank"
            rel="noopener"
            className="flex items-center gap-1.5 rounded border border-sl-border bg-sl-bg px-3 py-1.5 text-sl-text hover:border-sl-border-strong font-mono text-[11px]"
          >
            /.well-known/satelink.json <ExternalLink className="size-3 text-sl-text-subtle" />
          </a>
          <a
            href="https://api.satelink.network/openapi.json"
            target="_blank"
            rel="noopener"
            className="flex items-center gap-1.5 rounded border border-sl-border bg-sl-bg px-3 py-1.5 text-sl-text hover:border-sl-border-strong font-mono text-[11px]"
          >
            /openapi.json <ExternalLink className="size-3 text-sl-text-subtle" />
          </a>
        </div>
      </section>
    </div>
  );
}
