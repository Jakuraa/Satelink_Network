import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageHero, SectionHeading } from "@/components/Page";

export const metadata: Metadata = {
  title: "Careers & Engineering Disciplines | Jakuraa & Satelink",
  description:
    "Engineering, research, and operating roles across Jakuraa Commercial and the Satelink machine-commerce platform.",
};

const jakuraaDisciplines = [
  {
    area: "Corporate Operations & Strategy",
    desc: "Overseeing statutory compliance, inter-entity commercial structuring, capital management, and physical-to-digital domain bridging.",
    contact: "careers@jakuraa.com",
  },
  {
    area: "Quantitative Systems & Applied Research",
    desc: "Developing algorithmic market models, orderbook microstructure simulations, and programmatic trade execution telemetry.",
    contact: "careers@jakuraa.com",
  },
  {
    area: "Statutory Governance & Compliance",
    desc: "Managing regulatory filings, DGFT international trade compliance, GSTIN statutory accounting, and corporate legal administration.",
    contact: "careers@jakuraa.com",
  },
];

const satelinkDisciplines = [
  {
    area: "AI-Agent & Protocol Engineering",
    desc: "Architecting machine-to-machine payment protocols, HTTP 402 header negotiation rails, and non-custodial cryptographic verification.",
    contact: "careers@satelink.network",
  },
  {
    area: "AI Trading Systems & Microstructure",
    desc: "Building low-latency inference loops, deterministic nonce sequencers, and automated decentralized liquidity routing engines.",
    contact: "careers@satelink.network",
  },
  {
    area: "Smart Contract & Vault Infrastructure",
    desc: "Designing and auditing EVM smart contracts (Base USDC x402, Polygon PoS RevenueVaultV2), gas optimization, and permissionless accounting.",
    contact: "careers@satelink.network",
  },
  {
    area: "MCP & Developer Connectivity",
    desc: "Engineering Model Context Protocol (MCP) tool-calling context servers, zero-dependency SDKs, and streaming REST/WebSocket gateways.",
    contact: "careers@satelink.network",
  },
  {
    area: "Distributed Cloud & Network Reliability",
    desc: "Operating resilient RPC clusters, real-time telemetry pipelines, sub-second metering engines, and high-availability gateway nodes.",
    contact: "careers@satelink.network",
  },
];

const principles: [string, string][] = [
  ["Work that is real", "You will work on systems that exist, process live transactions, and are battle-tested against real economic friction."],
  ["Small and accountable", "We operate small, high-density teams. Engineers and operators own outcomes end to end from design to deployment."],
  ["Written first", "Architecture decisions, protocol trade-offs, and failure postmortems are documented clearly so anyone can audit the reasoning."],
  ["Zero credentialism", "We value verifiable code, deployed smart contracts, running servers, and operational grit over pedigree or credentials."],
];

const process: [string, string][] = [
  ["Written Note", "Send a concise summary of a system you have engineered, operated, or debugged, and why you want to build with us."],
  ["Systems Conversation", "A technical deep-dive into real architectural trade-offs, concurrency, or economic mechanics with our systems builder."],
  ["Practical Work Exercise", "A focused, compensated practical problem that closely mirrors actual daily engineering challenges."],
  ["Decision & Offer", "A straightforward outcome with transparent terms, clear ownership boundaries, and direct institutional alignment."],
];

const faq: [string, string][] = [
  ["Where are the teams located?", "Jakuraa Commercial is registered and headquartered in Coimbatore, Tamil Nadu, India. Satelink operates a hybrid and distributed engineering model depending on role requirements."],
  ["What is the difference between Jakuraa and Satelink roles?", "Jakuraa encompasses corporate governance, multi-domain operations, quantitative research, and institutional administration. Satelink focuses specifically on AI-agent protocol rails, trading engines, smart contracts, and cloud infrastructure."],
  ["Can I submit a speculative application?", "Yes. If your capabilities align with our technical disciplines, write to careers@jakuraa.com or careers@satelink.network with your work and code repositories."],
  ["Will you ever ask candidates for money?", "No. Jakuraa and Satelink never ask candidates for fees, security deposits, or payments at any stage of hiring. Treat any such request as fraudulent."],
];

export default function CareersPage() {
  return (
    <main className="min-h-screen bg-ivory text-ink">
      <PageHero
        eyebrow="CAREERS & TALENT"
        title="Build things that are true."
        lede={
          <p>
            We hire rarely, deliberately, and with high accountability. Explore our engineering disciplines
            across Jakuraa and Satelink.
          </p>
        }
      />

      {/* Institutional Hiring Status Banner (Honest, Unfabricated) */}
      <section className="border-t border-stone-1 py-12 bg-ivory-2/60">
        <Container>
          <div className="rounded-2xl border border-stone-2 bg-ivory p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-1 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="size-2 rounded-full bg-stone-3" />
                <span className="font-mono text-xs font-semibold uppercase text-stone-4 tracking-wider">
                  ACTIVE HIRING POSTURE
                </span>
              </div>
              <span className="rounded-full bg-stone-1 px-3 py-1 font-mono text-[11px] text-stone-4">
                No active open requisitions
              </span>
            </div>

            <div className="mt-4 grid gap-6 sm:grid-cols-12 sm:items-center">
              <div className="sm:col-span-8">
                <h3 className="font-serif text-xl sm:text-2xl text-ink">
                  We are not actively advertising open roles today.
                </h3>
                <p className="mt-2 text-sm text-stone-4 font-sans leading-relaxed">
                  We periodically open deliberate requisitions for exceptional protocol engineers, quantitative systems builders,
                  and infrastructure operators. When specific roles open, they are published directly here. In the interim,
                  we welcome speculative notes from individuals with a demonstrated track record of building resilient systems.
                </p>
              </div>

              <div className="sm:col-span-4 flex flex-col gap-2.5 sm:border-l sm:border-stone-1 sm:pl-6">
                <span className="font-mono text-xs text-stone-3 uppercase">SPECULATIVE APPLICATIONS</span>
                <a
                  href="mailto:careers@satelink.network"
                  className="font-mono text-xs text-green hover:underline font-medium"
                >
                  careers@satelink.network (Satelink) →
                </a>
                <a
                  href="mailto:careers@jakuraa.com"
                  className="font-mono text-xs text-stone-4 hover:text-ink hover:underline font-medium"
                >
                  careers@jakuraa.com (Jakuraa) →
                </a>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Employer Tracks: Jakuraa vs Satelink */}
      <section className="py-20 border-t border-stone-1">
        <Container>
          <div className="max-w-2xl">
            <span className="font-mono text-xs uppercase tracking-wider text-green font-semibold">
              EMPLOYER IDENTITY & TRACKS
            </span>
            <h2 className="mt-2 font-serif text-3xl sm:text-4xl text-ink">
              Two organizations, shared engineering rigor.
            </h2>
            <p className="mt-3 text-base text-stone-4 font-sans leading-relaxed">
              Understand the distinction between working on Jakuraa corporate and operational systems
              versus engineering the Satelink machine-commerce platform.
            </p>
          </div>

          <div className="mt-14 grid gap-12 lg:grid-cols-2">
            {/* Track 1: CAREERS AT SATELINK */}
            <div className="rounded-2xl border border-stone-2 bg-ivory p-8 shadow-sm space-y-6">
              <div className="border-b border-stone-1 pb-4">
                <span className="rounded bg-green/10 px-2.5 py-1 font-mono text-[10px] uppercase font-semibold text-green">
                  FLAGSHIP TECHNOLOGY PLATFORM
                </span>
                <h3 className="mt-3 font-serif text-2xl text-ink">
                  Engineering at Satelink
                </h3>
                <p className="mt-2 text-sm text-stone-4 font-sans leading-relaxed">
                  Focuses on autonomous software rails, AI-agent machine commerce, HTTP 402 micro-payments,
                  and low-latency EVM smart contract settlements.
                </p>
              </div>

              <div className="space-y-4">
                <span className="font-mono text-xs text-stone-3 uppercase block">CORE DISCIPLINES</span>
                {satelinkDisciplines.map((d) => (
                  <div key={d.area} className="rounded-xl border border-stone-1 bg-ivory-2/40 p-4">
                    <h4 className="font-serif text-base text-ink">{d.area}</h4>
                    <p className="mt-1 text-xs text-stone-4 font-sans leading-relaxed">{d.desc}</p>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-stone-1 flex items-center justify-between text-xs font-mono">
                <span className="text-stone-3">DIRECT CONTACT</span>
                <a href="mailto:careers@satelink.network" className="text-green hover:underline font-medium">
                  careers@satelink.network →
                </a>
              </div>
            </div>

            {/* Track 2: CAREERS AT JAKURAA */}
            <div className="rounded-2xl border border-stone-2 bg-ivory p-8 shadow-sm space-y-6">
              <div className="border-b border-stone-1 pb-4">
                <span className="rounded bg-ivory-2 px-2.5 py-1 font-mono text-[10px] uppercase text-stone-4">
                  CORPORATE TECHNOLOGY INSTITUTION
                </span>
                <h3 className="mt-3 font-serif text-2xl text-ink">
                  Careers at Jakuraa
                </h3>
                <p className="mt-2 text-sm text-stone-4 font-sans leading-relaxed">
                  Focuses on corporate governance, quantitative research, statutory administration,
                  international trade operations, and long-term capital allocation.
                </p>
              </div>

              <div className="space-y-4">
                <span className="font-mono text-xs text-stone-3 uppercase block">CORE DISCIPLINES</span>
                {jakuraaDisciplines.map((d) => (
                  <div key={d.area} className="rounded-xl border border-stone-1 bg-ivory-2/40 p-4">
                    <h4 className="font-serif text-base text-ink">{d.area}</h4>
                    <p className="mt-1 text-xs text-stone-4 font-sans leading-relaxed">{d.desc}</p>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-stone-1 flex items-center justify-between text-xs font-mono">
                <span className="text-stone-3">DIRECT CONTACT</span>
                <a href="mailto:careers@jakuraa.com" className="text-green hover:underline font-medium">
                  careers@jakuraa.com →
                </a>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Operating Principles */}
      <section className="border-t border-stone-1 py-20 bg-ivory-2/30">
        <Container>
          <SectionHeading title="How we work" />
          <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {principles.map(([t, b]) => (
              <div key={t} className="rounded-xl border border-stone-1 bg-ivory p-6 shadow-sm">
                <h3 className="font-serif text-xl text-ink">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-4 font-sans">{b}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Hiring Process */}
      <section className="border-t border-stone-1 py-20">
        <Container>
          <SectionHeading title="Evaluation process" />
          <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {process.map(([t, b], i) => (
              <li key={t} className="border-t-2 border-green pt-5">
                <p className="font-mono text-xs text-green font-semibold">STAGE 0{i + 1}</p>
                <h3 className="mt-1 font-serif text-xl text-ink">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-4 font-sans">{b}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* Questions & Anti-Fraud Notice */}
      <section className="border-t border-stone-1 py-20 bg-ivory">
        <Container>
          <SectionHeading title="Frequently asked questions" />
          <div className="mt-8 max-w-3xl divide-y divide-stone-1 border-y border-stone-1">
            {faq.map(([q, a]) => (
              <details key={q} className="group py-5">
                <summary className="flex cursor-pointer items-center justify-between gap-4 font-serif text-xl text-ink">
                  {q}
                  <span aria-hidden="true" className="text-stone-3 transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-stone-4 font-sans">{a}</p>
              </details>
            ))}
          </div>

          <div className="mt-12 rounded-xl border border-amber-ink/20 bg-amber-ink/5 p-4 font-mono text-xs text-stone-4 max-w-3xl">
            <span className="text-amber-ink font-semibold uppercase">SECURITY & INTEGRITY NOTICE: </span>
            Jakuraa Commercial and Satelink will never solicit recruitment fees, processing deposits, or monetary transactions from job applicants. Official communications originate strictly from verified @jakuraa.com and @satelink.network domains.
          </div>
        </Container>
      </section>
    </main>
  );
}
