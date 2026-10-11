// Home (Phase 7) — Satelink Trading AI first, machine commerce second.
// hero (positioning + verbatim status line + beta CTA) → the loop (reason → validate → score →
// authorize → execute → learn) → GO / WAIT / REJECT → safety boundary → three interfaces →
// machine commerce → FAQ (+ FAQPage JSON-LD) → disclosures. The claims lint (strict tier) runs on
// this file: no numbers, no performance, partnership or availability claims.
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Brain, CheckCircle2, CircleSlash, Clock, CreditCard, FileCheck2, Globe, KeyRound, LineChart, PlugZap, Server, ShieldCheck, Terminal, Wallet } from "lucide-react";
import { buildMetadata, faqLd, jsonLdScript } from "@satelink/seo";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Disclosure } from "@/components/ui/Disclosure";
import DISCLAIMERS from "@/lib/trading-agent/disclaimers.json";

export const metadata: Metadata = buildMetadata({
  title: "Satelink Trading AI — an AI trading operating system for people, AI agents and machines",
  description:
    "Reason, validate, score, authorize, execute, learn. AI proposes; deterministic risk and your signed mandate decide. You keep custody. Paper trading in controlled beta. Live execution is not yet available.",
  path: "/",
});

const BETA_HREF = "/contact-sales?interest=beta";
const STATUS_LINE = "Paper trading in controlled beta. Live execution is not yet available.";

const LOOP = [
  { step: "Reason", icon: Brain, body: "Specialised AI agents read market structure, regime, risk and your portfolio, and explain what they see." },
  { step: "Validate", icon: FileCheck2, body: "A strategy is a versioned rule set, tested on history, walk-forward windows and stress scenarios — labelled hypothetical." },
  { step: "Score", icon: LineChart, body: "A deterministic scorecard gives GO, WAIT or REJECT with its evidence. A failed hard gate always wins over a high score." },
  { step: "Authorize", icon: KeyRound, body: "Nothing executes without a mandate you signed with a one-time code: which account, which instruments, how much." },
  { step: "Execute", icon: PlugZap, body: "Approved orders pass the risk engine, then the order manager sends each one once, through your broker." },
  { step: "Learn", icon: CheckCircle2, body: "Every decision, order and outcome is kept with one trace, so the next decision can be explained and reviewed." },
];

const DECISIONS = [
  { label: "GO", icon: CheckCircle2, className: "text-sl-settle", body: "Every hard gate passed and the score clears the bar. It can become a proposal for you to authorise." },
  { label: "WAIT", icon: Clock, className: "text-sl-warn", body: "Nothing is broken, but the evidence is not strong enough yet. No proposal is made." },
  { label: "REJECT", icon: CircleSlash, className: "text-sl-down", body: "A hard gate failed — stale data, thin liquidity, an expired mandate, too much concentration. No proposal is made." },
];

const BOUNDARY = [
  { title: "AI proposes", body: "The AI can read and suggest. It has no order-placing tool, never sees broker keys and cannot change risk limits or mandates." },
  { title: "Deterministic risk decides", body: "Every order is checked by fixed rules — kill switches, limits, data freshness, price collars. If a check cannot run, the order is refused." },
  { title: "Your signed mandate decides", body: "Orders must fit limits you signed with a one-time code. You can revoke a mandate or stop everything with one switch." },
  { title: "You keep custody", body: "Your money stays at your broker. Satelink never holds customer funds, and withdrawals are never enabled." },
];

const INTERFACES = [
  { name: "Web", icon: Globe, status: "Paper beta", body: "Talk to Satelink Trading AI: describe your capital, limits and markets, read the decision card, authorise a paper order." },
  { name: "API", icon: Terminal, status: "Not public yet", body: "The same core for software: evaluate an opportunity, receive GO / WAIT / REJECT as JSON, submit a proposal for review." },
  { name: "MCP", icon: Server, status: "Not public yet", body: "The same tools for AI agents, read and propose only, scoped by key, budgeted and metered." },
];

const MACHINE = [
  { name: "Machine Commerce", href: "/products/machine-commerce", icon: Wallet, line: "Discover a priced API, pay for it without a human, settle on-chain." },
  { name: "x402 Machine Payments", href: "/products/x402", icon: CreditCard, line: "HTTP-native, keyless pay-per-call in USDC on Base." },
  { name: "RPC Infrastructure", href: "/products/rpc", icon: Server, line: "Metered Polygon JSON-RPC at a flat per-call rate." },
];

const FAQ = [
  {
    question: "What is Satelink Trading AI?",
    answer:
      "An AI trading operating system for people, AI agents and machines. AI agents reason about markets, deterministic engines validate and score, and nothing executes unless the risk engine and a mandate you signed allow it.",
  },
  { question: "Is it live?", answer: STATUS_LINE },
  {
    question: "Does Satelink hold my money?",
    answer: "No. Your money stays at your broker. Satelink never takes custody of funds and withdrawals are never enabled.",
  },
  {
    question: "Can the AI place orders on its own?",
    answer:
      "No. The AI has no order-placing tool. It can propose; the deterministic risk engine and the limits in your signed mandate decide, and in the beta every paper order is authorised by a person.",
  },
  { question: "Is this investment advice?", answer: DISCLAIMERS.notAdvice },
];

export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(faqLd(FAQ)) }} />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-sl-border">
        <div className="sl-grad-hero pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-[1200px] px-4 py-20 sm:px-6 md:py-28">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-sl-accent">Satelink Trading AI</p>
          <h1 className="max-w-4xl font-sl-display text-balance font-normal leading-[1.05] tracking-[-0.02em] text-sl-text" style={{ fontSize: "var(--sl-display-1)" }}>
            An AI trading operating system for people, AI agents and machines.
          </h1>
          <p className="mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-sl-text-muted">
            Reason, validate, score, authorize, execute, learn. AI proposes; deterministic risk and your signed mandate decide; you keep custody.
          </p>
          <p className="mt-6"><Badge variant="planned">{STATUS_LINE}</Badge></p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href={BETA_HREF}>Request beta access <ArrowRight className="size-4" /></Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/trading-agent/how-it-works">How it works</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* The loop */}
      <section id="loop" className="mx-auto max-w-[1200px] px-4 py-20 sm:px-6 md:py-24">
        <SectionHeader eyebrow="One core" title="Reason, validate, score, authorize, execute, learn" lede="Every client — a person, an AI agent or a machine — goes through the same chain. Nothing skips a step." />
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LOOP.map((s) => (
            <li key={s.step}>
              <Card className="h-full">
                <s.icon aria-hidden className="mb-3 size-5 text-sl-accent" />
                <h3 className="font-semibold text-sl-text">{s.step}</h3>
                <p className="mt-2 text-sm leading-relaxed text-sl-text-muted">{s.body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      {/* GO / WAIT / REJECT */}
      <section id="decision" className="border-y border-sl-border bg-sl-bg-raised">
        <div className="mx-auto max-w-[1200px] px-4 py-20 sm:px-6 md:py-24">
          <SectionHeader eyebrow="The scorecard" title="GO, WAIT or REJECT — with the evidence" lede="The score describes decision quality, not a forecast of any outcome. A failed hard gate always overrides a high score." />
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {DECISIONS.map((d) => (
              <Card key={d.label} className="h-full">
                <p className={`flex items-center gap-2 font-semibold ${d.className}`}><d.icon aria-hidden className="size-5" /> {d.label}</p>
                <p className="mt-2 text-sm leading-relaxed text-sl-text-muted">{d.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Safety boundary */}
      <section id="safety" className="mx-auto max-w-[1200px] px-4 py-20 sm:px-6 md:py-24">
        <SectionHeader eyebrow="Safety boundary" title="AI proposes. Deterministic risk and your signed mandate decide." />
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {BOUNDARY.map((b) => (
            <Card key={b.title} className="h-full">
              <h3 className="flex items-center gap-2 font-semibold text-sl-text"><ShieldCheck aria-hidden className="size-4 text-sl-settle" /> {b.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-sl-text-muted">{b.body}</p>
            </Card>
          ))}
        </div>
        <p className="mt-6 text-sm"><Link href="/trading-agent/risk" className="text-sl-text underline underline-offset-4">Risk and how it is limited</Link></p>
      </section>

      {/* Three interfaces */}
      <section id="interfaces" className="border-y border-sl-border bg-sl-bg-raised">
        <div className="mx-auto max-w-[1200px] px-4 py-20 sm:px-6 md:py-24">
          <SectionHeader eyebrow="Three interfaces" title="Web for people. API and MCP for AI agents and machines." lede="Same core, same checks, same receipts — whichever way you connect." />
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {INTERFACES.map((i) => (
              <Card key={i.name} className="h-full">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 font-semibold text-sl-text"><i.icon aria-hidden className="size-5 text-sl-accent" /> {i.name}</h3>
                  <Badge variant="planned">{i.status}</Badge>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-sl-text-muted">{i.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Machine commerce */}
      <section id="machine-commerce" className="mx-auto max-w-[1200px] px-4 py-20 sm:px-6 md:py-24">
        <SectionHeader eyebrow="Machine commerce" title="Rails for software that pays software" lede="The payment and data infrastructure Satelink runs today, for developers and autonomous agents." />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {MACHINE.map((m) => (
            <Card key={m.name} interactive className="flex h-full flex-col">
              <m.icon aria-hidden className="mb-3 size-5 text-sl-machine" />
              <h3 className="font-semibold text-sl-text">{m.name}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-sl-text-muted">{m.line}</p>
              <Link href={m.href} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-sl-text hover:underline">
                Learn more <ArrowRight className="size-3.5" />
              </Link>
            </Card>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-[820px] px-4 pb-16 sm:px-6">
        <SectionHeader title="Frequently asked" align="left" />
        <div className="mt-8 space-y-3">
          {FAQ.map((f) => (
            <Disclosure key={f.question} title={f.question}>
              {f.answer}
            </Disclosure>
          ))}
        </div>
      </section>

      {/* Beta CTA + disclosures */}
      <section id="beta" className="mx-auto max-w-[1200px] px-4 pb-24 sm:px-6">
        <div className="rounded-[var(--sl-radius-lg)] border border-sl-border bg-sl-surface px-6 py-14 text-center">
          <Badge variant="planned" className="mx-auto">{STATUS_LINE}</Badge>
          <h2 className="mx-auto mt-4 max-w-xl text-balance font-sl-display text-3xl font-normal tracking-[-0.02em] text-sl-text sm:text-4xl">
            Join the paper-trading beta.
          </h2>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg"><Link href={BETA_HREF}>Request beta access</Link></Button>
            <Button asChild variant="secondary" size="lg"><Link href="/trading-agent">Read more</Link></Button>
          </div>
        </div>
        <div className="mx-auto mt-8 grid max-w-[820px] gap-3">
          <Disclosure title="Not investment advice">{DISCLAIMERS.notAdvice}</Disclosure>
          <Disclosure title="Independence">{DISCLAIMERS.noAffiliation}</Disclosure>
          <Disclosure title="AI disclosure">{DISCLAIMERS.aiCanBeWrong}</Disclosure>
        </div>
      </section>
    </>
  );
}
