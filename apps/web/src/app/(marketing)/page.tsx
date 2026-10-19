// Home — Satelink: AI-agent and machine-commerce infrastructure.
// hero (positioning + verbatim status line + docs / beta CTA) → the 7-step lifecycle →
// GO / WAIT / REJECT → safety boundary → three interfaces → active services →
// product assistance visuals (402 sequence & rails) → video showcase → FAQ (+ FAQPage JSON-LD) → disclosures.
// The claims lint (strict tier) runs on this file: no unlabelled numbers, no performance,
// partnership or availability claims.
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Brain, CheckCircle2, CircleSlash, Clock, CreditCard, FileCheck2, Globe, KeyRound, LineChart, PlugZap, Server, ShieldCheck, Terminal, Wallet, Sparkles } from "lucide-react";
import { buildMetadata, faqLd, jsonLdScript } from "@satelink/seo";
import { ScrollReveal, Stagger, StaggerItem, HoverLift } from "@satelink/web-ui";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Disclosure } from "@/components/ui/Disclosure";
import { ScrollLifecycleStory } from "@/components/home/ScrollLifecycleStory";
import { CinematicVideoSection } from "@/components/home/CinematicVideoSection";
import { FAQView, FAQItem } from "@/components/faq/FAQView";
import DISCLAIMERS from "@/lib/trading-agent/disclaimers.json";

export const metadata: Metadata = buildMetadata({
  title: "Satelink — Infrastructure for AI agents that discover and use digital services",
  description:
    "Programmatic infrastructure for AI agents and automated systems to discover services, evaluate options, and access APIs through controlled, machine-readable workflows.",
  path: "/",
});

const BETA_HREF = "/contact-sales?interest=beta";
const STATUS_LINE = "Paper trading in controlled beta. Live execution is not yet available.";

const LOOP = [
  { step: "1. Understand", icon: Brain, body: "The agent analyzes its goal, identifying required digital capabilities, payload parameters, and execution constraints." },
  { step: "2. Discover", icon: Globe, body: "The caller queries service directories, machine catalogues (/.well-known/satelink.json), or MCP tools to identify providers." },
  { step: "3. Compare", icon: FileCheck2, body: "The agent checks service specs, unit costs, latency, authentication schemes, and quota terms against budget limits." },
  { step: "4. Select", icon: KeyRound, body: "A specific service and provider are chosen, verifying operational availability and eligibility before calling." },
  { step: "5. Authorize", icon: ShieldCheck, body: "Access is authorized keylessly via HTTP 402 on Base (USDC), scoped API keys, or user-signed deterministic mandates." },
  { step: "6. Execute", icon: Server, body: "The permitted request routes through authenticated gateways or keyless RPC proxies, returning the workload result." },
  { step: "7. Meter & Reconcile", icon: LineChart, body: "Usage is metered at flat per-call rates, deducting from prepaid balances or settling on-chain to RevenueVault on Polygon." },
];

const DECISIONS = [
  { label: "GO", icon: CheckCircle2, className: "text-sl-settle", body: "Every hard gate passed and quotas clear. The proposal or request proceeds through verification." },
  { label: "WAIT", icon: Clock, className: "text-sl-warn", body: "Conditions are not met or evidence is incomplete. No action or spend is initiated." },
  { label: "REJECT", icon: CircleSlash, className: "text-sl-down", body: "A hard gate failed — stale data, a spending limit exceeded, or an expired mandate. The request fails closed." },
];

const BOUNDARY = [
  { title: "AI proposes", body: "Autonomous models can read context and suggest actions, but have no authority to place orders or exceed limits on their own." },
  { title: "Deterministic risk decides", body: "Every action is checked by fixed rules — kill switches, spending caps, data freshness, and price collars." },
  { title: "Your signed mandate decides", body: "Operations run within explicit parameters authenticated by one-time codes. You can revoke a mandate or pause everything at once." },
  { title: "You keep custody", body: "Your money stays at your broker or wallet. Satelink never holds customer funds, and withdrawals are never enabled." },
];

const INTERFACES = [
  { name: "Web", icon: Globe, status: "Live", body: "Manage keys, configure spending limits, review transaction receipts, and explore the service catalogue." },
  { name: "API", icon: Terminal, status: "Live", body: "Programmatic service discovery, metered Polygon JSON-RPC, and Trading Intelligence endpoints over HTTP." },
  { name: "MCP", icon: Server, status: "Not public yet", body: "Model Context Protocol tools for AI agents to discover resources, evaluate data, and propose actions." },
];

const MACHINE = [
  { name: "Machine Commerce", href: "/products/machine-commerce", icon: Wallet, line: "Discover a priced API, pay for it without a human, and settle on-chain." },
  { name: "x402 Machine Payments", href: "/products/x402", icon: CreditCard, line: "HTTP-native, keyless pay-per-call payments in USDC on Base." },
  { name: "RPC Infrastructure", href: "/products/rpc", icon: Server, line: "Metered Polygon JSON-RPC at a flat per-call rate." },
];

const HOME_FAQS: FAQItem[] = [
  {
    category: "Platform",
    question: "What is Satelink?",
    answer:
      "Satelink is programmatic infrastructure for AI agents and automated systems to discover digital services, evaluate options, and access APIs through controlled, machine-readable workflows. It is operated by Jakuraa Commercial Private Limited.",
  },
  {
    category: "Platform",
    question: "Who is Satelink for?",
    answer:
      "Satelink serves AI agent developers building autonomous workflows, software teams requiring pay-per-call infrastructure, quantitative researchers, and enterprises requiring auditable API procurement.",
  },
  {
    category: "Machine Commerce",
    question: "What is the role of machine commerce?",
    answer:
      "Machine commerce is software paying software for services. Satelink provides the rails a machine uses to discover a priced API, pay for it programmatically without human checkout, and settle on-chain with verifiable receipts.",
  },
  {
    category: "Machine Commerce",
    question: "What is agent procurement?",
    answer:
      "Agent procurement is the automated discovery, evaluation, authorization, access, metering, payment, and settlement for digital services by software agents. Satelink provides machine-readable specifications and payment rails that allow autonomous systems to procure supported APIs programmatically.",
  },
  {
    category: "Trading AI Beta",
    question: "Where does Trading AI fit?",
    answer:
      "Satelink Trading AI is the first intended application built on the platform. It follows a loop where AI agents propose suggestions, while deterministic risk engines and signed mandates decide. It is currently in controlled paper-trading beta; live execution is not yet available.",
  },
  {
    category: "RPC Services",
    question: "Where does RPC infrastructure fit?",
    answer:
      "Blockchain RPC is one active production service running on Satelink today. It provides metered Polygon PoS JSON-RPC access at a flat per-call rate, payable via prepaid credits or keylessly with x402.",
  },
  {
    category: "Developers",
    question: "What can developers do today?",
    answer:
      "Developers can query the public machine catalogue (/.well-known/satelink.json), make metered Polygon RPC calls, pay keylessly via x402 on Base, and consume derived market analytics via the Trading Intelligence API.",
  },
  {
    category: "Security",
    question: "Does Satelink hold my money?",
    answer:
      "No. Satelink is non-custodial. Broker funds remain with your broker, and withdrawals are never enabled. Machine payments execute directly via user-funded wallets or prepaid credit vaults.",
  },
  { category: "Security", question: "Is this investment advice?", answer: DISCLAIMERS.notAdvice },
];

export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(faqLd(HOME_FAQS)) }} />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-sl-border">
        <div className="sl-grad-hero pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-[1200px] px-4 py-20 sm:px-6 md:py-28">
          <ScrollReveal y={8}>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-sl-accent">
              AI-Agent &amp; Machine-Commerce Infrastructure
            </p>
          </ScrollReveal>

          <ScrollReveal delay={50} y={12}>
            <h1
              className="max-w-4xl font-sl-display text-balance font-normal leading-[1.05] tracking-[-0.02em] text-sl-text"
              style={{ fontSize: "var(--sl-display-1)" }}
            >
              Infrastructure for AI agents that discover and use digital services.
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={100} y={12}>
            <p className="mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-sl-text-muted">
              Satelink is programmatic infrastructure for AI agents and automated systems to discover services, evaluate options, and access APIs through controlled, machine-readable workflows. Built by Jakuraa.
            </p>
          </ScrollReveal>

          <ScrollReveal delay={150} y={8}>
            <p className="mt-6">
              <Badge variant="planned">{STATUS_LINE}</Badge>
            </p>
          </ScrollReveal>

          <ScrollReveal delay={200} y={8}>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="https://docs.satelink.network">
                  Explore documentation <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href={BETA_HREF}>Request beta access</Link>
              </Button>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* 7-Step Programmatic workflow loop — Scroll-Linked Storytelling */}
      <section id="loop" className="border-b border-sl-border bg-sl-bg">
        <div className="mx-auto max-w-[1200px] px-4 pt-20 pb-4 sm:px-6 md:pt-24">
          <ScrollReveal>
            <SectionHeader
              eyebrow="Agent procurement lifecycle"
              title="The 7-Step Agent Procurement Lifecycle"
              lede="Discover, evaluate, authorize, access, meter, pay, settle: Every software agent operates through controlled, machine-readable steps."
            />
          </ScrollReveal>
        </div>

        <ScrollLifecycleStory />
      </section>

      {/* Cinematic HD Video & Technical Product Media */}
      <section id="cinematic-showcase" className="border-y border-sl-border bg-sl-bg-raised">
        <div className="mx-auto max-w-[1200px] px-4 py-20 sm:px-6 md:py-24">
          <ScrollReveal>
            <SectionHeader
              eyebrow="Technical demonstrations & media"
              title="Cinematic Product Experience & Protocol Standards"
              lede="Curated high-definition independent reviews, protocol demonstrations, and interactive interaction stages powering autonomous API procurement."
            />
          </ScrollReveal>

          <div className="mt-12">
            <ScrollReveal delay={80}>
              <CinematicVideoSection />
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* GO / WAIT / REJECT */}
      <section id="decision" className="border-y border-sl-border bg-sl-bg-raised">
        <div className="mx-auto max-w-[1200px] px-4 py-20 sm:px-6 md:py-24">
          <ScrollReveal>
            <SectionHeader
              eyebrow="Control boundary"
              title="GO, WAIT or REJECT — verifiable gates for every agent action"
              lede="Whether executing market analysis or procuring an upstream API, deterministic hard gates verify budget, freshness and authorization before any action occurs."
            />
          </ScrollReveal>

          <Stagger step={0.08} className="mt-10 grid gap-4 md:grid-cols-3">
            {DECISIONS.map((d) => (
              <StaggerItem key={d.label} className="h-full">
                <HoverLift className="h-full">
                  <Card className="h-full">
                    <p className={`flex items-center gap-2 font-semibold ${d.className}`}>
                      <d.icon aria-hidden className="size-5" /> {d.label}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-sl-text-muted">{d.body}</p>
                  </Card>
                </HoverLift>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Safety boundary */}
      <section id="safety" className="mx-auto max-w-[1200px] px-4 py-20 sm:px-6 md:py-24">
        <ScrollReveal>
          <SectionHeader eyebrow="Safety boundary" title="AI proposes. Deterministic risk and your signed mandate decide." />
        </ScrollReveal>

        <Stagger step={0.06} className="mt-10 grid gap-4 sm:grid-cols-2">
          {BOUNDARY.map((b) => (
            <StaggerItem key={b.title} className="h-full">
              <Card className="h-full">
                <h3 className="flex items-center gap-2 font-semibold text-sl-text">
                  <ShieldCheck aria-hidden className="size-4 text-sl-settle" /> {b.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-sl-text-muted">{b.body}</p>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
        <p className="mt-6 text-sm">
          <Link href="/trading-agent/risk" className="text-sl-text underline underline-offset-4">
            Risk and how it is limited
          </Link>
        </p>
      </section>

      {/* Three interfaces */}
      <section id="interfaces" className="border-y border-sl-border bg-sl-bg-raised">
        <div className="mx-auto max-w-[1200px] px-4 py-20 sm:px-6 md:py-24">
          <ScrollReveal>
            <SectionHeader
              eyebrow="Three interfaces"
              title="Web for people. API and MCP for AI agents and machines."
              lede="Same core, same checks, same receipts — whichever way you connect."
            />
          </ScrollReveal>

          <Stagger step={0.08} className="mt-10 grid gap-4 md:grid-cols-3">
            {INTERFACES.map((i) => (
              <StaggerItem key={i.name} className="h-full">
                <HoverLift className="h-full">
                  <Card className="h-full">
                    <div className="flex items-center justify-between">
                      <h3 className="flex items-center gap-2 font-semibold text-sl-text">
                        <i.icon aria-hidden className="size-5 text-sl-accent" /> {i.name}
                      </h3>
                      <Badge variant={i.status === "Live" ? "live" : "planned"}>{i.status}</Badge>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-sl-text-muted">{i.body}</p>
                  </Card>
                </HoverLift>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Machine commerce */}
      <section id="machine-commerce" className="mx-auto max-w-[1200px] px-4 py-20 sm:px-6 md:py-24">
        <ScrollReveal>
          <SectionHeader
            eyebrow="Active services"
            title="Infrastructure running today on Satelink"
            lede="The payment, data and execution infrastructure Satelink runs today, for developers and autonomous agents."
          />
        </ScrollReveal>

        <Stagger step={0.08} className="mt-10 grid gap-4 md:grid-cols-3">
          {MACHINE.map((m) => (
            <StaggerItem key={m.name} className="h-full">
              <HoverLift className="h-full">
                <Card interactive className="flex h-full flex-col">
                  <m.icon aria-hidden className="mb-3 size-5 text-sl-machine" />
                  <h3 className="font-semibold text-sl-text">{m.name}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-sl-text-muted">{m.line}</p>
                  <Link href={m.href} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-sl-text hover:underline">
                    Learn more <ArrowRight className="size-3.5" />
                  </Link>
                </Card>
              </HoverLift>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-[1000px] px-4 py-20 sm:px-6">
        <ScrollReveal>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <span className="font-sl-mono text-xs uppercase tracking-wider text-sl-accent font-semibold">
                Questions &amp; Answers
              </span>
              <h2 className="mt-1 font-sl-display text-3xl sm:text-4xl font-normal text-sl-text">
                Frequently asked questions
              </h2>
            </div>
            <Link
              href="/faq"
              className="inline-flex items-center gap-1 font-sl-mono text-xs text-sl-accent hover:underline font-semibold"
            >
              <span>Explore all 20+ questions across all categories</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </ScrollReveal>

        <FAQView items={HOME_FAQS} />
      </section>

      {/* Beta CTA + disclosures */}
      <section id="beta" className="mx-auto max-w-[1200px] px-4 pb-24 sm:px-6">
        <ScrollReveal>
          <div className="rounded-[var(--sl-radius-lg)] border border-sl-border bg-sl-surface px-6 py-14 text-center">
            <Badge variant="planned" className="mx-auto">
              {STATUS_LINE}
            </Badge>
            <h2 className="mx-auto mt-4 max-w-xl text-balance font-sl-display text-3xl font-normal tracking-[-0.02em] text-sl-text sm:text-4xl">
              Build on Satelink machine-commerce infrastructure.
            </h2>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link href={BETA_HREF}>Request beta access</Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="/trading-agent">Trading AI overview</Link>
              </Button>
            </div>
          </div>
        </ScrollReveal>

        <div className="mx-auto mt-8 grid max-w-[820px] gap-3">
          <Disclosure title="Not investment advice">{DISCLAIMERS.notAdvice}</Disclosure>
          <Disclosure title="Independence">{DISCLAIMERS.noAffiliation}</Disclosure>
          <Disclosure title="AI disclosure">{DISCLAIMERS.aiCanBeWrong}</Disclosure>
        </div>
      </section>
    </>
  );
}
