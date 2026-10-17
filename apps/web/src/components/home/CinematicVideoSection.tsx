"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { 
  Play, 
  ExternalLink, 
  ShieldCheck, 
  ArrowRight, 
  CheckCircle2, 
  Terminal, 
  Cpu, 
  Wallet, 
  Layers, 
  LineChart, 
  Code2, 
  Sparkles 
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PaymentSequence402 } from "@satelink/web-ui";
import { TwoRailsDiagram } from "@satelink/web-ui";

export interface CuratedVideo {
  id: string;
  title: string;
  publisher: string;
  publisherUrl: string;
  description: string;
  relevance: string;
  category: string;
  tag: string;
  timestamp: string;
}

export const VERIFIED_VIDEOS: CuratedVideo[] = [
  {
    id: "S6wc6yvoZLY",
    title: "AI agents are paying each other now…",
    publisher: "Fireship",
    publisherUrl: "https://www.youtube.com/@Fireship",
    description:
      "A deep technical walkthrough of the HTTP 402 Payment Required status code, the x402 open specification, and how autonomous AI agents purchase digital compute without human credit card checkout.",
    relevance:
      "Directly illustrates the machine-to-machine payment problem Satelink addresses: allowing agents to discover priced endpoints, authorize access, and pay keylessly over Base or prepaid vaults.",
    category: "Machine Payments & x402",
    tag: "Protocol Standard",
    timestamp: "Verified High-Definition"
  },
  {
    id: "CQywdSdi5iA",
    title: "The Model Context Protocol (MCP)",
    publisher: "Anthropic",
    publisherUrl: "https://www.youtube.com/@anthropic-ai",
    description:
      "An architectural overview of the Model Context Protocol (MCP) standard for connecting AI models to external tools, data sources, and APIs via standardized client-server interfaces.",
    relevance:
      "Explains the open integration pattern connecting AI agents with external tools and service registries, directly reflecting Satelink's MCP server and machine discovery architecture.",
    category: "Agent Tool Protocols & MCP",
    tag: "Architecture Standard",
    timestamp: "Verified High-Definition"
  }
];

export const NARRATIVE_SECTIONS = [
  {
    id: "assistance",
    number: "01",
    title: "Agent Assistance",
    summary: "A software agent receives a high-level user prompt and identifies the digital services needed to complete it.",
    details: "The agent analyzes natural language or structured workflows, recognizing that it requires live blockchain state and quantitative market feeds before making a proposal.",
    visualType: "terminal",
    payload: `// Agent Input & Dependency Graph\n{\n  "agent": "Satelink-Agent-Runner-v1",\n  "objective": "audit_polygon_reconciliation",\n  "discovered_needs": [\n    { "type": "rpc_polygon", "method": "eth_blockNumber" },\n    { "type": "catalog", "endpoint": "/.well-known/satelink.json" }\n  ]\n}`
  },
  {
    id: "discovery",
    number: "02",
    title: "Service Discovery",
    summary: "Structured catalogue query comparing supported digital services, providers, capabilities, and pricing.",
    details: "The agent requests the machine catalogue to evaluate live endpoints, schemas, authentication schemes, and flat pricing schedules without human interaction.",
    visualType: "table",
    payload: `Endpoint                     Network         Rate Model     Auth Scheme\n/rpc/polygon                 Polygon (137)   Flat Per-Call  Key / x402\n/v1/intelligence/funding     HTTP Data       Metered API    API Key\n/.well-known/satelink.json   Discovery       Public Free    Unauthenticated`
  },
  {
    id: "authorization",
    number: "03",
    title: "Authorization & Payment Rails",
    summary: "Actual authorization flow with strict boundary isolation between crypto and fiat payment rails.",
    details: "Keyless calls use HTTP 402 on Base (USDC). Developer credits use prepaid USDT on Polygon PoS. Human fiat billing uses Dodo Payments. The rails remain completely separate.",
    visualType: "diagram",
    payload: "402_handshake"
  },
  {
    id: "execution",
    number: "04",
    title: "Gateway Execution",
    summary: "Realistic supported JSON-RPC 2.0 interaction routed directly to production Polygon nodes.",
    details: "The request routes through proxy gateways with deterministic rate-limiting and quota enforcement, delivering responses with cryptographic integrity.",
    visualType: "terminal",
    payload: `POST /rpc/polygon HTTP/1.1\nHost: rpc.satelink.network\nContent-Type: application/json\nX-Payment: x402 eip155:8453:signature_...\n\n{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}\n\nHTTP/1.1 200 OK\n{"jsonrpc":"2.0","id":1,"result":"0x3f1a24b"}`
  },
  {
    id: "metering",
    number: "05",
    title: "Metering & Reconciliation",
    summary: "Request usage, billing records, and cryptographic on-chain settlement receipts.",
    details: "Every call decrements the account balance at flat unit rates. Periodic epochs settle directly to RevenueVault on Polygon (137), producing verifiable transaction hashes.",
    visualType: "receipt",
    payload: `Epoch: 8412 | Ledger Status: Settled\nTarget Contract: RevenueVaultV2 (0x577D...BaCEF)\nNetwork: Polygon PoS (Chain ID 137)\nVerifiable Proof: polygonscan.com/tx/0x89e2c...10fa`
  },
  {
    id: "developer",
    number: "06",
    title: "Developer Integration",
    summary: "Seamless integration using public documentation, SDKs, or standard curl commands.",
    details: "Developers start in minutes using standard HTTP clients or our lightweight npm package @satelink/sdk without complex onboarding hurdles.",
    visualType: "terminal",
    payload: `# Instant unauthenticated discovery query:\ncurl https://rpc.satelink.network/.well-known/satelink.json\n\n# Or execute a metered RPC call:\ncurl -X POST https://rpc.satelink.network/rpc/polygon \\\n  -H "Authorization: Bearer sat_live_..." \\\n  -H "Content-Type: application/json" \\\n  -d '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}'`
  }
];

export function CinematicVideoSection() {
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [activeNarrativeTab, setActiveNarrativeTab] = useState(0);

  const activeNarrative = NARRATIVE_SECTIONS[activeNarrativeTab];

  return (
    <div className="w-full space-y-16">
      
      {/* 1. Verified High-Definition Video Showcase */}
      <div>
        <div className="mb-8">
          <span className="font-sl-mono text-xs uppercase tracking-wider text-sl-accent font-semibold">
            Independent Technical Demonstrations
          </span>
          <h3 className="mt-2 font-sl-display text-2xl sm:text-3xl font-normal text-sl-text">
            Verified Educational Media &amp; Architecture Standards
          </h3>
          <p className="mt-2 max-w-2xl text-sm sm:text-base text-sl-text-muted leading-relaxed">
            Curated technical walkthroughs from protocol maintainers and engineering educators explaining autonomous agent tool calling, Model Context Protocol (MCP), and HTTP 402 micropayments.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {VERIFIED_VIDEOS.map((video) => {
            const isPlaying = activeVideoId === video.id;

            return (
              <Card key={video.id} className="flex flex-col overflow-hidden p-0 border-sl-border bg-sl-surface shadow-lg">
                {/* 16:9 HD Responsive Video Container */}
                <div className="relative aspect-video w-full overflow-hidden bg-black border-b border-sl-border">
                  {isPlaying ? (
                    <iframe
                      className="h-full w-full"
                      src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0&modestbranding=1`}
                      title={video.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveVideoId(video.id)}
                      className="group relative flex h-full w-full items-center justify-center text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-sl-accent"
                      aria-label={`Play HD Video: ${video.title} by ${video.publisher}`}
                    >
                      {/* High-Resolution Thumbnail with Fallback */}
                      <Image
                        src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`}
                        alt={video.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 50vw"
                        className="object-cover opacity-85 transition-transform duration-500 group-hover:scale-105 group-hover:opacity-100"
                        unoptimized
                      />

                      {/* Cinematic Gradient Vignette */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/15 transition-opacity group-hover:opacity-75" />

                      {/* Play Button Icon */}
                      <div className="relative z-10 flex size-16 items-center justify-center rounded-full bg-sl-accent text-sl-accent-ink shadow-2xl transition-transform duration-300 group-hover:scale-110">
                        <Play className="ml-1 size-7 fill-current" />
                      </div>

                      {/* Top Badges */}
                      <div className="absolute top-3.5 left-3.5 z-10 flex items-center gap-2">
                        <span className="rounded bg-black/75 px-2.5 py-1 font-sl-mono text-[11px] text-white backdrop-blur-md border border-white/10">
                          {video.category}
                        </span>
                        <span className="rounded bg-sl-accent/90 px-2 py-0.5 font-sl-mono text-[10px] font-semibold text-sl-accent-ink">
                          1080p HD
                        </span>
                      </div>

                      {/* Bottom Prompt */}
                      <div className="absolute bottom-3.5 left-3.5 right-3.5 z-10 flex items-center justify-between text-xs text-white/90 font-medium">
                        <span>Click to load privacy-enhanced video</span>
                        <span className="font-sl-mono text-[11px] text-white/70">YouTube Embed</span>
                      </div>
                    </button>
                  )}
                </div>

                {/* Video Narrative Metadata */}
                <div className="flex flex-1 flex-col p-6">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-sl-mono text-xs text-sl-accent uppercase tracking-wider font-semibold">
                      {video.tag}
                    </span>
                    <a
                      href={`https://www.youtube.com/watch?v=${video.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-sl-mono text-xs text-sl-text-subtle hover:text-sl-text transition-colors"
                    >
                      <span>Watch on YouTube</span>
                      <ExternalLink className="size-3" />
                    </a>
                  </div>

                  <h4 className="mt-2.5 font-semibold text-lg leading-snug text-sl-text">
                    {video.title}
                  </h4>

                  <p className="mt-1 font-sl-mono text-xs text-sl-text-subtle">
                    Channel:{" "}
                    <a
                      href={video.publisherUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-sl-text transition-colors"
                    >
                      {video.publisher}
                    </a>
                  </p>

                  <p className="mt-3 text-sm leading-relaxed text-sl-text-muted flex-1">
                    {video.description}
                  </p>

                  <div className="mt-4 rounded-lg border border-sl-border bg-sl-bg p-3.5 text-xs leading-relaxed text-sl-text-muted">
                    <strong className="font-semibold text-sl-text">Relevance to Satelink: </strong>
                    {video.relevance}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* 2. Interactive Product Narrative Gallery (6 Stages) */}
      <div className="rounded-2xl border border-sl-border bg-sl-surface p-6 sm:p-8 shadow-xl">
        <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <span className="font-sl-mono text-xs uppercase tracking-wider text-sl-accent font-semibold">
              Original Product Visuals
            </span>
            <h3 className="mt-1 font-sl-display text-2xl sm:text-3xl font-normal text-sl-text">
              The Six Stages of Agent-to-Service Interaction
            </h3>
            <p className="mt-2 text-sm text-sl-text-muted max-w-xl">
              Inspect the real payloads, discovery tables, and protocol handshakes that power each interaction stage.
            </p>
          </div>

          <div className="font-sl-mono text-xs text-sl-text-subtle">
            Select a stage below to inspect verified outputs
          </div>
        </div>

        {/* Narrative Stage Tab Buttons */}
        <div className="flex flex-wrap gap-2 border-b border-sl-border pb-4">
          {NARRATIVE_SECTIONS.map((sec, idx) => {
            const isSelected = activeNarrativeTab === idx;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveNarrativeTab(idx)}
                className={`rounded-lg px-3.5 py-2 font-sl-mono text-xs font-medium transition-all ${
                  isSelected
                    ? "bg-sl-accent text-sl-accent-ink font-semibold shadow-sm"
                    : "bg-sl-bg text-sl-text-subtle hover:text-sl-text border border-sl-border"
                }`}
              >
                <span>{sec.number}. {sec.title}</span>
              </button>
            );
          })}
        </div>

        {/* Active Stage Content & Visual Inspection */}
        <div className="mt-8 grid gap-8 lg:grid-cols-12 items-start">
          {/* Left: Stage Description */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded bg-sl-accent/10 border border-sl-accent/20 font-sl-mono text-xs font-bold text-sl-accent">
                {activeNarrative.number}
              </span>
              <h4 className="font-semibold text-xl text-sl-text">
                {activeNarrative.title}
              </h4>
            </div>

            <p className="text-base text-sl-text font-medium leading-relaxed">
              {activeNarrative.summary}
            </p>

            <p className="text-sm text-sl-text-muted leading-relaxed">
              {activeNarrative.details}
            </p>

            <div className="pt-2">
              <Link
                href="/products/machine-commerce"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-sl-text hover:underline"
              >
                <span>Explore machine-commerce architecture</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>

          {/* Right: Technical Visual Representation */}
          <div className="lg:col-span-7">
            {activeNarrative.visualType === "diagram" ? (
              <div className="rounded-xl border border-sl-border bg-sl-bg p-6">
                <span className="block font-sl-mono text-xs uppercase tracking-wider text-sl-accent font-semibold mb-4">
                  HTTP 402 Handshake &amp; Dual Rails
                </span>
                <PaymentSequence402 className="w-full" />
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-sl-border bg-sl-bg-dark shadow-md">
                <div className="flex items-center justify-between border-b border-sl-border/60 bg-black/40 px-4 py-2.5 font-sl-mono text-xs text-sl-text-subtle">
                  <span>stage_{activeNarrative.id}_telemetry.log</span>
                  <span className="text-[10px] uppercase text-emerald-400">Live Schema</span>
                </div>
                <pre className="p-4 font-sl-mono text-xs leading-relaxed text-emerald-400/95 overflow-x-auto">
                  <code>{activeNarrative.payload}</code>
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
