import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageHero, formatDate } from "@/components/Page";
import { researchItems, type ResearchItem } from "@/content/research";

export const metadata: Metadata = {
  title: "Research & Protocol Specifications | Jakuraa",
  description:
    "Working papers, protocol specifications, and technical explorations by Jakuraa into machine-to-machine commerce, autonomous payment settlement, and distributed infrastructure.",
};

const categoryDescriptions: Record<string, string> = {
  Protocol: "Standardized communication and machine payment transaction standards.",
  "Smart Contracts": "Verifiable on-chain settlement, credit vault, and revenue custody mechanisms.",
  Economics: "Machine economic models, autonomous agent purchasing, and dynamic clearing.",
  Infrastructure: "Layer 2 scaling, RPC throughput, and fault-tolerant compute nodes.",
  Data: "Decentralized telemetry and market intelligence verification.",
  Systems: "Distributed architecture and resilience for autonomous agents.",
};

export default function ResearchPage() {
  const publishedPapers = researchItems.filter((i) => i.status === "published");
  const inProgressPapers = researchItems.filter((i) => i.status === "in-progress");
  const plannedPapers = researchItems.filter((i) => i.status === "planned");

  return (
    <div className="flex flex-col">
      <PageHero
        eyebrow="RESEARCH & PROTOCOLS"
        title="Technical specifications and working papers."
        lede={
          <p>
            Jakuraa conducts foundational systems research to power autonomous commerce.
            Our working papers examine standardized machine payments, on-chain vault custody,
            and high-throughput settlement across distributed agent networks.
          </p>
        }
      />

      {/* Overview Statistics Strip */}
      <section className="border-b border-stone-1 bg-ivory-2/60 py-6">
        <Container>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 font-mono text-xs">
            <div className="border-l border-stone-2 pl-4">
              <span className="text-stone-3">TOTAL PAPERS</span>
              <p className="mt-1 text-base font-semibold text-ink">{researchItems.length} Initiatives</p>
            </div>
            <div className="border-l border-stone-2 pl-4">
              <span className="text-stone-3">PUBLISHED PROTOCOLS</span>
              <p className="mt-1 text-base font-semibold text-green">{publishedPapers.length} Production</p>
            </div>
            <div className="border-l border-stone-2 pl-4">
              <span className="text-stone-3">IN DEVELOPMENT</span>
              <p className="mt-1 text-base font-semibold text-amber-ink">{inProgressPapers.length} Active</p>
            </div>
            <div className="border-l border-stone-2 pl-4">
              <span className="text-stone-3">PRIMARY DOMAIN</span>
              <p className="mt-1 text-base font-semibold text-ink">Machine Commerce</p>
            </div>
          </div>
        </Container>
      </section>

      {/* Main Research Catalog */}
      <Container className="py-16 sm:py-24">
        {/* Anchor point for Agent Settlement / Autonomous Finance */}
        <div id="autonomous-finance" className="scroll-mt-24">
          <div className="border-b border-stone-2 pb-4">
            <span className="font-mono text-xs uppercase tracking-wider text-green">SPECIFICATIONS & PRODUCTION CODE</span>
            <h2 className="mt-1 font-serif text-3xl text-ink">Published Working Papers</h2>
            <p className="mt-2 text-sm text-stone-4">
              Formal specifications deployed and tested in live production environments.
            </p>
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            {publishedPapers.map((paper) => (
              <article
                key={paper.slug}
                id={paper.slug}
                className="scroll-mt-24 rounded-2xl border border-stone-1 bg-ivory p-8 shadow-sm transition-all hover:border-green hover:shadow-md"
              >
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="rounded bg-green-soft px-2.5 py-1 text-green font-semibold uppercase">
                    {paper.category}
                  </span>
                  <span className="text-stone-3">
                    {paper.date ? formatDate(paper.date) : "Production"}
                  </span>
                </div>

                <h3 className="mt-4 font-serif text-2xl text-ink">
                  {paper.title}
                </h3>

                <p className="mt-3 text-sm leading-relaxed text-stone-4">
                  {paper.summary}
                </p>

                <div className="mt-6 border-t border-stone-1 pt-4 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-stone-3">Status: Live standard</span>
                    <a
                      href="https://satelink.network"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-green hover:underline inline-flex items-center gap-1"
                    >
                      <span>View implementation</span>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor">
                        <path d="M2.5 9.5L9.5 2.5M9.5 2.5V8.5M9.5 2.5H3.5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* Anchor point for Network Telemetry & Distributed Infrastructure */}
        <div id="distributed-telemetry" className="mt-20 scroll-mt-24">
          <div className="border-b border-stone-2 pb-4">
            <span className="font-mono text-xs uppercase tracking-wider text-amber-ink">ACTIVE RESEARCH</span>
            <h2 className="mt-1 font-serif text-3xl text-ink">In-Progress Studies & Benchmarks</h2>
            <p className="mt-2 text-sm text-stone-4">
              Current investigations in network telemetry, Layer 2 throughput, and latency bounds.
            </p>
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            {inProgressPapers.map((paper) => (
              <article
                key={paper.slug}
                id={paper.slug}
                className="scroll-mt-24 rounded-2xl border border-stone-1 bg-ivory p-8 shadow-sm transition-all hover:border-amber hover:shadow-md"
              >
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="rounded bg-amber-soft px-2.5 py-1 text-amber-ink font-semibold uppercase">
                    {paper.category}
                  </span>
                  <span className="text-stone-3 font-mono">In Progress</span>
                </div>

                <h3 className="mt-4 font-serif text-2xl text-ink">
                  {paper.title}
                </h3>

                <p className="mt-3 text-sm leading-relaxed text-stone-4">
                  {paper.summary}
                </p>

                <div className="mt-6 border-t border-stone-1 pt-4 text-xs text-stone-3">
                  <span>Theoretical modeling and empirical testnet benchmarking underway.</span>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* Anchor point for Dynamic Pricing & Machine Economics */}
        <div id="market-clearing" className="mt-20 scroll-mt-24">
          <div className="border-b border-stone-2 pb-4">
            <span className="font-mono text-xs uppercase tracking-wider text-stone-3">FUTURE AGENDA</span>
            <h2 className="mt-1 font-serif text-3xl text-ink">Planned Research Initiatives</h2>
            <p className="mt-2 text-sm text-stone-4">
              Long-term research roadmap covering autonomous swarm coordination and machine micro-economics.
            </p>
          </div>

          <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {plannedPapers.map((paper) => (
              <article
                key={paper.slug}
                id={paper.slug}
                className="scroll-mt-24 rounded-2xl border border-stone-1 bg-ivory-2/40 p-6 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="rounded bg-stone-1 px-2 py-0.5 text-stone-4 uppercase text-[11px]">
                      {paper.category}
                    </span>
                    <span className="text-stone-3">Planned</span>
                  </div>

                  <h3 className="mt-4 font-serif text-xl text-ink">
                    {paper.title}
                  </h3>

                  <p className="mt-2.5 text-sm leading-relaxed text-stone-4">
                    {paper.summary}
                  </p>
                </div>

                <div className="mt-6 border-t border-stone-1/80 pt-3 text-[11px] font-mono text-stone-3">
                  Scope: {categoryDescriptions[paper.category] || "Systems research"}
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* Institutional Disclosure Box */}
        <div className="mt-20 rounded-2xl border border-stone-2 bg-ivory-2 p-8 sm:p-10">
          <div className="max-w-3xl">
            <span className="font-mono text-xs uppercase tracking-wider text-green font-semibold">
              RESEARCH GOVERNANCE & OPEN STANDARDS
            </span>
            <h3 className="mt-2 font-serif text-2xl text-ink">
              Reproducible Protocols for the Machine Economy
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-stone-4">
              All research conducted by Jakuraa is designed for real-world deployment on public,
              verifiable infrastructure. We prioritize formal open specifications, minimal trust
              assumptions, and deterministic settlement over proprietary closed networks.
            </p>
            <div className="mt-6 flex flex-wrap gap-4 text-xs font-mono">
              <Link
                href="/technology"
                className="inline-flex items-center gap-1 text-green hover:underline font-semibold"
              >
                <span>Read Technology Architecture</span>
                <span>→</span>
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-1 text-stone-4 hover:text-ink hover:underline"
              >
                <span>Submit Technical Inquiry</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
