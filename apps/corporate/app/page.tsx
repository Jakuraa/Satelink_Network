import React from "react";
import Link from "next/link";
import { systems } from "@/content/systems";
import { researchItems } from "@/content/research";
import { company } from "@/content/company";
import {
  ArrowLink,
  Container,
  formatDate,
} from "@/components/Page";
import { MotionReveal } from "@/components/gsap/MotionReveal";
import { SystemsCompass } from "@/components/SystemsCompass";
import { ConversationVideo } from "@/components/ConversationVideo";

const steps: { step: number; title: string; desc: string }[] = [
  {
    step: 1,
    title: "Request",
    desc: "An autonomous agent or machine calls a Satelink endpoint, such as a blockchain RPC method or inference API.",
  },
  {
    step: 2,
    title: "Price",
    desc: "If the call is not yet paid for, Satelink answers with HTTP 402 and machine-readable payment terms and rates.",
  },
  {
    step: 3,
    title: "Pay",
    desc: "The caller pays for that request in USDC on Base via x402, or from prepaid USDT credits on Polygon PoS.",
  },
  {
    step: 4,
    title: "Receive",
    desc: "The request is served and metered. The payment and the usage record reconcile on-chain with cryptographic certainty.",
  },
];

const lifecyclePhases = [
  {
    phase: "DISCOVER",
    desc: "Agent queries decentralized service registries or MCP endpoints to identify required capabilities.",
  },
  {
    phase: "ACCESS",
    desc: "Protocol provides machine-readable contract interface specifications and structured endpoint documentation.",
  },
  {
    phase: "DECIDE",
    desc: "Autonomous agent evaluates economic utility, latency bounds, and rate quotes against budget constraints.",
  },
  {
    phase: "TRANSACT",
    desc: "Micropayment committed via HTTP 402 header in USDC on Base or via prepaid Polygon USDT credit vault.",
  },
  {
    phase: "SETTLE",
    desc: "Cryptographic reconciliation executed on-chain via smart contracts without intermediaries.",
  },
  {
    phase: "OPERATE",
    desc: "Workload executed, metered, and logged. Agent continues workflow execution loop autonomously.",
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col bg-ivory text-ink">
      {/* SECTION 1: CORPORATE HERO (TYPOGRAPHY + SYSTEMS POSITIONING) */}
      <section
        aria-label="Introduction"
        className="relative flex min-h-[88svh] flex-col justify-center pb-16 pt-16 sm:pt-24 lg:pt-28"
      >
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
            {/* Left Column: Headline and Corporate Positioning */}
            <div className="lg:col-span-7">
              <MotionReveal delay={50}>
                <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-green">
                  <span>Established 2019</span>
                  <span className="text-stone-3">/</span>
                  <span className="text-stone-4">Coimbatore, India</span>
                </div>
              </MotionReveal>

              <MotionReveal delay={120}>
                <h1 className="mt-5 font-sans font-medium text-[clamp(2.5rem,5.2vw,4.5rem)] leading-[1.08] tracking-[-0.03em] text-ink">
                  Building software infrastructure for an agent-driven economy.
                </h1>
              </MotionReveal>

              <MotionReveal delay={200}>
                <p className="mt-6 max-w-xl text-lg sm:text-xl font-sans leading-relaxed text-stone-4">
                  Jakuraa Commercial Private Limited, incorporated in Coimbatore in 2019, is a corporate technology institution
                  developing software infrastructure for AI-agent workflows, programmatic service access, and machine commerce.
                  Satelink is its flagship platform.
                </p>
              </MotionReveal>

              <MotionReveal delay={280}>
                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <Link
                    href="/systems"
                    className="inline-flex items-center rounded-full bg-ink px-7 py-3.5 text-sm font-medium text-ivory transition-colors duration-200 ease-out hover:bg-stone-4"
                  >
                    Explore our systems
                  </Link>
                  <a
                    href="https://satelink.network"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-stone-2 px-7 py-3.5 text-sm font-medium text-ink transition-colors duration-200 ease-out hover:border-ink hover:bg-ivory-2"
                  >
                    <span>Discover Satelink</span>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor">
                      <path d="M2.5 9.5L9.5 2.5M9.5 2.5V8.5M9.5 2.5H3.5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </a>
                </div>
              </MotionReveal>

              <MotionReveal delay={340}>
                <div className="mt-10 flex flex-wrap items-center gap-6 text-xs font-mono text-stone-3 border-t border-stone-1 pt-4">
                  <span>CIN: {company.cin}</span>
                  <span>GSTIN: {company.gstin}</span>
                  <span className="hidden sm:inline">DGFT IEC: {company.iec}</span>
                </div>
              </MotionReveal>
            </div>

            {/* Right Column: Technical Systems Architecture Diagram (No Photos) */}
            <div className="lg:col-span-5">
              <MotionReveal delay={220}>
                <div className="overflow-hidden rounded-2xl border border-stone-2 bg-ivory p-6 shadow-sm">
                  <div className="flex items-center justify-between border-b border-stone-1 pb-4">
                    <div>
                      <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-green">
                        PROTOCOL ARCHITECTURE
                      </span>
                      <p className="font-mono text-xs text-stone-4 mt-0.5">
                        x402-v1 / RevenueVaultV2
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-green/10 px-2.5 py-1 font-mono text-[10px] font-medium text-green">
                      <span className="size-1.5 rounded-full bg-green animate-pulse" />
                      Mainnet Operational
                    </span>
                  </div>

                  {/* Flow Diagram */}
                  <div className="mt-6 space-y-3 font-mono text-xs">
                    <div className="rounded-xl border border-stone-1 bg-ivory-2/60 p-3.5">
                      <div className="flex items-center justify-between text-stone-3">
                        <span>STEP 01</span>
                        <span>AGENT INBOUND</span>
                      </div>
                      <p className="mt-1 font-sans text-sm font-medium text-ink">
                        Autonomous Agent Request
                      </p>
                      <p className="mt-0.5 text-[11px] text-stone-4">
                        Client initiates RPC, inference, or trading telemetry query.
                      </p>
                    </div>

                    <div className="flex justify-center text-stone-3">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor">
                        <path d="M6 2v8m0 0l-3-3m3 3l3-3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>

                    <div className="rounded-xl border border-stone-1 bg-ivory-2/60 p-3.5">
                      <div className="flex items-center justify-between text-stone-3">
                        <span>STEP 02</span>
                        <span>HTTP 402 PROTOCOL</span>
                      </div>
                      <p className="mt-1 font-sans text-sm font-medium text-ink">
                        Machine Payment Required
                      </p>
                      <p className="mt-0.5 text-[11px] text-stone-4">
                        Header returned with cryptographically signed price quote.
                      </p>
                    </div>

                    <div className="flex justify-center text-stone-3">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor">
                        <path d="M6 2v8m0 0l-3-3m3 3l3-3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>

                    <div className="rounded-xl border border-stone-1 bg-ivory-2/60 p-3.5">
                      <div className="flex items-center justify-between text-stone-3">
                        <span>STEP 03</span>
                        <span>LAYER-2 SETTLEMENT</span>
                      </div>
                      <p className="mt-1 font-sans text-sm font-medium text-ink">
                        Micropayment Verification
                      </p>
                      <p className="mt-0.5 text-[11px] text-stone-4">
                        Base (USDC x402) or Polygon PoS (USDT RevenueVaultV2).
                      </p>
                    </div>

                    <div className="flex justify-center text-stone-3">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor">
                        <path d="M6 2v8m0 0l-3-3m3 3l3-3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>

                    <div className="rounded-xl border border-green/30 bg-green/5 p-3.5">
                      <div className="flex items-center justify-between text-green">
                        <span>STEP 04</span>
                        <span>FINALITY</span>
                      </div>
                      <p className="mt-1 font-sans text-sm font-medium text-ink">
                        Verified Execution & Receipt
                      </p>
                      <p className="mt-0.5 text-[11px] text-stone-4">
                        Workload dispatched; cryptographic receipt reconciled on-chain.
                      </p>
                    </div>
                  </div>

                  {/* Telemetry Footer */}
                  <div className="mt-5 grid grid-cols-2 gap-3 border-t border-stone-1 pt-4 font-mono text-[10px] text-stone-3">
                    <div>
                      <span className="block text-stone-4">SETTLEMENT RAILS</span>
                      <span className="font-semibold text-ink">Base (USDC) &amp; Polygon (USDT)</span>
                    </div>
                    <div>
                      <span className="block text-stone-4">SETTLEMENT MODEL</span>
                      <span className="font-semibold text-ink">Non-Custodial On-Chain Receipts</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs font-mono text-stone-3">
                  <span>Fig. 01: Satelink Autonomous Settlement Loop</span>
                  <span>Non-Custodial Architecture</span>
                </div>
              </MotionReveal>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: SATELINK - FLAGSHIP TECHNOLOGY PLATFORM */}
      <section
        id="satelink"
        aria-labelledby="satelink-heading"
        className="border-t border-stone-1 py-20 sm:py-28 bg-ivory-2/40"
      >
        <Container>
          <div className="grid gap-16 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-6 space-y-6">
              <MotionReveal>
                <span className="font-mono text-xs uppercase tracking-wider text-green font-semibold">
                  FLAGSHIP TECHNOLOGY PLATFORM
                </span>
                <h2
                  id="satelink-heading"
                  className="mt-2 font-serif text-3xl sm:text-4xl lg:text-5xl font-normal tracking-tight text-ink"
                >
                  Satelink: agent commerce and programmatic procurement.
                </h2>
                <p className="mt-4 text-base sm:text-lg leading-relaxed text-stone-4 font-sans">
                  Satelink is the flagship technology platform engineered by Jakuraa. It provides the programmatic service
                  discovery, payment rails, vaults, and usage-metered gateways that let autonomous software agents and automated
                  systems discover, evaluate, access, and procure digital capabilities per call. Satelink Trading AI is its first
                  intended application, currently in controlled paper-trading beta.
                </p>
              </MotionReveal>

              <MotionReveal delay={100}>
                <div className="space-y-4 rounded-xl border border-stone-2 bg-ivory p-6">
                  <div>
                    <h4 className="font-serif text-lg font-medium text-ink">x402 Protocol Rail</h4>
                    <p className="mt-1 text-sm text-stone-4 font-sans">
                      Machine payments settled in USDC on Base, transmitted and verified directly inside HTTP request headers.
                    </p>
                  </div>
                  <div className="border-t border-stone-1 pt-4">
                    <h4 className="font-serif text-lg font-medium text-ink">Prepaid Credit Vault</h4>
                    <p className="mt-1 text-sm text-stone-4 font-sans">
                      Permissionless USDT deposits committed directly to RevenueVaultV2 on Polygon PoS for sub-second micro-settlement.
                    </p>
                  </div>
                </div>
              </MotionReveal>

              <MotionReveal delay={180}>
                <div className="flex flex-wrap gap-5 text-sm font-medium pt-2">
                  <Link
                    href="/technology"
                    className="inline-flex items-center gap-1.5 text-green hover:underline font-semibold"
                  >
                    <span>Read Technology Architecture</span>
                    <span>→</span>
                  </Link>
                  <a
                    href="https://satelink.network"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-stone-4 hover:text-ink hover:underline"
                  >
                    <span>satelink.network</span>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor">
                      <path d="M2.5 9.5L9.5 2.5M9.5 2.5H3.5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </a>
                </div>
              </MotionReveal>
            </div>

            {/* Right: Static, High-Legibility Systems Compass Diagram */}
            <div className="lg:col-span-6">
              <MotionReveal delay={150}>
                <div className="rounded-2xl border border-stone-2 bg-ivory p-6 sm:p-8 shadow-sm">
                  <div className="mb-4 flex items-center justify-between text-xs font-mono text-stone-3 border-b border-stone-1 pb-3">
                    <span>SYSTEMS TOPOLOGY</span>
                    <span>FLAGSHIP & OPERATING MODULES</span>
                  </div>
                  <SystemsCompass className="max-w-md" />
                </div>
              </MotionReveal>
            </div>
          </div>

          {/* Machine-Commerce Lifecycle Grid */}
          <div className="mt-20 border-t border-stone-2 pt-14">
            <MotionReveal>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <span className="font-mono text-xs uppercase tracking-wider text-green font-semibold">
                    AUTONOMOUS TRANSACTION CYCLE
                  </span>
                  <h3 className="mt-2 font-serif text-2xl sm:text-3xl text-ink">
                    The machine-commerce loop
                  </h3>
                </div>
                <p className="max-w-md text-sm text-stone-4 font-sans">
                  The six autonomous phases executed when software agents discover, acquire, and settle commercial resources.
                </p>
              </div>
            </MotionReveal>

            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {lifecyclePhases.map((phase, idx) => (
                <MotionReveal key={phase.phase} delay={idx * 50}>
                  <div className="h-full rounded-xl border border-stone-1 bg-ivory p-5 shadow-sm">
                    <div className="flex items-center justify-between text-xs font-mono text-stone-3">
                      <span>PHASE 0{idx + 1}</span>
                      <span className="text-green font-semibold">{phase.phase}</span>
                    </div>
                    <h4 className="mt-3 font-serif text-lg text-ink">{phase.phase}</h4>
                    <p className="mt-2 text-xs leading-relaxed text-stone-4 font-sans">
                      {phase.desc}
                    </p>
                  </div>
                </MotionReveal>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* SECTION 3: AI TRADING AGENTS (PRIMARY APPLICATION DIRECTION) */}
      <section
        id="trading-agents"
        aria-labelledby="trading-heading"
        className="border-t border-stone-1 py-20 sm:py-28 bg-ivory"
      >
        <Container>
          <MotionReveal>
            <div className="max-w-3xl">
              <span className="font-mono text-xs uppercase tracking-wider text-green font-semibold">
                PRIMARY APPLICATION DIRECTION
              </span>
              <h2 id="trading-heading" className="mt-2 font-serif text-3xl sm:text-4xl text-ink">
                Satelink Trading AI: reason, validate, score, authorize, execute, learn.
              </h2>
              <p className="mt-4 text-base sm:text-lg text-stone-4 font-sans leading-relaxed">
                An application where AI models analyze market structure and propose suggestions, while deterministic
                risk engines and signed user mandates decide. Currently in controlled paper-trading beta; live execution
                is not yet available. Your money stays at your broker and withdrawals are never enabled.
              </p>
            </div>
          </MotionReveal>

          <div className="mt-14 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            <MotionReveal delay={50}>
              <div className="flex h-full flex-col justify-between rounded-2xl border border-stone-1 bg-ivory p-6 shadow-sm">
                <div>
                  <span className="font-mono text-xs text-stone-3 uppercase">01 / SIGNAL INGESTION</span>
                  <h3 className="mt-3 font-serif text-xl text-ink">Trading Intelligence</h3>
                  <p className="mt-2 text-sm leading-relaxed text-stone-4 font-sans">
                    Orderbook depth, liquidity flow, and on-chain telemetry consumed and paid for on a per-query basis without recurring subscriptions.
                  </p>
                </div>
                <div className="mt-6 border-t border-stone-1 pt-3 text-xs font-mono text-stone-3">
                  Scope: Real-Time Feeds
                </div>
              </div>
            </MotionReveal>

            <MotionReveal delay={110}>
              <div className="flex h-full flex-col justify-between rounded-2xl border border-stone-1 bg-ivory p-6 shadow-sm">
                <div>
                  <span className="font-mono text-xs text-stone-3 uppercase">02 / INFERENCE LOOP</span>
                  <h3 className="mt-3 font-serif text-xl text-ink">Agent Decision Systems</h3>
                  <p className="mt-2 text-sm leading-relaxed text-stone-4 font-sans">
                    A deterministic scorecard gives GO, WAIT or REJECT with its evidence. A failed hard gate always overrides a high score.
                  </p>
                </div>
                <div className="mt-6 border-t border-stone-1 pt-3 text-xs font-mono text-stone-3">
                  Scope: Nonce Sequencing
                </div>
              </div>
            </MotionReveal>

            <MotionReveal delay={170}>
              <div className="flex h-full flex-col justify-between rounded-2xl border border-stone-1 bg-ivory p-6 shadow-sm">
                <div>
                  <span className="font-mono text-xs text-stone-3 uppercase">03 / EXECUTION RAILS</span>
                  <h3 className="mt-3 font-serif text-xl text-ink">Authorised Execution</h3>
                  <p className="mt-2 text-sm leading-relaxed text-stone-4 font-sans">
                    Orders pass a fixed risk engine and your signed mandate, then go to your broker exactly once, with a receipt for every step.
                  </p>
                </div>
                <div className="mt-6 border-t border-stone-1 pt-3 text-xs font-mono text-stone-3">
                  Scope: Risk + Mandates
                </div>
              </div>
            </MotionReveal>

            <MotionReveal delay={230}>
              <div className="flex h-full flex-col justify-between rounded-2xl border border-stone-1 bg-ivory p-6 shadow-sm">
                <div>
                  <span className="font-mono text-xs text-stone-3 uppercase">04 / MACHINE PAYMENTS</span>
                  <h3 className="mt-3 font-serif text-xl text-ink">Per-Call Settlement</h3>
                  <p className="mt-2 text-sm leading-relaxed text-stone-4 font-sans">
                    Continuous micro-metering of market data feeds and RPC endpoints via x402 headers without manual billing cycles.
                  </p>
                </div>
                <div className="mt-6 border-t border-stone-1 pt-3 text-xs font-mono text-stone-3">
                  Scope: HTTP 402 + L2
                </div>
              </div>
            </MotionReveal>
          </div>

          {/* Operational Status Matrix */}
          <div className="mt-12 rounded-2xl border border-stone-2 bg-ivory-2/40 p-6 sm:p-8">
            <MotionReveal>
              <div className="flex items-center justify-between border-b border-stone-2 pb-4">
                <span className="font-mono text-xs font-semibold uppercase text-stone-4">
                  CAPABILITY DEPLOYMENT STATUS
                </span>
                <span className="font-mono text-xs text-stone-3">
                  STATUS AS OF OCTOBER 2026
                </span>
              </div>
              <div className="mt-6 grid gap-6 sm:grid-cols-3">
                <div>
                  <span className="inline-block rounded bg-green-soft px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-green">
                    LIVE IN PRODUCTION
                  </span>
                  <h4 className="mt-2 font-serif text-base text-ink">x402 & RevenueVaultV2 Rails</h4>
                  <p className="mt-1 text-xs text-stone-4 font-sans">
                    USDC on Base and USDT on Polygon deployed on mainnet; settlement proven with mainnet transactions.
                  </p>
                </div>
                <div>
                  <span className="inline-block rounded bg-amber-ink/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-amber-ink">
                    CONTROLLED BETA (PAPER)
                  </span>
                  <h4 className="mt-2 font-serif text-base text-ink">Satelink Trading AI</h4>
                  <p className="mt-1 text-xs text-stone-4 font-sans">
                    Paper trading in controlled beta. Live execution is not yet available.
                  </p>
                </div>
                <div>
                  <span className="inline-block rounded bg-stone-2 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-stone-4">
                    ROADMAP
                  </span>
                  <h4 className="mt-2 font-serif text-base text-ink">Multi-Agent Portfolio Meshes</h4>
                  <p className="mt-1 text-xs text-stone-4 font-sans">
                    Cooperative cross-agent liquidity coordination and multi-asset autonomous risk management in research.
                  </p>
                </div>
              </div>
            </MotionReveal>
          </div>
        </Container>
      </section>

      {/* SECTION 4: MACHINE / AGENT COMMERCE (INFRASTRUCTURE PRINCIPLES) */}
      <section
        id="machine-commerce"
        aria-labelledby="commerce-heading"
        className="border-t border-stone-1 py-20 sm:py-28 bg-ivory-2/40"
      >
        <Container>
          <div className="grid gap-12 lg:grid-cols-12 lg:items-start">
            <div className="lg:col-span-5 space-y-6">
              <MotionReveal>
                <span className="font-mono text-xs uppercase tracking-wider text-green font-semibold">
                  INFRASTRUCTURE PRINCIPLES
                </span>
                <h2 id="commerce-heading" className="mt-2 font-serif text-3xl sm:text-4xl text-ink">
                  Why autonomous software requires new economic rails.
                </h2>
                <p className="mt-4 text-base leading-relaxed text-stone-4 font-sans">
                  The commercial internet was designed around human workflows: manual credit card forms,
                  monthly subscription cycles, legal contracts, and accounting departments.
                </p>
                <p className="text-base leading-relaxed text-stone-4 font-sans">
                  Autonomous AI agents cannot sign credit card agreements, solve CAPTCHAs, or wait for billing cycles.
                  To interact with paid tools, APIs, and data sources, they require protocol-level rails that allow them
                  to discover pricing, commit payments, and verify delivery in milliseconds.
                </p>
              </MotionReveal>

              <MotionReveal delay={120}>
                <div className="rounded-xl border border-stone-2 bg-ivory p-5 font-mono text-xs">
                  <span className="text-green font-semibold uppercase">CONTRAST</span>
                  <div className="mt-3 space-y-3">
                    <div>
                      <span className="text-stone-3 block">LEGACY HUMAN COMMERCE:</span>
                      <p className="font-sans text-stone-4 text-sm mt-0.5">
                        Credit cards, invoice cycles, 2.9% merchant interchange, manual dispute processes.
                      </p>
                    </div>
                    <div className="border-t border-stone-1 pt-2">
                      <span className="text-green block">SATELINK MACHINE COMMERCE:</span>
                      <p className="font-sans text-ink text-sm mt-0.5">
                        HTTP 402 headers, per-call micro-metering, sub-cent L2 settlement, cryptographic receipts.
                      </p>
                    </div>
                  </div>
                </div>
              </MotionReveal>
            </div>

            <div className="lg:col-span-7">
              <MotionReveal delay={80}>
                <div className="space-y-4">
                  {steps.map((s) => (
                    <div
                      key={s.step}
                      className="rounded-2xl border border-stone-1 bg-ivory p-6 shadow-sm transition-all hover:border-green"
                    >
                      <div className="flex items-center justify-between text-xs font-mono text-stone-3">
                        <span className="text-green font-semibold">STAGE 0{s.step}</span>
                        <span>DETERMINISTIC</span>
                      </div>
                      <h3 className="mt-2 font-serif text-xl text-ink">{s.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-stone-4 font-sans">
                        {s.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </MotionReveal>
            </div>
          </div>
        </Container>
      </section>

      {/* SECTION 5: MCP / API / CONNECTORS (CONNECTIVITY LAYER) */}
      <section
        id="connectors"
        aria-labelledby="connectors-heading"
        className="border-t border-stone-1 py-20 sm:py-28 bg-ivory"
      >
        <Container>
          <MotionReveal>
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <span className="font-mono text-xs uppercase tracking-wider text-green font-semibold">
                  CONNECTIVITY LAYER
                </span>
                <h2 id="connectors-heading" className="mt-2 font-serif text-3xl sm:text-4xl text-ink">
                  Model Context Protocol, APIs, and Connectors
                </h2>
                <p className="mt-3 max-w-2xl text-base text-stone-4 font-sans">
                  Satelink bridges autonomous agents with external tools, financial data feeds, and enterprise services through standardized protocols.
                </p>
              </div>
              <ArrowLink href="/technology">Technical specifications</ArrowLink>
            </div>
          </MotionReveal>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <MotionReveal delay={60}>
              <div className="flex h-full flex-col justify-between rounded-2xl border border-stone-1 bg-ivory p-6 shadow-sm">
                <div>
                  <span className="rounded bg-ivory-2 px-2.5 py-1 font-mono text-[10px] uppercase text-stone-4">
                    TOOL CALLING
                  </span>
                  <h3 className="mt-4 font-serif text-xl text-ink">Model Context Protocol (MCP)</h3>
                  <p className="mt-2 text-sm leading-relaxed text-stone-4 font-sans">
                    Standardized tool calling and context servers, allowing LLM agents to inspect wallet balances, query orderbooks, and trigger payments securely.
                  </p>
                </div>
                <div className="mt-6 border-t border-stone-1 pt-3 font-mono text-[11px] text-stone-3">
                  Claude & Anthropic MCP compatible
                </div>
              </div>
            </MotionReveal>

            <MotionReveal delay={120}>
              <div className="flex h-full flex-col justify-between rounded-2xl border border-stone-1 bg-ivory p-6 shadow-sm">
                <div>
                  <span className="rounded bg-ivory-2 px-2.5 py-1 font-mono text-[10px] uppercase text-stone-4">
                    REST & STREAMING
                  </span>
                  <h3 className="mt-4 font-serif text-xl text-ink">Low-Latency APIs</h3>
                  <p className="mt-2 text-sm leading-relaxed text-stone-4 font-sans">
                    High-throughput endpoints for programmatic telemetry, pricing discovery, and real-time execution feedback.
                  </p>
                </div>
                <div className="mt-6 border-t border-stone-1 pt-3 font-mono text-[11px] text-stone-3">
                  Sub-50ms endpoint response
                </div>
              </div>
            </MotionReveal>

            <MotionReveal delay={180}>
              <div className="flex h-full flex-col justify-between rounded-2xl border border-stone-1 bg-ivory p-6 shadow-sm">
                <div>
                  <span className="rounded bg-ivory-2 px-2.5 py-1 font-mono text-[10px] uppercase text-stone-4">
                    DATA INTEGRATION
                  </span>
                  <h3 className="mt-4 font-serif text-xl text-ink">Provider Feeds</h3>
                  <p className="mt-2 text-sm leading-relaxed text-stone-4 font-sans">
                    Direct streaming of market depth, cryptographic transaction logs, and hardware telemetry without third-party aggregators.
                  </p>
                </div>
                <div className="mt-6 border-t border-stone-1 pt-3 font-mono text-[11px] text-stone-3">
                  Verifiable oracle feeds
                </div>
              </div>
            </MotionReveal>

            <MotionReveal delay={240}>
              <div className="flex h-full flex-col justify-between rounded-2xl border border-stone-1 bg-ivory p-6 shadow-sm">
                <div>
                  <span className="rounded bg-ivory-2 px-2.5 py-1 font-mono text-[10px] uppercase text-stone-4">
                    SMART CONTRACTS
                  </span>
                  <h3 className="mt-4 font-serif text-xl text-ink">Settlement Connectors</h3>
                  <p className="mt-2 text-sm leading-relaxed text-stone-4 font-sans">
                    Native integration with Base, Polygon PoS, and EVM smart contracts via zero-dependency client libraries.
                  </p>
                </div>
                <div className="mt-6 border-t border-stone-1 pt-3 font-mono text-[11px] text-stone-3">
                  Zero external SDK dependency
                </div>
              </div>
            </MotionReveal>
          </div>
        </Container>
      </section>

      {/* SECTION 6: AI ASSISTANT - FUTURE EXPANSION (CLEARLY LABELED ROADMAP) */}
      <section
        id="future-expansion"
        aria-labelledby="expansion-heading"
        className="border-t border-stone-1 py-20 sm:py-28 bg-ivory-2/40"
      >
        <Container>
          <MotionReveal>
            <div className="max-w-3xl">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs uppercase tracking-wider text-green font-semibold">
                  LONG-TERM PLATFORM DIRECTION
                </span>
                <span className="rounded-full bg-stone-2 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-stone-4">
                  Future Roadmap
                </span>
              </div>
              <h2 id="expansion-heading" className="mt-2 font-serif text-3xl sm:text-4xl text-ink">
                Expanding toward universal autonomous assistance.
              </h2>
              <p className="mt-4 text-base sm:text-lg text-stone-4 font-sans leading-relaxed">
                While AI trading agents and machine-to-machine commerce are Satelink's initial focus,
                our long-term architectural roadmap expands toward an institutional autonomous assistant capable of executing
                complex multi-step operations across enterprise workflows.
              </p>
            </div>
          </MotionReveal>

          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            <MotionReveal delay={50}>
              <div className="rounded-2xl border border-stone-2 bg-ivory p-6">
                <span className="font-mono text-xs text-stone-3 uppercase block">EXPANSION V1</span>
                <h3 className="mt-2 font-serif text-xl text-ink">Autonomous Workflow Execution</h3>
                <p className="mt-2 text-sm text-stone-4 font-sans leading-relaxed">
                  Enabling software agents to coordinate tasks across external cloud services, databases, and third-party APIs without manual human hand-offs.
                </p>
              </div>
            </MotionReveal>

            <MotionReveal delay={110}>
              <div className="rounded-2xl border border-stone-2 bg-ivory p-6">
                <span className="font-mono text-xs text-stone-3 uppercase block">EXPANSION V2</span>
                <h3 className="mt-2 font-serif text-xl text-ink">Universal MCP Orchestration</h3>
                <p className="mt-2 text-sm text-stone-4 font-sans leading-relaxed">
                  Connecting enterprise AI assistants with distributed private tool servers, ensuring verifiable cryptographic access control and audit trails.
                </p>
              </div>
            </MotionReveal>

            <MotionReveal delay={170}>
              <div className="rounded-2xl border border-stone-2 bg-ivory p-6">
                <span className="font-mono text-xs text-stone-3 uppercase block">EXPANSION V3</span>
                <h3 className="mt-2 font-serif text-xl text-ink">Programmatic Budget Governance</h3>
                <p className="mt-2 text-sm text-stone-4 font-sans leading-relaxed">
                  Cryptographically enforcing spending limits, rate caps, and multi-signature authorization rules for agent-driven commercial transactions.
                </p>
              </div>
            </MotionReveal>
          </div>

          <MotionReveal delay={220}>
            <div className="mt-8 rounded-xl border border-stone-2/70 bg-ivory p-4 font-mono text-xs text-stone-4">
              <span className="text-amber-ink font-semibold">ARCHITECTURAL STATUS NOTE: </span>
              The universal AI assistant layer is in active research and architectural development. It is part of Jakuraa's long-term technical roadmap, while machine-to-machine payment infrastructure and trading intelligence systems are in active deployment.
            </div>
          </MotionReveal>
        </Container>
      </section>

      {/* SECTION 7: RESEARCH & TECHNICAL WORKING PAPERS (TYPOGRAPHY-DRIVEN) */}
      <section
        id="research"
        aria-labelledby="research-heading"
        className="border-t border-stone-1 py-20 sm:py-28 bg-ivory"
      >
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <MotionReveal>
              <span className="font-mono text-xs uppercase tracking-wider text-green font-semibold">
                OPEN PROTOCOLS & SPECIFICATIONS
              </span>
              <h2 id="research-heading" className="mt-2 font-serif text-3xl sm:text-4xl text-ink">
                Technical foundations & working papers
              </h2>
              <p className="mt-2 max-w-xl text-base text-stone-4 font-sans">
                Formal specifications, protocol designs, and technical research papers documenting our machine commerce architecture.
              </p>
            </MotionReveal>
            <ArrowLink href="/research">All working papers</ArrowLink>
          </div>

          <div className="mt-14 grid gap-8 lg:grid-cols-2">
            {researchItems.slice(0, 4).map((item, idx) => (
              <MotionReveal key={item.slug} delay={idx * 70}>
                <article className="group flex h-full flex-col justify-between rounded-2xl border border-stone-1 bg-ivory p-8 shadow-sm transition-all hover:border-green hover:shadow-md">
                  <div>
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="rounded bg-green-soft px-2.5 py-1 text-green font-semibold uppercase">
                        {item.category}
                      </span>
                      <span className="text-stone-3">
                        {item.date ? formatDate(item.date) : "Research Initiative"}
                      </span>
                    </div>

                    <h3 className="mt-4 font-serif text-2xl text-ink group-hover:text-green transition-colors">
                      {item.title}
                    </h3>

                    <p className="mt-3 text-sm leading-relaxed text-stone-4 font-sans">
                      {item.summary}
                    </p>
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-stone-1 pt-4 text-xs">
                    <span className="capitalize text-stone-3 font-mono">Status: {item.status}</span>
                    {item.placeholder ? (
                      <span className="text-stone-3 font-mono">Planned Study</span>
                    ) : (
                      <Link href={`/research#${item.slug}`} className="font-medium text-green hover:underline">
                        Read paper →
                      </Link>
                    )}
                  </div>
                </article>
              </MotionReveal>
            ))}
          </div>
        </Container>
      </section>

      {/* SECTION 8: CONVERSATION / VIDEO EMBED */}
      <section
        id="video"
        aria-labelledby="video-heading"
        className="border-t border-stone-1 py-20 sm:py-28 bg-ivory-2/40"
      >
        <Container>
          <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-5 space-y-5">
              <MotionReveal>
                <span className="font-mono text-xs uppercase tracking-wider text-green font-semibold">
                  CONVERSATION & MARKET PERSPECTIVE
                </span>
                <h2 id="video-heading" className="mt-2 font-serif text-3xl sm:text-4xl text-ink">
                  The machine-to-machine economy in motion.
                </h2>
                <p className="mt-3 text-base sm:text-lg leading-relaxed text-stone-4 font-sans">
                  The convergence of autonomous AI agents, machine payments, and Layer-2 settlement is establishing
                  a new financial paradigm.
                </p>
              </MotionReveal>

              <MotionReveal delay={100}>
                <div className="space-y-3 font-mono text-xs text-stone-4">
                  <div className="flex items-start gap-2">
                    <span className="text-green font-semibold">01</span>
                    <span>HTTP 402 micro-payments replacing monthly enterprise invoicing cycles.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-green font-semibold">02</span>
                    <span>Sub-second, sub-cent transaction settlement on Base and Polygon PoS.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-green font-semibold">03</span>
                    <span>Model Context Protocol (MCP) providing standard agent tool invocation.</span>
                  </div>
                </div>
              </MotionReveal>
            </div>

            <div className="lg:col-span-7">
              <MotionReveal delay={150}>
                <ConversationVideo
                  videoId="YrnxGs00OHg"
                  title="The $5 Trillion M2M Economy AI Agents Are Building Right Now"
                  author="ScaleUp Sage"
                  description="An in-depth analysis exploring how autonomous AI agents, machine-to-machine payment protocols, Model Context Protocol (MCP), and streaming cryptographic money are creating an entirely new programmatic economy that bypasses traditional banking rails."
                  posterSrc="/media/video/m2m-economy-agents-poster.jpg"
                  youtubeUrl="https://www.youtube.com/watch?v=YrnxGs00OHg"
                />
              </MotionReveal>
            </div>
          </div>
        </Container>
      </section>

      {/* SECTION 9: OPERATING ARCHIVE & LEADERSHIP ENTRY POINTS */}
      <section
        id="archive-leadership"
        aria-labelledby="archive-leadership-heading"
        className="border-t border-stone-1 py-20 sm:py-28 bg-ivory"
      >
        <Container>
          <MotionReveal>
            <div className="max-w-3xl">
              <span className="font-mono text-xs uppercase tracking-wider text-green font-semibold">
                CORPORATE ARCHIVE & LEADERSHIP
              </span>
              <h2 id="archive-leadership-heading" className="mt-2 font-serif text-3xl sm:text-4xl text-ink">
                Built on seven years of real-world operating truth.
              </h2>
              <p className="mt-4 text-base sm:text-lg text-stone-4 font-sans leading-relaxed">
                Satelink was not conceived in a purely theoretical vacuum. Before developing autonomous machine
                commerce rails, Jakuraa spent seven years operating across the physical economy: assembling GPU compute
                rigs in 2019, distributing industrial machinery at Falcor, and managing daily retail inventory across
                3,000+ SKUs at Wholesale Syndicate supermarket.
              </p>
            </div>
          </MotionReveal>

          <div className="mt-14 grid gap-8 md:grid-cols-2">
            {/* Card 1: Complete History Gateway */}
            <MotionReveal delay={70}>
              <div className="flex h-full flex-col justify-between rounded-2xl border border-stone-2 bg-ivory-2/40 p-8 shadow-sm">
                <div>
                  <span className="font-mono text-xs uppercase tracking-wider text-stone-3">
                    HISTORICAL TIMELINE (2019 - 2026)
                  </span>
                  <h3 className="mt-3 font-serif text-2xl text-ink">
                    Complete Operating Chronology
                  </h3>
                  <p className="mt-3 text-sm sm:text-base leading-relaxed text-stone-4 font-sans">
                    Explore the complete chronological archive of Jakuraa's commercial ventures, physical experiments,
                    operational learnings, and architectural evolution from physical trade to autonomous software.
                  </p>
                </div>
                <div className="mt-8 border-t border-stone-2 pt-4">
                  <Link
                    href="/history"
                    className="inline-flex items-center gap-2 text-sm font-medium text-ink hover:text-green transition-colors font-mono"
                  >
                    <span>Read Complete Historical Archive →</span>
                  </Link>
                </div>
              </div>
            </MotionReveal>

            {/* Card 2: Founder & Leadership Gateway */}
            <MotionReveal delay={140}>
              <div className="flex h-full flex-col justify-between rounded-2xl border border-stone-2 bg-ivory-2/40 p-8 shadow-sm">
                <div>
                  <span className="font-mono text-xs uppercase tracking-wider text-stone-3">
                    GOVERNANCE & STATUTORY ARCHITECTURE
                  </span>
                  <h3 className="mt-3 font-serif text-2xl text-ink">
                    Founder Profile & Corporate Governance
                  </h3>
                  <p className="mt-3 text-sm sm:text-base leading-relaxed text-stone-4 font-sans">
                    Review our statutory incorporation details (CIN, GSTIN, DGFT IEC), operating principles,
                    constitutional objects, and leadership disclosures for Jakuraa Commercial Private Limited.
                  </p>
                </div>
                <div className="mt-8 border-t border-stone-2 pt-4">
                  <Link
                    href="/company/leadership"
                    className="inline-flex items-center gap-2 text-sm font-medium text-ink hover:text-green transition-colors font-mono"
                  >
                    <span>Founder Profile & Governance →</span>
                  </Link>
                </div>
              </div>
            </MotionReveal>
          </div>

          {/* Closing Institutional CTA Strip */}
          <div className="mt-20 border-t border-stone-1 pt-16">
            <MotionReveal>
              <div className="mx-auto max-w-3xl text-center space-y-6">
                <span className="font-mono text-xs uppercase tracking-wider text-green font-semibold">
                  INSTITUTIONAL ENQUIRIES
                </span>
                <h3 className="font-serif text-3xl sm:text-4xl text-ink">
                  Building for the long term.
                </h3>
                <p className="mx-auto max-w-xl text-base sm:text-lg leading-relaxed text-stone-4 font-sans">
                  Jakuraa is registered, operating, and building. If you are developing
                  systems that require resilient machine commerce infrastructure, we welcome inquiries.
                </p>
                <div className="pt-2">
                  <Link
                    href="/contact"
                    className="inline-flex items-center rounded-full bg-ink px-8 py-4 text-sm font-medium text-ivory transition-colors duration-200 ease-out hover:bg-stone-4"
                  >
                    Contact our team
                  </Link>
                </div>
              </div>
            </MotionReveal>
          </div>
        </Container>
      </section>
    </div>
  );
}
