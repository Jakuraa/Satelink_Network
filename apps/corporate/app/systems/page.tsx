import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageHero } from "@/components/Page";
import { systems } from "@/content/systems";
import { businesses } from "@/content/businesses";
import { StatusBadge } from "@/components/StatusBadge";
import { Illustration } from "@/components/Illustration";

export const metadata: Metadata = {
  title: "Systems & Architecture | Jakuraa",
  description:
    "An architectural overview of Jakuraa's systems across autonomous software, machine commerce, financial settlements, and industrial technology.",
};

export default function SystemsPage() {
  return (
    <div className="flex flex-col">
      <PageHero
        eyebrow="SYSTEMS ARCHITECTURE"
        title="Engineered systems across digital and physical domains."
        lede={
          <p>
            Jakuraa develops high-reliability systems designed to withstand real-world friction.
            From autonomous agent settlement to distributed data metering and industrial manufacturing,
            each system represents a specific domain of capability.
          </p>
        }
      />

      {/* Systems Status Bar */}
      <section className="border-b border-stone-1 bg-ivory-2/60 py-6">
        <Container>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 font-mono text-xs">
            <div className="border-l border-stone-2 pl-4">
              <span className="text-stone-3">CORE SYSTEMS</span>
              <p className="mt-1 text-base font-semibold text-ink">{systems.length} Functional Areas</p>
            </div>
            <div className="border-l border-stone-2 pl-4">
              <span className="text-stone-3">FLAGSHIP SYSTEM</span>
              <p className="mt-1 text-base font-semibold text-green">Satelink Network</p>
            </div>
            <div className="border-l border-stone-2 pl-4">
              <span className="text-stone-3">COMPLIANCE BASIS</span>
              <p className="mt-1 text-base font-semibold text-ink">Statutory MoA & Udyam</p>
            </div>
            <div className="border-l border-stone-2 pl-4">
              <span className="text-stone-3">STATUS</span>
              <p className="mt-1 text-base font-semibold text-green">Active Operations</p>
            </div>
          </div>
        </Container>
      </section>

      {/* Section 1: The Six Core Technical Systems */}
      <Container className="py-16 sm:py-24">
        <div className="border-b border-stone-2 pb-4">
          <span className="font-mono text-xs uppercase tracking-wider text-green">TECHNICAL FOUNDATIONS</span>
          <h2 className="mt-1 font-serif text-3xl sm:text-4xl text-ink">Core System Implementations</h2>
          <p className="mt-2 text-base text-stone-4">
            The software, protocol, and data systems engineered and operated by Jakuraa.
          </p>
        </div>

        <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {systems.map((system, idx) => (
            <div
              key={system.id}
              id={system.id}
              className="group flex flex-col justify-between rounded-2xl border border-stone-1 bg-ivory p-6 shadow-sm transition-all hover:border-green hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between text-xs font-mono text-stone-3">
                  <span>SYS-0{idx + 1}</span>
                  <span className="rounded bg-green-soft px-2 py-0.5 text-[10px] font-semibold uppercase text-green">
                    {system.status}
                  </span>
                </div>

                <h3 className="mt-4 font-serif text-2xl text-ink group-hover:text-green transition-colors">
                  {system.title}
                </h3>

                <p className="mt-3 text-sm leading-relaxed text-stone-4">
                  {system.description}
                </p>
              </div>

              <div className="mt-6 border-t border-stone-1 pt-4">
                <span className="text-[11px] font-mono text-stone-3 uppercase block mb-2">Capabilities</span>
                <div className="flex flex-wrap gap-1.5">
                  {system.capabilities.map((cap) => (
                    <span
                      key={cap}
                      className="rounded-full bg-ivory-2 px-2.5 py-0.5 text-xs text-stone-4 font-sans"
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Section 2: Statutory Business Verticals Integration */}
        <div className="mt-24 border-b border-stone-2 pb-4">
          <span className="font-mono text-xs uppercase tracking-wider text-stone-3">ORGANIZATIONAL VERTICALS</span>
          <h2 className="mt-1 font-serif text-3xl sm:text-4xl text-ink">Business Lines & Registered Verticals</h2>
          <p className="mt-2 text-base text-stone-4">
            Each commercial vertical is backed by an official constitutional object or government statutory registration.
          </p>
        </div>

        <ul className="mt-10 divide-y divide-stone-1 border-y border-stone-1">
          {businesses.map((b) => (
            <li key={b.slug}>
              <Link
                href={`/businesses/${b.slug}`}
                className="group grid items-center gap-6 py-8 sm:grid-cols-[180px_1fr_auto] transition-colors hover:bg-ivory-2/30 px-2 rounded-xl"
              >
                <Illustration
                  kind={b.illustration}
                  className="h-20 w-auto text-stone-3 group-hover:text-green transition-colors"
                />
                <div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={b.status} />
                    <span className="font-mono text-xs text-stone-3">{b.basis}</span>
                  </div>
                  <h3 className="mt-2 font-serif text-2xl text-ink group-hover:text-green transition-colors">
                    {b.name}
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-4">
                    {b.summary}
                  </p>
                </div>
                <div className="hidden sm:flex items-center text-sm font-medium text-green group-hover:translate-x-1 transition-transform">
                  <span>Explore Vertical</span>
                  <span className="ml-1 text-base">→</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        {/* Institutional Callout */}
        <div className="mt-20 rounded-2xl border border-stone-2 bg-ivory-2 p-8 sm:p-10">
          <div className="grid gap-8 lg:grid-cols-12 items-center">
            <div className="lg:col-span-8">
              <span className="font-mono text-xs uppercase tracking-wider text-green font-semibold">
                SYSTEMS ARCHITECTURE & METHODOLOGY
              </span>
              <h3 className="mt-2 font-serif text-2xl sm:text-3xl text-ink">
                From Physical Supply Chains to Machine Commerce
              </h3>
              <p className="mt-3 text-sm sm:text-base leading-relaxed text-stone-4">
                Jakuraa approaches systems engineering from first principles. Having directly operated
                in hardware testbenches, physical machinery trade, and consumer retail supermarkets,
                we design software infrastructure that accounts for network latency, counterparty risk,
                and mechanical failure.
              </p>
            </div>
            <div className="lg:col-span-4 flex flex-col gap-3">
              <Link
                href="/history"
                className="inline-flex justify-center items-center rounded-full bg-ink px-6 py-3 text-xs font-mono font-medium text-ivory hover:bg-stone-4 transition-colors"
              >
                <span>View Historical Timeline (2019 - 2026)</span>
              </Link>
              <Link
                href="/technology"
                className="inline-flex justify-center items-center rounded-full border border-stone-2 px-6 py-3 text-xs font-mono font-medium text-ink hover:border-ink hover:bg-ivory-2 transition-colors"
              >
                <span>Read Technology Spec</span>
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
