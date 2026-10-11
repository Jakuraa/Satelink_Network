import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { company, registeredOfficeLine } from "@/content/company";
import { EnquiryForm } from "@/components/EnquiryForm";
import { Container, PageHero } from "@/components/Page";

export const metadata: Metadata = {
  title: "Contact & Institutional Enquiries | Jakuraa & Satelink",
  description: `Contact Jakuraa Commercial Private Limited and the Satelink machine-commerce platform. Department communication channels and statutory details.`,
};

const jakuraaDepartments = [
  {
    role: "General & Institutional",
    email: "contact@jakuraa.com",
    desc: "Corporate communications, executive correspondence, and institutional queries.",
  },
  {
    role: "Partnerships & Ventures",
    email: "partnerships@jakuraa.com",
    desc: "Commercial collaborations, enterprise joint ventures, and strategic alignments.",
  },
  {
    role: "Press & Media Relations",
    email: "press@jakuraa.com",
    desc: "Journalistic queries, interview requests, and media kit verification.",
  },
  {
    role: "Careers & Talent",
    email: "careers@jakuraa.com",
    desc: "Speculative applications and recruitment communication for Jakuraa.",
  },
  {
    role: "Legal & Compliance",
    email: "legal@jakuraa.com",
    desc: "Statutory governance filings, contract administration, and regulatory matters.",
  },
  {
    role: "Security & Vulnerability",
    email: "security@jakuraa.com",
    desc: "PGP-encrypted responsible disclosure and infrastructure security reports.",
  },
];

const satelinkDepartments = [
  {
    role: "Developer & Integration Support",
    email: "developers@satelink.network",
    desc: "x402 protocol integration, API key provisioning, and MCP tool debugging.",
  },
  {
    role: "Platform Sales & Solutions",
    email: "sales@satelink.network",
    desc: "Enterprise rate tiers, high-throughput RPC clusters, and custom vault contracts.",
  },
  {
    role: "AI Trading Systems",
    email: "trading@satelink.network",
    desc: "Orderbook microstructure feeds, quantitative models, and algorithmic execution.",
  },
  {
    role: "Satelink Careers",
    email: "careers@satelink.network",
    desc: "Protocol engineering, agent runtimes, smart contracts, and cloud infrastructure.",
  },
  {
    role: "Protocol Security",
    email: "security@satelink.network",
    desc: "Smart contract audit findings, bug bounties, and cryptographic verification.",
  },
  {
    role: "System Status & Uptime",
    email: null,
    href: "https://status.satelink.network",
    desc: "Live infrastructure status, API availability, and RPC node operational health.",
  },
];

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-ivory text-ink">
      <PageHero
        eyebrow="COMMUNICATION & INQUIRIES"
        title="Get in touch."
        lede={
          <p>
            Department-specific channels for Jakuraa Commercial and the Satelink machine-commerce platform.
            Select the appropriate channel to ensure rapid routing.
          </p>
        }
      />

      <Container className="pb-24">
        {/* Department Directory Grid: Dual Organizations */}
        <section className="mb-20">
          <div className="grid gap-12 lg:grid-cols-2">
            {/* Column 1: Jakuraa Corporate */}
            <div className="rounded-2xl border border-stone-2 bg-ivory p-8 shadow-sm space-y-6">
              <div className="border-b border-stone-1 pb-4">
                <span className="rounded bg-ivory-2 px-2.5 py-1 font-mono text-[10px] uppercase text-stone-4">
                  CORPORATE INSTITUTION
                </span>
                <h2 className="mt-3 font-serif text-2xl text-ink">
                  Jakuraa Commercial
                </h2>
                <p className="mt-2 text-sm text-stone-4 font-sans leading-relaxed">
                  Channels for institutional, governance, partnership, press, and operational inquiries.
                </p>
              </div>

              <div className="divide-y divide-stone-1">
                {jakuraaDepartments.map((dept) => (
                  <div key={dept.email} className="py-3.5 first:pt-0 last:pb-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-serif text-base text-ink">{dept.role}</span>
                      <a href={`mailto:${dept.email}`} className="font-mono text-xs text-green hover:underline">
                        {dept.email}
                      </a>
                    </div>
                    <p className="mt-1 text-xs text-stone-4 font-sans">{dept.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Column 2: Satelink Platform */}
            <div className="rounded-2xl border border-stone-2 bg-ivory p-8 shadow-sm space-y-6">
              <div className="border-b border-stone-1 pb-4">
                <span className="rounded bg-green/10 px-2.5 py-1 font-mono text-[10px] uppercase font-semibold text-green">
                  FLAGSHIP TECHNOLOGY PLATFORM
                </span>
                <h2 className="mt-3 font-serif text-2xl text-ink">
                  Satelink Platform
                </h2>
                <p className="mt-2 text-sm text-stone-4 font-sans leading-relaxed">
                  Channels for developer support, enterprise sales, AI trading, smart contracts, and platform health.
                </p>
              </div>

              <div className="divide-y divide-stone-1">
                {satelinkDepartments.map((dept) => (
                  <div key={dept.role} className="py-3.5 first:pt-0 last:pb-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-serif text-base text-ink">{dept.role}</span>
                      {dept.email ? (
                        <a href={`mailto:${dept.email}`} className="font-mono text-xs text-green hover:underline">
                          {dept.email}
                        </a>
                      ) : (
                        <a
                          href={dept.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs text-green hover:underline inline-flex items-center gap-1"
                        >
                          <span>status.satelink.network</span>
                          <span>↗</span>
                        </a>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-stone-4 font-sans">{dept.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Form and Statutory Office Grid */}
        <div className="grid gap-14 lg:grid-cols-[1.5fr_1fr] border-t border-stone-1 pt-16">
          <section aria-label="Direct message form">
            <span className="font-mono text-xs uppercase tracking-wider text-green font-semibold">
              INSTITUTIONAL ENQUIRY FORM
            </span>
            <h3 className="mt-2 font-serif text-3xl text-ink">
              Send an inquiry to our team.
            </h3>
            <p className="mt-2 text-sm text-stone-4 font-sans mb-8">
              Inquiries submitted through this form are logged in our central communication queue and dispatched to the appropriate department.
            </p>
            <EnquiryForm fallbackEmail={company.email} />
          </section>

          <aside className="space-y-8 text-stone-4 font-sans text-sm">
            <div className="rounded-2xl border border-stone-2 bg-ivory-2/40 p-6 space-y-4">
              <h4 className="font-serif text-lg text-ink">Registered Office</h4>
              <address className="not-italic leading-relaxed text-sm text-stone-4 font-sans">
                <span className="font-semibold text-ink">{company.legalName}</span>
                <br />
                <span className="text-xs text-stone-3">(formerly {company.formerName})</span>
                <br />
                {registeredOfficeLine()}
              </address>
              <div className="pt-3 border-t border-stone-2 font-mono text-xs text-stone-3 space-y-1">
                <div>CIN: {company.cin}</div>
                <div>GSTIN: {company.gstin}</div>
                <div>DGFT IEC: {company.iec}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-2 bg-ivory-2/40 p-6 space-y-3">
              <h4 className="font-serif text-lg text-ink">Operational Governance</h4>
              <p className="text-xs leading-relaxed text-stone-4">
                For statutory grievances or compliance concerns under the Companies Act and Information Technology Act,
                refer directly to our appointed Grievance Officer.
              </p>
              <div className="pt-2">
                <Link href="/legal/grievance" className="font-mono text-xs text-green hover:underline">
                  Review Grievance Officer details →
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-2 bg-ivory-2/40 p-6 space-y-3">
              <h4 className="font-serif text-lg text-ink">Live Infrastructure Status</h4>
              <p className="text-xs leading-relaxed text-stone-4">
                Verify real-time system uptime, latency telemetry, and maintenance schedules for all Satelink endpoints.
              </p>
              <div className="pt-2">
                <a
                  href="https://status.satelink.network"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-green hover:underline inline-flex items-center gap-1"
                >
                  <span>Launch status.satelink.network</span>
                  <span>↗</span>
                </a>
              </div>
            </div>
          </aside>
        </div>
      </Container>
    </main>
  );
}
