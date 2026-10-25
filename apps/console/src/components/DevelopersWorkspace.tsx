"use client";

import { useState } from "react";
import {
  Check,
  Code2,
  Copy,
  ExternalLink,
  FileCode,
  KeyRound,
  Lock,
  RefreshCw,
  Terminal,
} from "lucide-react";
import type { TradingDiscovery } from "@/lib/trading";

type Props = {
  discovery: TradingDiscovery;
  keyManagementSlot: React.ReactNode;
};

const PYTHON_SNIPPET = `import os
import requests

API_BASE = "https://api.satelink.network"
API_KEY = os.environ.get("SATELINK_API_KEY")

# 1. Discover capabilities and verify real-time price ($0.05 USDT)
discovery = requests.get(f"{API_BASE}/v1/trading/paper/simulate").json()
print("Discovery:", discovery["service"], f"- \${discovery['price_usdt']} {discovery['currency']}")

# 2. Execute a metered paper trading simulation
payload = {
    "idempotencyKey": "agent_sim_001",
    "instrumentId": "BINANCE:BTCUSDT",
    "strategy": "sma-crossover",
    "strategyParams": {
        "fastPeriod": 3,
        "slowPeriod": 5
    },
    "orderQuantity": 1
}

res = requests.post(
    f"{API_BASE}/v1/trading/paper/simulate",
    headers={
        "X-API-Key": API_KEY,
        "Content-Type": "application/json"
    },
    json=payload
)

if res.status_code == 200:
    data = res.json()
    print("Simulation status:", data["simulation"]["status"])
    print("Receipt ID:", data["revenue_receipt"]["revenue_request_id"])
    print("Model signal:", data["simulation"]["model_proposal"]["signal"])
elif res.status_code == 402:
    print("Payment required: deposit USDT or use x402 rail to fund simulation.")
else:
    print(f"Error {res.status_code}:", res.json())
`;

const AGENT_TOOL_DEFINITION = `{
  "type": "function",
  "function": {
    "name": "run_paper_trading_simulation",
    "description": "Execute a metered multi-market algorithmic trading simulation on Satelink ($0.05 USDT). Live broker execution is disabled.",
    "parameters": {
      "type": "object",
      "properties": {
        "idempotencyKey": {
          "type": "string",
          "description": "Unique key (min 4 chars) to safely retry simulations without duplicate billing."
        },
        "instrumentId": {
          "type": "string",
          "enum": ["BINANCE:BTCUSDT", "PAPER:BTCUSDT", "NSE:NIFTY50"],
          "description": "The target trading instrument."
        },
        "strategy": {
          "type": "string",
          "enum": ["sma-crossover"],
          "description": "The algorithmic strategy to simulate."
        },
        "strategyParams": {
          "type": "object",
          "properties": {
            "fastPeriod": { "type": "number", "default": 3 },
            "slowPeriod": { "type": "number", "default": 5 }
          }
        },
        "orderQuantity": {
          "type": "number",
          "default": 1
        }
      },
      "required": ["idempotencyKey", "instrumentId", "strategy"]
    }
  }
}`;

export function DevelopersWorkspace({ discovery, keyManagementSlot }: Props) {
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  const copy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedSnippet(id);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-sl-display text-2xl font-medium tracking-tight text-sl-text">API &amp; Developers</h1>
        <p className="mt-1 text-sm text-sl-text-muted">
          Manage your API credentials, explore schemas, and integrate paper trading simulations into your quantitative bots and AI agents (${discovery.price_usdt.toFixed(2)} {discovery.currency} / run).
        </p>
      </div>

      {/* Section 1: API Key Management */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-medium text-sl-text">
          <KeyRound className="size-4 text-sl-accent" /> API Credentials
        </h2>
        {keyManagementSlot}
      </section>

      {/* Section 2: Quickstart curl Examples */}
      <section className="space-y-4">
        <h2 className="flex items-center gap-2 font-medium text-sl-text">
          <Terminal className="size-4 text-sl-accent" /> cURL Request Examples
        </h2>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Discovery curl */}
          <div className="rounded-[var(--sl-radius-lg)] border border-sl-border bg-sl-surface p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium text-sl-text">1. Public Capability Discovery</span>
                <p className="text-[11px] text-sl-text-subtle">Free endpoint, zero authentication required.</p>
              </div>
              <button
                type="button"
                onClick={() => copy("curl -X GET https://api.satelink.network/v1/trading/paper/simulate", "curl_disco")}
                className="flex items-center gap-1 text-[11px] text-sl-text-muted hover:text-sl-text"
              >
                {copiedSnippet === "curl_disco" ? <Check className="size-3 text-sl-accent" /> : <Copy className="size-3" />}
                {copiedSnippet === "curl_disco" ? "Copied" : "Copy"}
              </button>
            </div>
            <pre tabIndex={0} className="mt-3 overflow-x-auto rounded border border-sl-border bg-sl-bg p-3 font-mono text-[11px] leading-relaxed text-sl-text-muted">
              {`curl -X GET https://api.satelink.network/v1/trading/paper/simulate`}
            </pre>
          </div>

          {/* Simulation curl */}
          <div className="rounded-[var(--sl-radius-lg)] border border-sl-border bg-sl-surface p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium text-sl-text">2. Metered Paper Simulation</span>
                <p className="text-[11px] text-sl-text-subtle">$0.05 USDT / run, requires API key with credits.</p>
              </div>
              <button
                type="button"
                onClick={() =>
                  copy(
                    `curl -X POST https://api.satelink.network/v1/trading/paper/simulate \\\n  -H "X-API-Key: $SATELINK_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"idempotencyKey":"sim_001","instrumentId":"BINANCE:BTCUSDT","strategy":"sma-crossover","strategyParams":{"fastPeriod":3,"slowPeriod":5},"orderQuantity":1}'`,
                    "curl_sim",
                  )
                }
                className="flex items-center gap-1 text-[11px] text-sl-text-muted hover:text-sl-text"
              >
                {copiedSnippet === "curl_sim" ? <Check className="size-3 text-sl-accent" /> : <Copy className="size-3" />}
                {copiedSnippet === "curl_sim" ? "Copied" : "Copy"}
              </button>
            </div>
            <pre tabIndex={0} className="mt-3 overflow-x-auto rounded border border-sl-border bg-sl-bg p-3 font-mono text-[11px] leading-relaxed text-sl-text-muted">
{`curl -X POST https://api.satelink.network/v1/trading/paper/simulate \\
  -H "X-API-Key: $SATELINK_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "idempotencyKey": "sim_001",
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
        </div>
      </section>

      {/* Section 3: Authentication & Idempotency Guidance */}
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[var(--sl-radius-lg)] border border-sl-border bg-sl-surface p-4 shadow-sm">
          <h3 className="flex items-center gap-2 font-medium text-sl-text">
            <Lock className="size-4 text-sl-accent" /> Authentication
          </h3>
          <p className="mt-1 text-xs text-sl-text-muted leading-relaxed">
            Pass your API key in either of the following HTTP request headers:
          </p>
          <div className="mt-3 space-y-1.5 font-mono text-xs">
            <div className="rounded bg-sl-bg p-2 text-sl-text">
              <span className="text-sl-text-subtle">Header:</span> X-API-Key: sk_live_...
            </div>
            <div className="rounded bg-sl-bg p-2 text-sl-text">
              <span className="text-sl-text-subtle">Header:</span> Authorization: Bearer sk_live_...
            </div>
          </div>
          <p className="mt-3 text-[11px] text-sl-text-subtle">
            Never expose secret API keys in client-side applications. Use backend proxies or serverless functions.
          </p>
        </div>

        <div className="rounded-[var(--sl-radius-lg)] border border-sl-border bg-sl-surface p-4 shadow-sm">
          <h3 className="flex items-center gap-2 font-medium text-sl-text">
            <RefreshCw className="size-4 text-sl-accent" /> Idempotency Keys
          </h3>
          <p className="mt-1 text-xs text-sl-text-muted leading-relaxed">
            Every simulation request must include an <code className="font-mono text-sl-text">idempotencyKey</code> (&ge; 4 characters).
          </p>
          <ul className="mt-2 space-y-1 list-disc pl-4 text-xs text-sl-text-muted">
            <li>
              <strong>Safe Retries:</strong> Replaying the same key returns the cached execution result with zero additional charge.
            </li>
            <li>
              <strong>Conflict Protection:</strong> Reusing a key with altered parameters returns HTTP 422 (<code className="font-mono text-sl-text">idempotency_payload_mismatch</code>).
            </li>
          </ul>
        </div>
      </section>

      {/* Section 4: Request/Response Schema & Errors */}
      <section className="rounded-[var(--sl-radius-lg)] border border-sl-border bg-sl-surface p-5 shadow-sm space-y-4">
        <h2 className="flex items-center gap-2 font-medium text-sl-text">
          <FileCode className="size-4 text-sl-accent" /> Request Schema &amp; Status Codes
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-sl-border text-sl-text-muted">
                <th className="pb-2 font-medium">Parameter</th>
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium">Required</th>
                <th className="pb-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sl-border font-mono text-[11px]">
              <tr>
                <td className="py-2 text-sl-text">idempotencyKey</td>
                <td className="py-2 text-sl-text-muted">string</td>
                <td className="py-2 text-sl-accent">Yes</td>
                <td className="py-2 font-sans text-sl-text-muted">Unique idempotency identifier (&ge; 4 chars).</td>
              </tr>
              <tr>
                <td className="py-2 text-sl-text">instrumentId</td>
                <td className="py-2 text-sl-text-muted">string</td>
                <td className="py-2 text-sl-accent">Yes</td>
                <td className="py-2 font-sans text-sl-text-muted">One of: BINANCE:BTCUSDT, PAPER:BTCUSDT, NSE:NIFTY50.</td>
              </tr>
              <tr>
                <td className="py-2 text-sl-text">strategy</td>
                <td className="py-2 text-sl-text-muted">string</td>
                <td className="py-2 text-sl-accent">Yes</td>
                <td className="py-2 font-sans text-sl-text-muted">Supported strategy: sma-crossover.</td>
              </tr>
              <tr>
                <td className="py-2 text-sl-text">strategyParams</td>
                <td className="py-2 text-sl-text-muted">object</td>
                <td className="py-2 text-sl-text-subtle">No</td>
                <td className="py-2 font-sans text-sl-text-muted">Optional: &#123; fastPeriod: 3, slowPeriod: 5 &#125;.</td>
              </tr>
              <tr>
                <td className="py-2 text-sl-text">orderQuantity</td>
                <td className="py-2 text-sl-text-muted">number</td>
                <td className="py-2 text-sl-text-subtle">No</td>
                <td className="py-2 font-sans text-sl-text-muted">Simulated order quantity (default: 1).</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="pt-2 border-t border-sl-border">
          <h4 className="text-xs font-medium text-sl-text">HTTP Response Codes</h4>
          <div className="mt-2 grid gap-2 sm:grid-cols-4 text-xs font-mono">
            <div className="rounded border border-sl-border bg-sl-bg p-2">
              <span className="font-semibold text-sl-accent">200 OK</span>
              <p className="mt-1 font-sans text-[11px] text-sl-text-muted">Simulation completed with receipt and fills.</p>
            </div>
            <div className="rounded border border-sl-border bg-sl-bg p-2">
              <span className="font-semibold text-sl-warn">402 Payment Required</span>
              <p className="mt-1 font-sans text-[11px] text-sl-text-muted">Insufficient credits ($0.05 USDT / call required).</p>
            </div>
            <div className="rounded border border-sl-border bg-sl-bg p-2">
              <span className="font-semibold text-sl-down">422 Unprocessable</span>
              <p className="mt-1 font-sans text-[11px] text-sl-text-muted">Invalid parameters or idempotency conflict.</p>
            </div>
            <div className="rounded border border-sl-border bg-sl-bg p-2">
              <span className="font-semibold text-sl-text-subtle">503 Unavailable</span>
              <p className="mt-1 font-sans text-[11px] text-sl-text-muted">Trading engine warming up or temporarily busy.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 5: Python & Agent SDK Snippets */}
      <section className="space-y-4">
        <h2 className="flex items-center gap-2 font-medium text-sl-text">
          <Code2 className="size-4 text-sl-accent" /> Code Integration Snippets
        </h2>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Python snippet */}
          <div className="rounded-[var(--sl-radius-lg)] border border-sl-border bg-sl-surface p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sl-text">Python (requests)</span>
              <button
                type="button"
                onClick={() => copy(PYTHON_SNIPPET, "py_snippet")}
                className="flex items-center gap-1 text-[11px] text-sl-text-muted hover:text-sl-text"
              >
                {copiedSnippet === "py_snippet" ? <Check className="size-3 text-sl-accent" /> : <Copy className="size-3" />}
                {copiedSnippet === "py_snippet" ? "Copied" : "Copy"}
              </button>
            </div>
            <pre tabIndex={0} className="mt-3 max-h-72 overflow-y-auto rounded border border-sl-border bg-sl-bg p-3 font-mono text-[11px] leading-relaxed text-sl-text-muted">
              {PYTHON_SNIPPET}
            </pre>
          </div>

          {/* AI Agent tool definition */}
          <div className="rounded-[var(--sl-radius-lg)] border border-sl-border bg-sl-surface p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sl-text">AI Agent Tool Calling Definition (JSON Schema)</span>
              <button
                type="button"
                onClick={() => copy(AGENT_TOOL_DEFINITION, "agent_tool")}
                className="flex items-center gap-1 text-[11px] text-sl-text-muted hover:text-sl-text"
              >
                {copiedSnippet === "agent_tool" ? <Check className="size-3 text-sl-accent" /> : <Copy className="size-3" />}
                {copiedSnippet === "agent_tool" ? "Copied" : "Copy"}
              </button>
            </div>
            <pre tabIndex={0} className="mt-3 max-h-72 overflow-y-auto rounded border border-sl-border bg-sl-bg p-3 font-mono text-[11px] leading-relaxed text-sl-text-muted">
              {AGENT_TOOL_DEFINITION}
            </pre>
          </div>
        </div>
      </section>

      {/* Section 6: Machine Discovery & Reference Links */}
      <section className="rounded-[var(--sl-radius-lg)] border border-sl-border bg-sl-surface p-4 shadow-sm">
        <h3 className="font-medium text-sl-text">Machine Discovery &amp; Canonical Specs</h3>
        <p className="mt-1 text-xs text-sl-text-muted">
          All endpoints and capabilities are catalog-backed and advertised machine-readably:
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
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
          <a
            href="https://satelink.network/docs/api-reference"
            target="_blank"
            rel="noopener"
            className="flex items-center gap-1.5 rounded border border-sl-border bg-sl-bg px-3 py-1.5 text-sl-text hover:border-sl-border-strong text-[11px]"
          >
            Public Documentation <ExternalLink className="size-3 text-sl-text-subtle" />
          </a>
        </div>
      </section>
    </div>
  );
}
