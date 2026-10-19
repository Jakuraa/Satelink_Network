"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Brain, 
  Globe, 
  FileCheck2, 
  KeyRound, 
  ShieldCheck, 
  Server, 
  LineChart, 
  CheckCircle2, 
  ArrowRight, 
  Terminal, 
  ExternalLink,
  ChevronRight,
  Sparkles,
  Code2,
  Cpu,
  Layers
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

export interface LifecycleStage {
  step: string;
  number: string;
  title: string;
  shortSummary: string;
  description: string;
  technicalDetails: string[];
  icon: React.ElementType;
  codeSnippet: {
    language: string;
    filename: string;
    code: string;
  };
  metrics: { label: string; value: string }[];
  tag: string;
}

export const LIFECYCLE_STAGES: LifecycleStage[] = [
  {
    step: "1. Understand",
    number: "01",
    title: "Task Decomposition & Constraint Analysis",
    shortSummary: "The autonomous agent breaks down user instructions into required computational services and spending bounds.",
    description: "When an AI agent receives an autonomous goal, it analyzes required inputs, query parameters, latency requirements, and allocated budget ceilings before initiating any network interaction.",
    technicalDetails: [
      "Deconstructs task into discrete API dependencies",
      "Evaluates deterministic spending limits and loss collars",
      "Validates schema arguments before dispatch"
    ],
    icon: Brain,
    codeSnippet: {
      language: "json",
      filename: "agent_intent.json",
      code: `{\n  "agent_id": "agent_alpha_09",\n  "objective": "ingest_latest_polygon_state",\n  "required_services": [\n    "eth_blockNumber",\n    "eth_getBlockByNumber"\n  ],\n  "budget_ceiling_usd": 0.05,\n  "max_latency_ms": 1200,\n  "fallback_rail": "x402_base"\n}`
    },
    metrics: [
      { label: "Action Type", value: "Autonomous Intent" },
      { label: "Budget Limit", value: "Strict Cap (Enforced)" },
      { label: "State", value: "Verified Local" }
    ],
    tag: "Task Inception"
  },
  {
    step: "2. Discover",
    number: "02",
    title: "Machine-Readable Service Catalog Query",
    shortSummary: "The agent queries machine catalogues and MCP endpoints to locate compatible digital service providers.",
    description: "Instead of scraping human documentation, the agent fetches machine-readable manifests (such as /.well-known/satelink.json) or queries Satelink Model Context Protocol (MCP) servers to discover endpoints, schemas, and terms.",
    technicalDetails: [
      "HTTP GET to standard /.well-known/satelink.json manifest",
      "Reads available endpoints, methods, and protocol versions",
      "Inspects pricing.json for immutable unit rates"
    ],
    icon: Globe,
    codeSnippet: {
      language: "http",
      filename: "GET /.well-known/satelink.json",
      code: `GET https://rpc.satelink.network/.well-known/satelink.json HTTP/1.1\nHost: rpc.satelink.network\nUser-Agent: satelink-agent/1.0\n\nHTTP/1.1 200 OK\nContent-Type: application/json\n\n{\n  "version": "1.0.0",\n  "catalog": {\n    "rpc": "https://rpc.satelink.network/rpc/polygon",\n    "pricing": "https://satelink.network/pricing.json",\n    "auth_schemes": ["api_key", "x402"]\n  }\n}`
    },
    metrics: [
      { label: "Standard", value: "RFC 8615" },
      { label: "Manifest", value: "Active JSON" },
      { label: "MCP Support", value: "Std Client" }
    ],
    tag: "Service Discovery"
  },
  {
    step: "3. Compare",
    number: "03",
    title: "Unit Cost, Latency & Quota Verification",
    shortSummary: "The agent checks unit economics and authorization options against execution limits.",
    description: "Software agents verify cost per call against allocated balances. Satelink provides transparent pricing: metered Polygon PoS RPC at a flat rate per call, with clear keyless x402 bundle options.",
    technicalDetails: [
      "Flat per-call rate for Polygon PoS JSON-RPC",
      "Keyless micropayments via x402 per-call protocol",
      "Zero hidden surge charges or dynamic markups"
    ],
    icon: FileCheck2,
    codeSnippet: {
      language: "json",
      filename: "pricing_evaluation.json",
      code: `{\n  "service": "polygon_rpc_gateway",\n  "chain_id": 137,\n  "unit_cost_mode": "flat_per_call",\n  "payment_options": [\n    { "rail": "usdt_prepaid_vault", "network": "polygon_pos" },\n    { "rail": "x402_keyless_usdc", "network": "base_l2" }\n  ],\n  "quote_validity": "deterministic_flat_rate"\n}`
    },
    metrics: [
      { label: "Pricing Mode", value: "Deterministic Flat" },
      { label: "Settlement", value: "On-Chain 137" },
      { label: "Surge Multiplier", value: "None (1.0x)" }
    ],
    tag: "Economic Comparison"
  },
  {
    step: "4. Select",
    number: "04",
    title: "Target Route & Protocol Handshake Preparation",
    shortSummary: "The agent selects the endpoint and prepares payload parameters conforming to JSON-RPC 2.0 standards.",
    description: "With requirements validated and costs checked, the agent prepares the payload. It formats the JSON-RPC request and prepares either its API key or its wallet signer for keyless settlement.",
    technicalDetails: [
      "Formats standard JSON-RPC 2.0 method payload",
      "Verifies gateway health status and DNS resolution",
      "Selects preferred payment rail based on account balance"
    ],
    icon: KeyRound,
    codeSnippet: {
      language: "json",
      filename: "prepared_payload.json",
      code: `{\n  "jsonrpc": "2.0",\n  "id": 1042,\n  "method": "eth_getBlockByNumber",\n  "params": ["latest", false],\n  "meta": {\n    "target": "https://rpc.satelink.network/rpc/polygon",\n    "rail_selected": "x402_base"\n  }\n}`
    },
    metrics: [
      { label: "Protocol", value: "JSON-RPC 2.0" },
      { label: "Health Check", value: "Passing" },
      { label: "Method", value: "eth_getBlockByNumber" }
    ],
    tag: "Route Selection"
  },
  {
    step: "5. Authorize",
    number: "05",
    title: "Keyless HTTP 402 Challenge or Scoped Key Authorization",
    shortSummary: "Access is authorized keylessly via HTTP 402 on Base (USDC) or via prepaid USDT credit accounts.",
    description: "If calling keylessly without an API key, the gateway answers with HTTP 402 Payment Required specifying payment terms. The agent signs an authorization header in USDC on Base, or supplies an authorized API key funded with USDT.",
    technicalDetails: [
      "HTTP 402 handshake with machine-readable payment terms",
      "EIP-712 payment authorization signed in USDC on Base",
      "Prepaid USDT credits verified atomically via RevenueVault"
    ],
    icon: ShieldCheck,
    codeSnippet: {
      language: "http",
      filename: "HTTP 402 Challenge Handshake",
      code: `HTTP/1.1 402 Payment Required\nWWW-Authenticate: x402\nContent-Type: application/json\n\n{\n  "scheme": "x402",\n  "network": "eip155:8453",\n  "asset": "USDC",\n  "amount": "0.10",\n  "recipient": "0x966E...7Ad4",\n  "facilitator": "https://x402.satelink.network"\n}`
    },
    metrics: [
      { label: "Status Code", value: "402 Payment Required" },
      { label: "Keyless Rail", value: "Base (Chain 8453)" },
      { label: "Asset", value: "USDC / USDT" }
    ],
    tag: "Programmatic Authorization"
  },
  {
    step: "6. Execute",
    number: "06",
    title: "Gateway Execution & Telemetry Streaming",
    shortSummary: "The authenticated request routes through production RPC proxies, streaming the workload result.",
    description: "The request passes deterministic control gates. The gateway dispatches the workload directly to dedicated Polygon PoS nodes, streaming back the complete, verified JSON-RPC response with low latency.",
    technicalDetails: [
      "Strict input sanitization and batch size enforcement",
      "High-throughput Polygon PoS node cluster execution",
      "Streams valid JSON-RPC 2.0 response with execution receipts"
    ],
    icon: Server,
    codeSnippet: {
      language: "http",
      filename: "200 OK Execution Response",
      code: `HTTP/1.1 200 OK\nContent-Type: application/json\nX-Satelink-Cost: 30 micro-units\nX-Satelink-Latency: 48ms\n\n{\n  "jsonrpc": "2.0",\n  "id": 1042,\n  "result": {\n    "number": "0x3f1a24b",\n    "hash": "0x9c74b...e0a2",\n    "timestamp": "0x68f4e21a"\n  }\n}`
    },
    metrics: [
      { label: "HTTP Status", value: "200 OK" },
      { label: "Node Target", value: "Polygon Mainnet" },
      { label: "Batch Gate", value: "Enforced" }
    ],
    tag: "Workload Execution"
  },
  {
    step: "7. Meter & Reconcile",
    number: "07",
    title: "Usage Metering & On-Chain Epoch Settlement",
    shortSummary: "Usage is metered at flat rates, settling on-chain to RevenueVault on Polygon PoS.",
    description: "Every call is logged in the epoch metering ledger. Micro-payments settle cryptographically on-chain to RevenueVaultV2 on Polygon PoS (137) or settle via facilitator on Base, producing an auditable receipt for the agent.",
    technicalDetails: [
      "Per-call decrement from ledger balance at flat unit rate",
      "Periodic batch epoch settlement to RevenueVault contract (137)",
      "Verifiable cryptographic receipt issued for accounting"
    ],
    icon: LineChart,
    codeSnippet: {
      language: "json",
      filename: "settlement_receipt.json",
      code: `{\n  "epoch_id": 8412,\n  "account": "0x71C...a4E8",\n  "calls_settled": 1,\n  "settlement_rate": "flat_unit",\n  "vault_address": "0x577D...BaCEF",\n  "network": "polygon_pos_137",\n  "status": "SETTLED_ON_CHAIN",\n  "tx_hash": "0x89e2c...10fa"\n}`
    },
    metrics: [
      { label: "Ledger", value: "Epoch Aggregated" },
      { label: "Contract", value: "RevenueVaultV2" },
      { label: "Proof", value: "Polygonscan TX" }
    ],
    tag: "Settlement & Receipt"
  }
];

export function ScrollLifecycleStory() {
  const [activeStageIndex, setActiveStageIndex] = useState(0);
  const activeStage = LIFECYCLE_STAGES[activeStageIndex];
  const sectionRef = useRef<HTMLDivElement>(null);
  const stageRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Update active stage on scroll with reliable getBoundingClientRect()
  useEffect(() => {
    const handleScroll = () => {
      if (!sectionRef.current) return;
      const viewportCenter = window.innerHeight * 0.45;
      let closestIdx = 0;
      let minDistance = Infinity;

      stageRefs.current.forEach((el, index) => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const elCenter = rect.top + rect.height / 2;
        const distance = Math.abs(elCenter - viewportCenter);
        if (distance < minDistance) {
          minDistance = distance;
          closestIdx = index;
        }
      });
      setActiveStageIndex(closestIdx);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div ref={sectionRef} className="relative w-full">
      {/* Top Segmented Navigation Tabs (Sticky Step Bar) */}
      <div className="sticky top-[var(--header-height)] z-20 border-y border-sl-border bg-sl-bg/95 backdrop-blur-md px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-2 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 sm:gap-2">
            {LIFECYCLE_STAGES.map((stage, idx) => {
              const isSelected = activeStageIndex === idx;
              return (
                <button
                  key={stage.step}
                  type="button"
                  onClick={() => {
                    setActiveStageIndex(idx);
                    stageRefs.current[idx]?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-sl-mono text-xs font-medium transition-all ${
                    isSelected
                      ? "bg-sl-accent text-sl-accent-ink shadow-sm font-semibold scale-105"
                      : "bg-sl-surface text-sl-text-subtle hover:text-sl-text border border-sl-border"
                  }`}
                  aria-selected={isSelected}
                  role="tab"
                >
                  <span className="opacity-75">{stage.number}</span>
                  <span className="hidden md:inline">{stage.step.split(". ")[1]}</span>
                </button>
              );
            })}
          </div>

          <div className="hidden lg:flex items-center gap-2 font-sl-mono text-xs text-sl-text-subtle pl-4 border-l border-sl-border shrink-0">
            <span className="inline-block size-2 rounded-full bg-sl-settle animate-pulse" />
            <span>Step {activeStageIndex + 1} of 7</span>
          </div>
        </div>
      </div>

      {/* Main Narrative & Sticky Inspection Panel Grid */}
      <div className="mx-auto max-w-[1240px] px-4 py-12 sm:px-6 lg:py-16">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-10 items-start">
          
          {/* Left Column: Sequential Narrative Stages (Scrollable) */}
          <div className="lg:col-span-6 space-y-20 sm:space-y-28 py-6">
            {LIFECYCLE_STAGES.map((stage, index) => {
              const isCurrent = activeStageIndex === index;
              const IconComp = stage.icon;

              return (
                <div
                  key={stage.step}
                  ref={(el) => {
                    stageRefs.current[index] = el;
                  }}
                  id={`stage-${stage.number}`}
                  className={`scroll-mt-44 rounded-2xl transition-all duration-300 p-6 sm:p-8 ${
                    isCurrent 
                      ? "bg-sl-surface/70 border border-sl-border-strong shadow-lg ring-1 ring-sl-accent/15" 
                      : "opacity-45 hover:opacity-80 border border-transparent"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`flex size-9 items-center justify-center rounded-lg font-sl-mono text-xs font-bold transition-colors ${
                        isCurrent 
                          ? "bg-sl-accent text-sl-accent-ink shadow-sm" 
                          : "bg-sl-surface border border-sl-border text-sl-text-subtle"
                      }`}>
                        {stage.number}
                      </span>
                      <span className="font-sl-mono text-xs uppercase tracking-wider text-sl-accent font-semibold">
                        {stage.tag}
                      </span>
                    </div>

                    <span className="font-sl-mono text-xs text-sl-text-subtle">
                      Step {index + 1}/7
                    </span>
                  </div>

                  <h3 className="mt-4 font-sl-display text-2xl sm:text-3xl font-normal tracking-[-0.02em] text-sl-text">
                    {stage.title}
                  </h3>

                  <p className="mt-3 text-base sm:text-lg text-sl-text font-medium leading-relaxed">
                    {stage.shortSummary}
                  </p>

                  <p className="mt-3 text-sm leading-relaxed text-sl-text-muted">
                    {stage.description}
                  </p>

                  {/* Bullet points of verifiable mechanics */}
                  <ul className="mt-5 space-y-2.5 font-sans text-xs sm:text-sm text-sl-text-muted">
                    {stage.technicalDetails.map((detail) => (
                      <li key={detail} className="flex items-start gap-2.5">
                        <CheckCircle2 className="mt-0.5 size-4 text-sl-settle shrink-0" />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Mobile-only Preview of Active Terminal */}
                  <div className="mt-6 block lg:hidden overflow-hidden rounded-xl border border-sl-border bg-[#0C0B09] text-[#FAF9F5]">
                    <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-3.5 py-2 font-sl-mono text-xs">
                      <span className="text-[#A8A29E] text-[11px]">{stage.codeSnippet.filename}</span>
                      <span className="text-[10px] text-sl-accent uppercase tracking-wider">{stage.tag}</span>
                    </div>
                    <pre className="overflow-x-auto font-sl-mono text-xs leading-relaxed text-emerald-400 p-3.5">
                      <code>{stage.codeSnippet.code}</code>
                    </pre>
                    <div className="border-t border-white/10 bg-white/[0.02] p-3 grid grid-cols-2 gap-2 text-xs font-sl-mono">
                      {stage.metrics.slice(0, 2).map((m) => (
                        <div key={m.label} className="text-[10px]">
                          <span className="text-[#78716C] block uppercase">{m.label}</span>
                          <span className="text-[#FAF9F5] font-semibold">{m.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Sticky Inspection Visual Terminal (Desktop) */}
          <div className="hidden lg:block lg:col-span-6 sticky top-36">
            <div className="overflow-hidden rounded-2xl border border-sl-border bg-[#0C0B09] text-[#FAF9F5] shadow-2xl transition-all duration-300">
              
              {/* Window Chrome Header */}
              <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="size-2.5 rounded-full bg-red-500/80" />
                    <span className="size-2.5 rounded-full bg-yellow-500/80" />
                    <span className="size-2.5 rounded-full bg-green-500/80" />
                  </div>
                  <span className="ml-2 font-sl-mono text-xs text-[#A8A29E]">
                    {activeStage.codeSnippet.filename}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded bg-sl-accent/10 border border-sl-accent/20 px-2 py-0.5 font-sl-mono text-[10px] font-semibold text-sl-accent uppercase">
                    Stage {activeStage.number} / 07
                  </span>
                </div>
              </div>

              {/* Code Terminal View */}
              <div className="p-6 bg-[#0C0B09] min-h-[300px] max-h-[440px] overflow-y-auto">
                <pre className="font-sl-mono text-xs leading-relaxed text-emerald-400/90 whitespace-pre">
                  <code>{activeStage.codeSnippet.code}</code>
                </pre>
              </div>

              {/* Bottom Telemetry Metrics Strip */}
              <div className="border-t border-white/10 bg-white/[0.03] p-4">
                <span className="font-sl-mono text-[10px] uppercase tracking-wider text-[#78716C] font-semibold block mb-2.5">
                  Protocol Telemetry &amp; Verifications
                </span>
                <div className="grid grid-cols-3 gap-3">
                  {activeStage.metrics.map((m) => (
                    <div key={m.label} className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5">
                      <span className="block font-sl-mono text-[10px] text-[#78716C] uppercase">
                        {m.label}
                      </span>
                      <span className="mt-0.5 block font-sl-mono text-xs font-semibold text-[#FAF9F5]">
                        {m.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Verifiable Safety Footnote */}
              <div className="flex items-center justify-between border-t border-white/10 bg-white/[0.01] px-4 py-2.5 font-sl-mono text-[11px] text-[#78716C]">
                <span className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Deterministic Execution Engine</span>
                </span>
                <span className="text-[#A8A29E]">RFC 8615 / EIP-712</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
