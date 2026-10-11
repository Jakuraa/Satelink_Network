import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageHero } from "@/components/Page";

export const metadata: Metadata = {
  title: "Media Kit & Institutional Resources | Jakuraa",
  description:
    "Official media kit, brand guidelines, statutory disclosures, and logos for Jakuraa and Satelink.",
};

const brandColors = [
  { name: "Ivory (Primary Background)", hex: "#FAF8F5", usage: "Default website and print editorial background" },
  { name: "Ink (Primary Typography)", hex: "#11100D", usage: "Headings, body copy, and high-contrast elements" },
  { name: "Deep Charcoal (Footer & Terminals)", hex: "#0C0B09", usage: "Institutional footer, terminal surfaces, and code blocks" },
  { name: "Green (Accent & Verification)", hex: "#1B5E20", usage: "Status badges, verified markers, and primary links" },
  { name: "Amber (Historical & Telemetry)", hex: "#B45309", usage: "Historical dates, warnings, and telemetry highlights" },
  { name: "Stone (Borders & Muted Text)", hex: "#E7E5E4", usage: "Architectural rules, dividers, and card borders" },
];

export default function MediaKitPage() {
  return (
    <main className="min-h-screen bg-ivory text-ink">
      <PageHero
        eyebrow="RESOURCES & PRESS"
        title="Media Kit & Brand Assets"
        lede={
          <p>
            Official brand resources, logos, executive bios, and corporate descriptions for journalists,
            researchers, and conference organizers.
          </p>
        }
      />

      <Container className="pb-24">
        {/* Quick Contacts Bar */}
        <div className="mb-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 rounded-2xl border border-stone-2 bg-ivory-2/40 p-6 sm:p-8">
          <div>
            <span className="font-mono text-xs text-green font-semibold uppercase">PRESS ENQUIRIES</span>
            <p className="mt-1 font-serif text-lg text-ink">Media & Editorial</p>
            <p className="mt-1 text-sm text-stone-4">
              Direct inquiries regarding company announcements, interviews, and research papers.
            </p>
            <a href="mailto:press@jakuraa.com" className="mt-3 inline-block font-mono text-xs text-green hover:underline">
              press@jakuraa.com →
            </a>
          </div>

          <div>
            <span className="font-mono text-xs text-green font-semibold uppercase">PLATFORM INQUIRIES</span>
            <p className="mt-1 font-serif text-lg text-ink">Satelink Press & Product</p>
            <p className="mt-1 text-sm text-stone-4">
              Inquiries regarding machine commerce infrastructure, x402 protocol, and AI trading.
            </p>
            <a href="mailto:press@satelink.network" className="mt-3 inline-block font-mono text-xs text-green hover:underline">
              press@satelink.network →
            </a>
          </div>

          <div>
            <span className="font-mono text-xs text-stone-3 font-semibold uppercase">RESPONSE WINDOW</span>
            <p className="mt-1 font-serif text-lg text-ink">Editorial Policy</p>
            <p className="mt-1 text-sm text-stone-4">
              We respond to verified journalistic inquiries within 24 business hours. No promotional solicitations.
            </p>
            <span className="mt-3 inline-block font-mono text-xs text-stone-3">
              Standard SLA: 1 Business Day
            </span>
          </div>
        </div>

        {/* Section 1: Corporate Boilerplates */}
        <section className="mb-20 space-y-8">
          <div className="border-b border-stone-1 pb-4">
            <span className="font-mono text-xs uppercase tracking-wider text-green font-semibold">
              OFFICIAL DESCRIPTIONS
            </span>
            <h2 className="mt-2 font-serif text-3xl text-ink">
              Company Boilerplates
            </h2>
            <p className="mt-2 text-stone-4 text-sm font-sans max-w-2xl">
              Approved textual summaries for media coverage, citations, and conference materials.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            {/* Jakuraa Boilerplate */}
            <div className="rounded-2xl border border-stone-1 bg-ivory p-8 shadow-sm">
              <span className="rounded bg-ivory-2 px-2.5 py-1 font-mono text-[10px] uppercase text-stone-4">
                JAKURAA COMMERCIAL PRIVATE LIMITED
              </span>
              <h3 className="mt-4 font-serif text-2xl text-ink">About Jakuraa</h3>
              <p className="mt-3 text-sm leading-relaxed text-stone-4 font-sans">
                Jakuraa is a corporate technology institution established in 2019 in Coimbatore, India.
                The company engineers and operates systems across autonomous software, distributed infrastructure,
                and machine commerce. Jakuraa operates Satelink, its flagship platform enabling AI agents to
                negotiate, meter, and settle transactions on-chain with cryptographic certainty.
              </p>
              <div className="mt-6 border-t border-stone-1 pt-4 text-xs font-mono text-stone-3">
                <span>CIN: U72900TZ2019PTC032906</span>
                <span className="mx-2">·</span>
                <span>Incorporated: 2019</span>
              </div>
            </div>

            {/* Satelink Boilerplate */}
            <div className="rounded-2xl border border-stone-1 bg-ivory p-8 shadow-sm">
              <span className="rounded bg-green/10 px-2.5 py-1 font-mono text-[10px] uppercase text-green font-semibold">
                SATELINK PROTOCOL & PLATFORM
              </span>
              <h3 className="mt-4 font-serif text-2xl text-ink">About Satelink</h3>
              <p className="mt-3 text-sm leading-relaxed text-stone-4 font-sans">
                Satelink is the flagship machine-commerce infrastructure platform engineered by Jakuraa.
                It provides the economic rails, permissionless vaults, and usage-metered gateways for autonomous
                software agents to discover, access, and pay for computing resources, data feeds, and APIs
                per call. Satelink implements the x402 protocol for micro-payments in USDC on Base and the
                RevenueVaultV2 smart contract on Polygon PoS.
              </p>
              <div className="mt-6 border-t border-stone-1 pt-4 text-xs font-mono text-stone-3">
                <span>Public Portal: satelink.network</span>
                <span className="mx-2">·</span>
                <span>Infrastructure Rails: Base & Polygon</span>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Brand Identity & Logos */}
        <section className="mb-20 space-y-8">
          <div className="border-b border-stone-1 pb-4">
            <span className="font-mono text-xs uppercase tracking-wider text-green font-semibold">
              GRAPHICAL ASSETS
            </span>
            <h2 className="mt-2 font-serif text-3xl text-ink">
              Brand Wordmark & Vector Assets
            </h2>
            <p className="mt-2 text-stone-4 text-sm font-sans max-w-2xl">
              Official vector graphics in SVG format. Maintain generous whitespace and do not distort aspect ratios.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {/* Asset 1: Jakuraa Wordmark Dark */}
            <div className="rounded-2xl border border-stone-1 bg-ivory p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex h-36 items-center justify-center rounded-xl bg-ivory-2 border border-stone-2">
                  <span className="font-sans font-bold text-2xl tracking-[0.16em] uppercase text-ink">
                    JAKURAA
                  </span>
                </div>
                <h4 className="mt-4 font-serif text-lg text-ink">Wordmark (Dark on Light)</h4>
                <p className="mt-1 text-xs text-stone-4 font-sans">
                  Primary corporate brand mark for light backgrounds, publications, and white documents.
                </p>
              </div>
              <div className="mt-6 border-t border-stone-1 pt-3">
                <a
                  href="/icon.svg"
                  download="jakuraa-icon.svg"
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-green hover:underline font-medium"
                >
                  <span>Download SVG Asset</span>
                  <span>↓</span>
                </a>
              </div>
            </div>

            {/* Asset 2: Jakuraa Wordmark Light on Dark */}
            <div className="rounded-2xl border border-stone-1 bg-ivory p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex h-36 items-center justify-center rounded-xl bg-[#0C0B09] border border-white/10">
                  <span className="font-sans font-bold text-2xl tracking-[0.16em] uppercase text-ivory">
                    JAKURAA
                  </span>
                </div>
                <h4 className="mt-4 font-serif text-lg text-ink">Wordmark (Light on Dark)</h4>
                <p className="mt-1 text-xs text-stone-4 font-sans">
                  Inverted brand mark for dark interfaces, technical terminals, and video overlays.
                </p>
              </div>
              <div className="mt-6 border-t border-stone-1 pt-3">
                <a
                  href="/icon.svg"
                  download="jakuraa-icon-dark.svg"
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-green hover:underline font-medium"
                >
                  <span>Download SVG Asset</span>
                  <span>↓</span>
                </a>
              </div>
            </div>

            {/* Asset 3: Favicon & Monogram Icon */}
            <div className="rounded-2xl border border-stone-1 bg-ivory p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex h-36 items-center justify-center rounded-xl bg-ivory-2 border border-stone-2">
                  <div className="size-16 rounded-xl bg-ink text-ivory flex items-center justify-center font-sans font-bold text-2xl">
                    J
                  </div>
                </div>
                <h4 className="mt-4 font-serif text-lg text-ink">Monogram Icon (Favicon)</h4>
                <p className="mt-1 text-xs text-stone-4 font-sans">
                  Square app icon, browser favicon, and social media profile identifier.
                </p>
              </div>
              <div className="mt-6 border-t border-stone-1 pt-3">
                <a
                  href="/icon.svg"
                  download="jakuraa-monogram.svg"
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-green hover:underline font-medium"
                >
                  <span>Download SVG Icon</span>
                  <span>↓</span>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Color Palette & Typography */}
        <section className="mb-20 space-y-8">
          <div className="border-b border-stone-1 pb-4">
            <span className="font-mono text-xs uppercase tracking-wider text-green font-semibold">
              DESIGN SYSTEM
            </span>
            <h2 className="mt-2 font-serif text-3xl text-ink">
              Colors & Typography Hierarchy
            </h2>
            <p className="mt-2 text-stone-4 text-sm font-sans max-w-2xl">
              Jakuraa uses an editorial palette reflecting physical materials, archival paper, and computing infrastructure.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {brandColors.map((c) => (
              <div key={c.hex} className="rounded-xl border border-stone-1 bg-ivory p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-lg border border-stone-2" style={{ backgroundColor: c.hex }} />
                  <div>
                    <p className="font-mono text-xs font-semibold text-ink">{c.hex}</p>
                    <p className="font-serif text-sm text-stone-4">{c.name}</p>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-stone-3 font-sans">{c.usage}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 4: Leadership & Archival Photography */}
        <section className="mb-20 space-y-8">
          <div className="border-b border-stone-1 pb-4">
            <span className="font-mono text-xs uppercase tracking-wider text-green font-semibold">
              PHOTOGRAPHY ARCHIVE
            </span>
            <h2 className="mt-2 font-serif text-3xl text-ink">
              Approved Executive & Operating Imagery
            </h2>
            <p className="mt-2 text-stone-4 text-sm font-sans max-w-2xl">
              High-resolution photographs of leadership and historical operating facilities. Available for editorial use with attribution.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-stone-2 bg-ivory p-5">
              <span className="font-mono text-[10px] text-stone-3 uppercase block">LEADERSHIP PORTRAIT</span>
              <h4 className="mt-2 font-serif text-base text-ink">Pradeep Jakuraa</h4>
              <p className="mt-1 text-xs text-stone-4">Founder, Systems Architect & Managing Director</p>
              <div className="mt-4 pt-3 border-t border-stone-1 flex items-center justify-between text-xs font-mono">
                <span className="text-stone-3">High-Res JPG</span>
                <Link href="/company/leadership" className="text-green hover:underline">
                  View on Leadership →
                </Link>
              </div>
            </div>

            <div className="rounded-xl border border-stone-2 bg-ivory p-5">
              <span className="font-mono text-[10px] text-stone-3 uppercase block">COMPUTE ARCHIVE</span>
              <h4 className="mt-2 font-serif text-base text-ink">GPU Silicon Calibration (2019)</h4>
              <p className="mt-1 text-xs text-stone-4">Early test bench and multi-card cryptographic benchmarking</p>
              <div className="mt-4 pt-3 border-t border-stone-1 flex items-center justify-between text-xs font-mono">
                <span className="text-stone-3">Field Telemetry</span>
                <Link href="/history#chapter-2019-compute-mining" className="text-green hover:underline">
                  View in Archive →
                </Link>
              </div>
            </div>

            <div className="rounded-xl border border-stone-2 bg-ivory p-5">
              <span className="font-mono text-[10px] text-stone-3 uppercase block">COMMERCIAL FACILITY</span>
              <h4 className="mt-2 font-serif text-base text-ink">Wholesale Syndicate Retail (2024)</h4>
              <p className="mt-1 text-xs text-stone-4">3,000+ SKU inventory staging and POS terminal operations</p>
              <div className="mt-4 pt-3 border-t border-stone-1 flex items-center justify-between text-xs font-mono">
                <span className="text-stone-3">Operational Record</span>
                <Link href="/history#chapter-2024-wholesale-syndicate" className="text-green hover:underline">
                  View in Archive →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Section 5: Statutory Disclosures */}
        <section className="rounded-2xl border border-stone-2 bg-ivory-2/50 p-8 sm:p-10">
          <span className="font-mono text-xs uppercase tracking-wider text-green font-semibold">
            STATUTORY GOVERNANCE DISCLOSURES
          </span>
          <h2 className="mt-2 font-serif text-2xl sm:text-3xl text-ink">
            Corporate Incorporation Data
          </h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 font-mono text-xs">
            <div>
              <span className="text-stone-4 block">CORPORATE IDENTITY NUMBER (CIN)</span>
              <span className="font-semibold text-ink mt-0.5 block">U72900TZ2019PTC032906</span>
            </div>
            <div>
              <span className="text-stone-4 block">GOODS & SERVICES TAX (GSTIN)</span>
              <span className="font-semibold text-ink mt-0.5 block">33AADCF9341B1Z9</span>
            </div>
            <div>
              <span className="text-stone-4 block">DGFT IMPORT-EXPORT CODE (IEC)</span>
              <span className="font-semibold text-ink mt-0.5 block">AADCF9341B</span>
            </div>
            <div>
              <span className="text-stone-4 block">REGISTERED JURISDICTION</span>
              <span className="font-semibold text-ink mt-0.5 block">Coimbatore, Tamil Nadu, India</span>
            </div>
          </div>
          <div className="mt-8 border-t border-stone-2 pt-6">
            <Link
              href="/legal/company-information"
              className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-green hover:underline"
            >
              <span>Read Full Statutory Disclosures & Compliance Filings</span>
              <span>→</span>
            </Link>
          </div>
        </section>
      </Container>
    </main>
  );
}
