"use client";

import React, { useState } from "react";
import {
  Check,
  Minus,
  Sparkles,
  ArrowRight,
  Shield,
  Zap,
  Terminal,
  Cpu,
  Layers,
  HelpCircle,
  Building2,
  Lock,
  Wallet,
  Clock,
  RefreshCw,
  Search,
  ExternalLink,
  Info,
  DollarSign,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { PlanCards } from "@/components/PlanCards";
import { TwoRailsDiagram } from "@satelink/web-ui";
import { AGENT_RATE_CARD } from "@/lib/plans";
import type { PublicCatalog } from "@/lib/plan-catalog";

const CONSOLE = "https://console.satelink.network";

interface PricingViewProps {
  catalog: PublicCatalog;
  faqList: { question: string; answer: string }[];
}

export function PricingView({ catalog, faqList }: PricingViewProps) {
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  const [currency, setCurrency] = useState<"INR" | "USD">("INR");
  const [activeAudience, setActiveAudience] = useState<"individual" | "agents" | "enterprise">("individual");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showEnterpriseModal, setShowEnterpriseModal] = useState(false);
  const [enterpriseSubmitted, setEnterpriseSubmitted] = useState(false);

  // Form state for Enterprise Enquiry
  const [entName, setEntName] = useState("");
  const [entEmail, setEntEmail] = useState("");
  const [entOrg, setEntOrg] = useState("");
  const [entWorkload, setEntWorkload] = useState("");

  const isYearly = billingPeriod === "yearly";

  // Comparison Matrix Rows
  const comparisonSections = [
    {
      title: "Core Execution Allowances",
      rows: [
        { feature: "Weekly Included Allowance", free: "500 UU (~50 tasks)", pro: "7,500 UU (~750 tasks)", max5x: "37,500 UU (~3,750 tasks)", max20x: "150,000 UU (~15,000 tasks)", ent: "Custom pooled quota" },
        { feature: "Session Burst Window", free: "100 UU / 5 hours", pro: "1,500 UU / 5 hours", max5x: "7,500 UU / 5 hours", max20x: "30,000 UU / 5 hours", ent: "Dedicated burst capacity" },
        { feature: "Reset Schedule", free: "Every Monday 00:00 UTC", pro: "Every Monday 00:00 UTC", max5x: "Every Monday 00:00 UTC", max20x: "Every Monday 00:00 UTC", ent: "Custom cycle / contract" },
        { feature: "Credit Pack Auto-draw", free: false, pro: true, max5x: true, max20x: true, ent: true },
        { feature: "Uninterrupted Execution Rollover", free: false, pro: "Purchased credits only", max5x: "Purchased credits only", max20x: "Purchased credits only", ent: "Custom rollover agreement" },
      ],
    },
    {
      title: "Model Intelligence & Routing",
      rows: [
        { feature: "Standard Fast Models (Flash, Haiku, Llama 3.3)", free: true, pro: true, max5x: true, max20x: true, ent: true },
        { feature: "Workhorse Models (Claude 3.5 Sonnet, GPT-4o)", free: false, pro: true, max5x: true, max20x: true, ent: true },
        { feature: "Deep Reasoning Passes / Month", free: false, pro: "5 passes", max5x: "25 passes", max20x: "60 passes", ent: "Custom / Unrestricted" },
        { feature: "Priority Traffic Routing at Peak Hours", free: false, pro: false, max5x: true, max20x: "Highest queue priority", ent: "Isolated private compute" },
        { feature: "Bring Your Own Key (BYOK) Pass-through", free: false, pro: "Single key", max5x: "Up to 5 keys", max20x: "Up to 20 keys", ent: "Unlimited organization pooling" },
      ],
    },
    {
      title: "Tools, Concurrency & Workspaces",
      rows: [
        { feature: "Live Web Search & Document Extraction", free: true, pro: true, max5x: true, max20x: true, ent: true },
        { feature: "Secure Sandbox Code Execution", free: false, pro: true, max5x: true, max20x: true, ent: true },
        { feature: "Market Microstructure Research Feeds", free: "Sample queries", pro: "Full metered access", max5x: "Full metered access", max20x: "Priority metered access", ent: "Dedicated websocket feeds" },
        { feature: "Maximum Concurrent Agent Tasks", free: "1 task", pro: "3 tasks", max5x: "10 tasks", max20x: "25 tasks", ent: "Custom scale" },
        { feature: "Active API Keys", free: "1 key", pro: "5 keys", max5x: "20 keys", max20x: "50 keys", ent: "Custom / Unlimited" },
        { feature: "Persistent Structured Memory", free: "Session only", pro: "5 projects", max5x: "Unlimited projects", max20x: "Unlimited + vector store", ent: "Dedicated tenant memory" },
      ],
    },
    {
      title: "Governance, Budgets & Controls",
      rows: [
        { feature: "Deterministic Hard Spend Caps", free: true, pro: true, max5x: true, max20x: true, ent: true },
        { feature: "Usage Notifications (70%, 85%, 95%, 100%)", free: "In-app", pro: "Email & Webhooks", max5x: "Email & Webhooks", max20x: "Email & Webhooks", ent: "Custom incident triggers" },
        { feature: "Circuit Breaker on Repeated Tool Errors", free: true, pro: true, max5x: true, max20x: true, ent: true },
        { feature: "Detailed Consumption Breakdown by Model/Tool", free: "Summary", pro: "Daily logs", max5x: "Full telemetry", max20x: "Real-time stream", ent: "SOC2-compliant audit export" },
        { feature: "Single Sign-On (SSO) & SCIM Directory", free: false, pro: false, max5x: false, max20x: false, ent: true },
      ],
    },
    {
      title: "Commercial, Rails & Support",
      rows: [
        { feature: "Fiat Payment Rails (Cards / UPI via Transacty)", free: "N/A", pro: true, max5x: true, max20x: true, ent: "Invoicing / Net 30" },
        { feature: "Crypto Rails (USDT on Polygon, USDC on Base via PayRam)", free: true, pro: true, max5x: true, max20x: true, ent: true },
        { feature: "Statutory Tax Invoicing (GST compliant)", free: "N/A", pro: true, max5x: true, max20x: true, ent: true },
        { feature: "Support Tier", free: "Community Docs", pro: "Standard Email", max5x: "Priority Email (24h)", max20x: "Dedicated Queue (4h)", ent: "Dedicated Engineer & Slack" },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-sl-bg">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-sl-border bg-sl-surface/30 pt-20 pb-16 md:pt-28 md:pb-24">
        <div className="mx-auto max-w-[1240px] px-4 text-center sm:px-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-sl-border bg-sl-surface px-3 py-1 text-xs font-medium text-sl-text-muted">
            <span className="size-2 rounded-full bg-sl-accent animate-pulse" />
            Transparent execution economics · Model routing & budget enforcement
          </div>

          <h1
            className="mx-auto mt-6 max-w-4xl text-balance font-sl-display font-bold text-sl-text tracking-tight"
            style={{ fontSize: "clamp(2.25rem, 5vw, 3.75rem)", lineHeight: 1.1 }}
          >
            AI assistance and execution for people, agents, and connected services.
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg text-sl-text-muted leading-relaxed">
            Satelink combines model routing, context, tools, execution controls, and usage visibility. Start free or
            choose an execution tier tailored to your workflow.
          </p>

          {/* Audience Mode Switcher */}
          <div className="mt-8 flex justify-center">
            <div className="inline-flex rounded-full border border-sl-border bg-sl-surface p-1 shadow-xs">
              <button
                type="button"
                onClick={() => setActiveAudience("individual")}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                  activeAudience === "individual"
                    ? "bg-sl-accent text-sl-accent-ink shadow-xs"
                    : "text-sl-text-muted hover:text-sl-text"
                }`}
              >
                Individuals & Developers
              </button>
              <button
                type="button"
                onClick={() => setActiveAudience("agents")}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                  activeAudience === "agents"
                    ? "bg-sl-accent text-sl-accent-ink shadow-xs"
                    : "text-sl-text-muted hover:text-sl-text"
                }`}
              >
                Autonomous Agents (Pay-Per-Call)
              </button>
              <button
                type="button"
                onClick={() => setActiveAudience("enterprise")}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                  activeAudience === "enterprise"
                    ? "bg-sl-accent text-sl-accent-ink shadow-xs"
                    : "text-sl-text-muted hover:text-sl-text"
                }`}
              >
                Enterprise & Teams
              </button>
            </div>
          </div>

          {/* Billing Controls (Frequency & Currency) */}
          {activeAudience === "individual" && (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4 sm:gap-6">
              {/* Annual / Monthly Toggle */}
              <div className="flex items-center gap-2 rounded-lg border border-sl-border bg-sl-surface px-3 py-1.5 text-xs font-medium text-sl-text">
                <span className={!isYearly ? "font-bold text-sl-text" : "text-sl-text-muted"}>Monthly</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isYearly}
                  aria-label="Toggle annual billing with ~16.7% discount"
                  onClick={() => setBillingPeriod(isYearly ? "monthly" : "yearly")}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    isYearly ? "bg-sl-accent" : "bg-sl-border-strong"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      isYearly ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
                <span className={isYearly ? "font-bold text-sl-text" : "text-sl-text-muted"}>
                  Annual <span className="ml-1 rounded-full bg-sl-accent-soft px-1.5 py-0.5 text-[10px] font-bold text-sl-accent">Save ~16.7%</span>
                </span>
              </div>

              {/* Currency Selector */}
              <div className="flex items-center gap-1 rounded-lg border border-sl-border bg-sl-surface p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setCurrency("INR")}
                  className={`rounded-md px-2.5 py-1 font-semibold transition-colors ${
                    currency === "INR" ? "bg-sl-bg-raised text-sl-text" : "text-sl-text-muted hover:text-sl-text"
                  }`}
                >
                  ₹ INR
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency("USD")}
                  className={`rounded-md px-2.5 py-1 font-semibold transition-colors ${
                    currency === "USD" ? "bg-sl-bg-raised text-sl-text" : "text-sl-text-muted hover:text-sl-text"
                  }`}
                >
                  $ USD
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Main Content Area */}
      {activeAudience === "individual" && (
        <>
          {/* Plan Cards Section */}
          <section aria-labelledby="plans-heading" className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6">
            <h2 id="plans-heading" className="sr-only">
              Execution Plans
            </h2>

            <PlanCards
              catalog={catalog}
              period={billingPeriod}
              currency={currency}
              onSelectEnterprise={() => setShowEnterpriseModal(true)}
            />

            <div className="mt-8 rounded-lg border border-sl-border/60 bg-sl-surface/40 p-4 text-center text-xs text-sl-text-muted">
              <p>
                <strong>Statutory disclosure:</strong> All subscription amounts are billed upfront. Annual plans reflect
                twelve months upfront at approximately 16.7% discount versus twelve single-month renewals. Prices are
                exclusive of applicable statutory taxes (18% GST applies to domestic Indian billing).
              </p>
            </div>
          </section>

          {/* Usage Semantics Explainer Section */}
          <section aria-labelledby="semantics-heading" className="border-t border-sl-border bg-sl-bg-raised py-16">
            <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
              <div className="max-w-3xl">
                <span className="text-xs font-semibold uppercase tracking-wider text-sl-accent">
                  Transparent Metering
                </span>
                <h2 id="semantics-heading" className="mt-2 font-sl-display text-2xl font-bold text-sl-text sm:text-3xl">
                  How Satelink meters execution transparently
                </h2>
                <p className="mt-3 text-sm text-sl-text-muted leading-relaxed">
                  We reject arbitrary markup on provider tokens and opaque message caps. Execution is measured in
                  verifiable Usage Units (UU) corresponding directly to underlying computational costs.
                </p>
              </div>

              <div className="mt-10 grid gap-6 md:grid-cols-3">
                <div className="rounded-[var(--sl-radius-lg)] border border-sl-border bg-sl-surface p-6 shadow-xs">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-sl-accent-soft text-sl-accent">
                    <Cpu className="size-5" />
                  </div>
                  <h3 className="mt-4 font-sl-display text-base font-bold text-sl-text">Inference & Reasoning</h3>
                  <p className="mt-2 text-xs leading-relaxed text-sl-text-muted">
                    Input and output tokens are routed at raw upstream list prices. Fast routing uses lightweight models
                    (~0.5 to 1 UU/task); complex synthesis uses Claude 3.5 Sonnet (~10 to 25 UU/task); multi-step deep
                    reasoning is metered with explicit task ceilings.
                  </p>
                  <div className="mt-4 rounded-md bg-sl-bg-raised p-2 text-[11px] font-sl-mono text-sl-text">
                    1 UU = $0.001 USD list value
                  </div>
                </div>

                <div className="rounded-[var(--sl-radius-lg)] border border-sl-border bg-sl-surface p-6 shadow-xs">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-sl-accent-soft text-sl-accent">
                    <Terminal className="size-5" />
                  </div>
                  <h3 className="mt-4 font-sl-display text-base font-bold text-sl-text">Tools, Search & Sandbox</h3>
                  <p className="mt-2 text-xs leading-relaxed text-sl-text-muted">
                    External research queries, web fetches, document parsing, and Python code sandbox execution draw
                    modest, deterministic units. Failed executions and retries are capped at 3 attempts with exponential
                    backoff to prevent runaway bills.
                  </p>
                  <div className="mt-4 rounded-md bg-sl-bg-raised p-2 text-[11px] font-sl-mono text-sl-text">
                    Hard gates fail closed on budget limit
                  </div>
                </div>

                <div className="rounded-[var(--sl-radius-lg)] border border-sl-border bg-sl-surface p-6 shadow-xs">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-sl-accent-soft text-sl-accent">
                    <Zap className="size-5" />
                  </div>
                  <h3 className="mt-4 font-sl-display text-base font-bold text-sl-text">BYOK Zero-Markup Routing</h3>
                  <p className="mt-2 text-xs leading-relaxed text-sl-text-muted">
                    Bring your own API keys from Anthropic, OpenAI, or Google. Upstream inference is billed directly to
                    your provider account; Satelink draws zero token markup, billing only orchestration, structured
                    memory, and tool execution.
                  </p>
                  <div className="mt-4 rounded-md bg-sl-bg-raised p-2 text-[11px] font-sl-mono text-sl-text">
                    0% token markup on BYOK
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Session & Weekly Allowance Structure */}
          <section aria-labelledby="windows-heading" className="border-t border-sl-border bg-sl-surface py-16">
            <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
              <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr] lg:items-center">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-sl-accent">
                    Budget Architecture
                  </span>
                  <h2 id="windows-heading" className="mt-2 font-sl-display text-2xl font-bold text-sl-text sm:text-3xl">
                    Dual-window burst and weekly allowance protection
                  </h2>
                  <p className="mt-3 text-sm text-sl-text-muted leading-relaxed">
                    Inspired by modern frontier AI platforms, Satelink uses a dual-window enforcement architecture to
                    protect your weekly allowance while guaranteeing high-speed execution bursts.
                  </p>

                  <div className="mt-8 space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sl-accent-soft text-xs font-bold text-sl-accent">
                        1
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-sl-text">Rolling 5-Hour Session Window</h4>
                        <p className="mt-1 text-xs text-sl-text-muted leading-relaxed">
                          Refills continuously over a rolling 5-hour window. This ensures a single heavy research task
                          cannot accidentally deplete your entire weekly allowance in a burst.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sl-accent-soft text-xs font-bold text-sl-accent">
                        2
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-sl-text">Weekly Account Reset</h4>
                        <p className="mt-1 text-xs text-sl-text-muted leading-relaxed">
                          Your full weekly allowance resets cleanly every Monday at 00:00 UTC. Clear progress bars in
                          your console track exact consumption in real time.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sl-accent-soft text-xs font-bold text-sl-accent">
                        3
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-sl-text">Exhaustion Actions</h4>
                        <p className="mt-1 text-xs text-sl-text-muted leading-relaxed">
                          If your session or weekly allowance is reached, Satelink notifies you with clear options: wait
                          for the rolling refill, upgrade your tier, draw from purchased usage credits, or switch to
                          BYOK routing. Nothing is silently billed.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[var(--sl-radius-lg)] border border-sl-border bg-sl-bg-raised p-6 shadow-sm">
                  <h4 className="font-sl-display text-sm font-semibold text-sl-text">Live Allowance Simulation</h4>
                  <p className="mt-1 text-xs text-sl-text-muted">Pro Plan Weekly Window (7,500 UU allowance)</p>

                  <div className="mt-6 space-y-5">
                    <div>
                      <div className="flex justify-between text-xs font-medium text-sl-text">
                        <span>Current Session (5h rolling)</span>
                        <span className="font-sl-mono">420 / 1,500 UU</span>
                      </div>
                      <div className="mt-2 h-2.5 w-full rounded-full bg-sl-surface overflow-hidden">
                        <div className="h-full rounded-full bg-sl-accent" style={{ width: "28%" }} />
                      </div>
                      <span className="mt-1 block text-[11px] text-sl-text-subtle">
                        Refills continuously · 1,080 UU available for immediate burst
                      </span>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-medium text-sl-text">
                        <span>Weekly Consumption</span>
                        <span className="font-sl-mono">3,150 / 7,500 UU</span>
                      </div>
                      <div className="mt-2 h-2.5 w-full rounded-full bg-sl-surface overflow-hidden">
                        <div className="h-full rounded-full bg-sl-accent" style={{ width: "42%" }} />
                      </div>
                      <span className="mt-1 block text-[11px] text-sl-text-subtle">
                        Resets Monday 00:00 UTC · 4,350 UU remaining this week
                      </span>
                    </div>

                    <div className="rounded-md border border-sl-border bg-sl-surface p-3 text-xs">
                      <div className="flex items-center gap-2 text-sl-text">
                        <Shield className="size-4 text-sl-accent" />
                        <span className="font-semibold">Budget Guard Active</span>
                      </div>
                      <p className="mt-1 text-[11px] text-sl-text-muted">
                        Hard spend limits are checked pre-flight before executing multi-turn tool or agent calls.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Additional Usage Credits (Credit Packs) */}
          <section aria-labelledby="topup-heading" className="border-t border-sl-border bg-sl-bg-raised py-16">
            <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
              <div className="text-center max-w-2xl mx-auto">
                <span className="text-xs font-semibold uppercase tracking-wider text-sl-accent">
                  Additional Execution
                </span>
                <h2 id="topup-heading" className="mt-2 font-sl-display text-2xl font-bold text-sl-text sm:text-3xl">
                  Buy additional usage credits
                </h2>
                <p className="mt-3 text-sm text-sl-text-muted leading-relaxed">
                  Need heavy continuous execution without upgrading your plan? Add non-expiring usage credits that draw
                  only when your included subscription allowance is depleted.
                </p>
              </div>

              <div className="mt-10 grid gap-6 sm:grid-cols-3 max-w-4xl mx-auto">
                <div className="rounded-[var(--sl-radius-lg)] border border-sl-border bg-sl-surface p-6 text-center shadow-xs">
                  <p className="font-sl-display text-2xl font-bold text-sl-text">
                    {currency === "INR" ? "₹8,400" : "$100"}
                  </p>
                  <p className="mt-1 text-xs text-sl-text-muted">Equivalent to $100</p>
                  <div className="my-4 border-t border-sl-border/60 pt-4">
                    <p className="font-sl-mono text-sm font-semibold text-sl-text">100,000 UU</p>
                    <p className="mt-1 text-[12px] text-sl-text-subtle">~10,000 standard research requests</p>
                  </div>
                  <a
                    href={`${CONSOLE}/sign-in?next=${encodeURIComponent("/billing/add?pack=pack_100")}`}
                    className="inline-flex w-full items-center justify-center rounded-md border border-sl-border bg-sl-bg-raised py-2 text-xs font-semibold text-sl-text hover:bg-sl-surface"
                  >
                    Buy credits
                  </a>
                </div>

                <div className="relative rounded-[var(--sl-radius-lg)] border border-sl-accent bg-sl-surface p-6 text-center shadow-md ring-1 ring-sl-accent/30">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-sl-accent px-3 py-0.5 text-[10px] font-bold text-sl-accent-ink uppercase">
                      Recommended
                    </span>
                  </div>
                  <p className="font-sl-display text-2xl font-bold text-sl-text">
                    {currency === "INR" ? "₹21,000" : "$250"}
                  </p>
                  <p className="mt-1 text-xs text-sl-text-muted">Equivalent to $250</p>
                  <div className="my-4 border-t border-sl-border/60 pt-4">
                    <p className="font-sl-mono text-sm font-semibold text-sl-text">250,000 UU</p>
                    <p className="mt-1 text-[12px] text-sl-text-subtle">~25,000 standard research requests</p>
                  </div>
                  <a
                    href={`${CONSOLE}/sign-in?next=${encodeURIComponent("/billing/add?pack=pack_250")}`}
                    className="inline-flex w-full items-center justify-center rounded-md bg-sl-accent py-2 text-xs font-semibold text-sl-accent-ink hover:bg-sl-accent-strong"
                  >
                    Buy credits
                  </a>
                </div>

                <div className="rounded-[var(--sl-radius-lg)] border border-sl-border bg-sl-surface p-6 text-center shadow-xs">
                  <p className="font-sl-display text-2xl font-bold text-sl-text">
                    {currency === "INR" ? "₹84,000" : "$1,000"}
                  </p>
                  <p className="mt-1 text-xs text-sl-text-muted">Equivalent to $1,000</p>
                  <div className="my-4 border-t border-sl-border/60 pt-4">
                    <p className="font-sl-mono text-sm font-semibold text-sl-text">1,000,000 UU</p>
                    <p className="mt-1 text-[12px] text-sl-text-subtle">High-volume autonomous pipelines</p>
                  </div>
                  <a
                    href={`${CONSOLE}/sign-in?next=${encodeURIComponent("/billing/add?pack=pack_1000")}`}
                    className="inline-flex w-full items-center justify-center rounded-md border border-sl-border bg-sl-bg-raised py-2 text-xs font-semibold text-sl-text hover:bg-sl-surface"
                  >
                    Buy credits
                  </a>
                </div>
              </div>

              <div className="mt-8 text-center">
                <p className="text-xs text-sl-text-muted">
                  Custom amounts available from ₹500 to ₹250,000 in your Console. Payment processed via Transacty (UPI /
                  cards) and PayRam (non-custodial crypto).
                </p>
              </div>
            </div>
          </section>

          {/* Categorized Full Feature Comparison Table */}
          <section aria-labelledby="matrix-heading" className="border-t border-sl-border bg-sl-surface py-20">
            <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
              <div className="text-center max-w-3xl mx-auto mb-12">
                <span className="text-xs font-semibold uppercase tracking-wider text-sl-accent">
                  Comprehensive Specifications
                </span>
                <h2 id="matrix-heading" className="mt-2 font-sl-display text-2xl font-bold text-sl-text sm:text-3xl">
                  Compare features and capabilities across tiers
                </h2>
                <p className="mt-3 text-sm text-sl-text-muted">
                  Every feature is verified through actual backend enforcement. Planned and private beta features are labeled
                  honestly.
                </p>
              </div>

              <div className="overflow-x-auto rounded-[var(--sl-radius-lg)] border border-sl-border shadow-xs">
                <table className="w-full min-w-[760px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-sl-border bg-sl-bg-raised text-sl-text">
                      <th scope="col" className="p-4 font-semibold w-1/3">Feature</th>
                      <th scope="col" className="p-4 font-semibold text-center">Free</th>
                      <th scope="col" className="p-4 font-semibold text-center text-sl-accent bg-sl-accent-soft/30">Pro</th>
                      <th scope="col" className="p-4 font-semibold text-center">Max 5×</th>
                      <th scope="col" className="p-4 font-semibold text-center">Max 20×</th>
                      <th scope="col" className="p-4 font-semibold text-center">Enterprise</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonSections.map((sec) => (
                      <React.Fragment key={sec.title}>
                        <tr className="border-y border-sl-border bg-sl-surface/80">
                          <th
                            colSpan={6}
                            className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-sl-text-subtle"
                          >
                            {sec.title}
                          </th>
                        </tr>
                        {sec.rows.map((r) => (
                          <tr key={r.feature} className="border-b border-sl-border/60 hover:bg-sl-bg-raised/50">
                            <td className="p-4 font-medium text-sl-text">{r.feature}</td>
                            <td className="p-4 text-center text-sl-text-muted">
                              {renderTableCell(r.free)}
                            </td>
                            <td className="p-4 text-center text-sl-text font-medium bg-sl-accent-soft/10">
                              {renderTableCell(r.pro)}
                            </td>
                            <td className="p-4 text-center text-sl-text-muted">
                              {renderTableCell(r.max5x)}
                            </td>
                            <td className="p-4 text-center text-sl-text-muted">
                              {renderTableCell(r.max20x)}
                            </td>
                            <td className="p-4 text-center text-sl-text-muted">
                              {renderTableCell(r.ent)}
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Autonomous Agents & Software View (Pay-Per-Call) */}
      {activeAudience === "agents" && (
        <section aria-labelledby="agent-rails-heading" className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6">
          <div className="max-w-3xl mb-12">
            <span className="text-xs font-semibold uppercase tracking-wider text-sl-accent">Machine-Native</span>
            <h2 id="agent-rails-heading" className="mt-2 font-sl-display text-2xl font-bold text-sl-text sm:text-3xl">
              Pay per call for software, machines, and autonomous agents
            </h2>
            <p className="mt-3 text-sm text-sl-text-muted leading-relaxed">
              Autonomous software doesn&apos;t need human registration or recurring card renewals. Use HTTP 402 with
              signed micro-payments on Base, or fund an API key via smart contract vault on Polygon.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <div className="rounded-[var(--sl-radius-lg)] border border-sl-border bg-sl-surface p-6 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-sl-accent-soft text-sl-accent">
                  <Terminal className="size-5" />
                </div>
                <div>
                  <h3 className="font-sl-display text-base font-bold text-sl-text">x402 Micro-payments (Base)</h3>
                  <p className="text-xs text-sl-text-muted">USDC on Base (chain 8453)</p>
                </div>
              </div>
              <p className="mt-4 text-xs text-sl-text-muted leading-relaxed">
                When an unauthenticated agent makes a request requiring payment, the gateway responds with HTTP 402
                containing signed settlement parameters. The agent signs the transaction and retries keylessly.
              </p>
              <div className="mt-4 rounded-md bg-sl-bg-raised p-3 text-xs font-sl-mono text-sl-text">
                <p>Bundle price: ${X402_BUNDLE.priceUsd.toFixed(2)}</p>
                <p className="mt-1 text-sl-text-muted">Includes {X402_BUNDLE.calls.toLocaleString()} RPC calls</p>
              </div>
            </div>

            <div className="rounded-[var(--sl-radius-lg)] border border-sl-border bg-sl-surface p-6 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-sl-accent-soft text-sl-accent">
                  <Wallet className="size-5" />
                </div>
                <div>
                  <h3 className="font-sl-display text-base font-bold text-sl-text">RevenueVaultV2 (Polygon PoS)</h3>
                  <p className="text-xs text-sl-text-muted">USDT on Polygon (chain 137)</p>
                </div>
              </div>
              <p className="mt-4 text-xs text-sl-text-muted leading-relaxed">
                Deposit USDT directly to the non-custodial smart contract vault. The on-chain deposit listener credits
                your API key after 25 block confirmations, unlocking flat-rate per-call metering.
              </p>
              <div className="mt-4 rounded-md bg-sl-bg-raised p-3 text-xs font-sl-mono text-sl-text">
                <p>Vault: 0x577D...BaCEF</p>
                <p className="mt-1 text-sl-text-muted">Rate: $0.00003 per Polygon RPC call</p>
              </div>
            </div>
          </div>

          <div className="mt-12">
            <h3 className="font-sl-display text-lg font-bold text-sl-text mb-4">Programmatic Rate Card</h3>
            <div className="overflow-x-auto rounded-[var(--sl-radius-lg)] border border-sl-border shadow-xs">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-sl-border bg-sl-bg-raised text-sl-text">
                    <th className="p-3 font-semibold">Product</th>
                    <th className="p-3 font-semibold">Unit</th>
                    <th className="p-3 font-semibold text-right">Price per Unit</th>
                    <th className="p-3 font-semibold">Payment Rail</th>
                  </tr>
                </thead>
                <tbody>
                  {AGENT_RATE_CARD.map((r) => (
                    <tr key={r.product} className="border-b border-sl-border/60 hover:bg-sl-bg-raised/40">
                      <td className="p-3 font-medium text-sl-text">{r.product}</td>
                      <td className="p-3 text-sl-text-muted">{r.unit}</td>
                      <td className="p-3 text-right font-sl-mono text-sl-text">
                        ${r.price < 0.001 ? r.price.toFixed(5) : r.price.toFixed(2)}
                      </td>
                      <td className="p-3 text-sl-text-muted">{r.rail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-sl-text-muted">
              <span>
                Machine discovery index available at{" "}
                <a href="/pricing.json" className="text-sl-accent underline font-mono">
                  /pricing.json
                </a>
              </span>
              <span>Automated settlement verified on-chain</span>
            </div>
          </div>
        </section>
      )}

      {/* Enterprise & Teams View */}
      {activeAudience === "enterprise" && (
        <section aria-labelledby="enterprise-heading" className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6">
          <div className="rounded-[var(--sl-radius-lg)] border border-sl-border bg-sl-surface p-8 md:p-12 shadow-sm">
            <div className="max-w-2xl">
              <span className="text-xs font-semibold uppercase tracking-wider text-sl-accent">
                Custom Architecture
              </span>
              <h2 id="enterprise-heading" className="mt-2 font-sl-display text-3xl font-bold text-sl-text">
                Enterprise & Large Deployments
              </h2>
              <p className="mt-3 text-sm text-sl-text-muted leading-relaxed">
                For organizations running mission-critical multi-agent systems, high-volume automated data pipelines, or
                teams requiring pooled BYOK governance, private tenant isolation, and custom SLAs.
              </p>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-3">
              <div className="rounded-lg border border-sl-border/60 bg-sl-bg-raised p-5">
                <Building2 className="size-5 text-sl-accent" />
                <h3 className="mt-3 text-sm font-semibold text-sl-text">Pooled BYOK Governance</h3>
                <p className="mt-1 text-xs text-sl-text-muted leading-relaxed">
                  Route organization-wide inference through your enterprise supplier contracts (AWS Bedrock, Azure
                  OpenAI, Google Vertex) with centralized spending limits and departmental attribution.
                </p>
              </div>

              <div className="rounded-lg border border-sl-border/60 bg-sl-bg-raised p-5">
                <Lock className="size-5 text-sl-accent" />
                <h3 className="mt-3 text-sm font-semibold text-sl-text">Security & SSO</h3>
                <p className="mt-1 text-xs text-sl-text-muted leading-relaxed">
                  SAML/OIDC Single Sign-On, SCIM directory synchronization, automated role-based access control (RBAC),
                  and immutable audit log streaming.
                </p>
              </div>

              <div className="rounded-lg border border-sl-border/60 bg-sl-bg-raised p-5">
                <Shield className="size-5 text-sl-accent" />
                <h3 className="mt-3 text-sm font-semibold text-sl-text">Dedicated SLA & Invoicing</h3>
                <p className="mt-1 text-xs text-sl-text-muted leading-relaxed">
                  Tailored uptime Service Level Agreements (SLAs), net-30 invoicing, custom statutory tax treatments, and
                  dedicated customer engineering support.
                </p>
              </div>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-4 border-t border-sl-border/60 pt-8">
              <button
                type="button"
                onClick={() => setShowEnterpriseModal(true)}
                className="inline-flex h-11 items-center justify-center rounded-[var(--sl-radius)] bg-sl-accent px-6 text-sm font-semibold text-sl-accent-ink hover:bg-sl-accent-strong transition-colors"
              >
                Request Enterprise Proposal
              </button>
              <a
                href="mailto:sales@satelink.network"
                className="inline-flex h-11 items-center justify-center rounded-[var(--sl-radius)] border border-sl-border px-5 text-sm font-medium text-sl-text hover:bg-sl-bg-raised transition-colors"
              >
                Email Sales Directly
              </a>
            </div>
          </div>
        </section>
      )}

      {/* FAQ Accordion Section */}
      <section aria-labelledby="faq-heading" className="border-t border-sl-border bg-sl-surface py-20">
        <div className="mx-auto max-w-[900px] px-4 sm:px-6">
          <div className="text-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-sl-accent">Got Questions?</span>
            <h2 id="faq-heading" className="mt-2 font-sl-display text-2xl font-bold text-sl-text sm:text-3xl">
              Frequently Asked Questions
            </h2>
            <p className="mt-2 text-sm text-sl-text-muted">
              Everything you need to know about Satelink billing, taxes, allowances, and payment rails.
            </p>
          </div>

          <div className="mt-10 space-y-3">
            {faqList.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={item.question}
                  className="rounded-[var(--sl-radius)] border border-sl-border bg-sl-surface overflow-hidden transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between p-4 text-left text-sm font-medium text-sl-text hover:bg-sl-bg-raised/40 transition-colors"
                    aria-expanded={isOpen}
                  >
                    <span>{item.question}</span>
                    {isOpen ? (
                      <ChevronUp className="size-4 shrink-0 text-sl-text-muted" />
                    ) : (
                      <ChevronDown className="size-4 shrink-0 text-sl-text-muted" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="border-t border-sl-border/40 bg-sl-bg-raised/20 p-4 text-xs leading-relaxed text-sl-text-muted">
                      {item.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Enterprise Inquiry Modal */}
      {showEnterpriseModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div className="relative w-full max-w-lg rounded-[var(--sl-radius-lg)] border border-sl-border bg-sl-surface p-6 shadow-2xl">
            <button
              type="button"
              aria-label="Close dialog"
              onClick={() => {
                setShowEnterpriseModal(false);
                setEnterpriseSubmitted(false);
              }}
              className="absolute top-4 right-4 text-sl-text-muted hover:text-sl-text"
            >
              ✕
            </button>

            {!enterpriseSubmitted ? (
              <>
                <h3 id="modal-title" className="font-sl-display text-xl font-bold text-sl-text">
                  Request an Enterprise Proposal
                </h3>
                <p className="mt-1 text-xs text-sl-text-muted">
                  Tell us about your team size, concurrency requirements, and preferred model routing setup.
                </p>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setEnterpriseSubmitted(true);
                  }}
                  className="mt-6 space-y-4"
                >
                  <div>
                    <label htmlFor="ent-name" className="block text-xs font-medium text-sl-text">
                      Full Name
                    </label>
                    <input
                      id="ent-name"
                      required
                      type="text"
                      value={entName}
                      onChange={(e) => setEntName(e.target.value)}
                      placeholder="Jane Doe"
                      className="mt-1 w-full rounded-md border border-sl-border bg-sl-bg-raised px-3 py-2 text-xs text-sl-text placeholder:text-sl-text-subtle focus:border-sl-accent focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label htmlFor="ent-email" className="block text-xs font-medium text-sl-text">
                      Work Email
                    </label>
                    <input
                      id="ent-email"
                      required
                      type="email"
                      value={entEmail}
                      onChange={(e) => setEntEmail(e.target.value)}
                      placeholder="jane@company.com"
                      className="mt-1 w-full rounded-md border border-sl-border bg-sl-bg-raised px-3 py-2 text-xs text-sl-text placeholder:text-sl-text-subtle focus:border-sl-accent focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label htmlFor="ent-org" className="block text-xs font-medium text-sl-text">
                      Organization / Company
                    </label>
                    <input
                      id="ent-org"
                      required
                      type="text"
                      value={entOrg}
                      onChange={(e) => setEntOrg(e.target.value)}
                      placeholder="Acme Corp"
                      className="mt-1 w-full rounded-md border border-sl-border bg-sl-bg-raised px-3 py-2 text-xs text-sl-text placeholder:text-sl-text-subtle focus:border-sl-accent focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label htmlFor="ent-workload" className="block text-xs font-medium text-sl-text">
                      Execution Requirements (Seats, Concurrency, Models)
                    </label>
                    <textarea
                      id="ent-workload"
                      rows={3}
                      value={entWorkload}
                      onChange={(e) => setEntWorkload(e.target.value)}
                      placeholder="e.g. 15 seats, 20 concurrent agent pipelines, BYOK with Bedrock..."
                      className="mt-1 w-full rounded-md border border-sl-border bg-sl-bg-raised px-3 py-2 text-xs text-sl-text placeholder:text-sl-text-subtle focus:border-sl-accent focus:outline-hidden"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      className="w-full rounded-[var(--sl-radius)] bg-sl-accent py-2.5 text-xs font-semibold text-sl-accent-ink hover:bg-sl-accent-strong transition-colors"
                    >
                      Submit Proposal Request
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="py-8 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-sl-accent-soft text-sl-accent">
                  <Check className="size-6" />
                </div>
                <h4 className="mt-4 font-sl-display text-lg font-bold text-sl-text">Enquiry Received</h4>
                <p className="mt-2 text-xs text-sl-text-muted leading-relaxed">
                  Thank you, {entName}. Our solutions team will review your requirements and reach out to {entEmail}{" "}
                  with a configured proposal.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowEnterpriseModal(false);
                    setEnterpriseSubmitted(false);
                  }}
                  className="mt-6 rounded-md border border-sl-border bg-sl-bg-raised px-4 py-2 text-xs font-medium text-sl-text hover:bg-sl-surface"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function renderTableCell(value: string | boolean) {
  if (value === true) {
    return <Check className="mx-auto size-4 text-sl-accent" aria-label="Included" />;
  }
  if (value === false) {
    return <Minus className="mx-auto size-4 text-sl-text-subtle" aria-label="Not included" />;
  }
  return <span className="font-sl-mono text-[11px] text-sl-text">{value}</span>;
}
