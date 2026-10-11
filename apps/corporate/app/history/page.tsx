import React from 'react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { HeroWrap } from '@/components/layout/HeroWrap';
import { HistoricalTimeline } from '@/components/HistoricalTimeline';
import { companyFoundingStory } from '@/content/history';
import { getMediaByCategory } from '@/content/media';

export const metadata: Metadata = {
  title: 'Company History & Institutional Archive (2019 - 2026) | Jakuraa',
  description:
    'The complete operating history of Jakuraa: from early software engineering, GPU mining clusters, and industrial machinery distribution to supermarket retail and autonomous machine commerce infrastructure.',
  openGraph: {
    title: 'Company History & Institutional Archive (2019 - 2026) | Jakuraa',
    description:
      'The complete operating history of Jakuraa: from early software engineering, GPU mining clusters, and industrial machinery distribution to supermarket retail and autonomous machine commerce infrastructure.',
    url: 'https://jakuraa.com/history',
  },
};

export default function HistoryPage() {
  const founderMedia = getMediaByCategory('founder');
  const videoPosters = getMediaByCategory('history').filter((m) => m.type === 'video');

  return (
    <main className="min-h-screen bg-ivory text-ink">
      {/* Editorial Hero using reusable HeroWrap */}
      <HeroWrap
        eyebrow="CORPORATE ARCHIVE & CHRONOLOGY"
        headline="Seven Years of Building, Operating, and Learning."
        description="From bespoke software engineering and GPU mining rigs in 2019 to industrial tool distribution, hospitality management, and wholesale supermarkets, through to autonomous machine commerce infrastructure in 2026."
        primaryCta={{
          label: 'Launch Satelink Protocol',
          href: 'https://satelink.network',
          external: true,
        }}
        secondaryCta={{
          label: 'Explore Systems',
          href: '/systems',
        }}
      />

      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-20">
        {/* Founder Profile Feature */}
        <section className="mb-24 rounded-2xl border border-stone-1 bg-ivory-2/50 p-8 lg:p-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-5 relative aspect-[4/5] w-full overflow-hidden rounded-xl border border-stone-2 bg-stone-1/30 shadow-md">
              <Image
                src={companyFoundingStory.portraitPath}
                alt="Pradeep Jakuraa, Founder & Managing Director"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 40vw"
                className="object-cover"
              />
              <div className="absolute bottom-3 left-3 right-3 rounded bg-ink/80 px-3 py-2 text-ivory backdrop-blur-sm">
                <p className="font-serif text-sm font-medium">Pradeep Jakuraa</p>
                <p className="font-mono text-[11px] text-stone-3">
                  Founder / Systems Builder / Operator
                </p>
              </div>
            </div>

            <div className="lg:col-span-7 space-y-6">
              <div>
                <span className="font-mono text-xs uppercase tracking-wider text-stone-3">
                  LEADERSHIP & OPERATIONAL ARCHITECTURE
                </span>
                <h2 className="mt-2 font-serif text-3xl sm:text-4xl font-normal text-ink">
                  A Systems Builder Who Operated in the Real Economy
                </h2>
              </div>

              <p className="font-serif text-lg leading-relaxed text-stone-4">
                {companyFoundingStory.thesis}
              </p>

              <div className="space-y-4 font-sans text-sm sm:text-base leading-relaxed text-stone-4">
                <p>
                  Pradeep Jakuraa established the firm in Coimbatore in early 2019. Over seven
                  years, rather than restricting the company to software consulting or speculative
                  technology, he chose to operate directly across physical industries: managing
                  heavy machinery distribution at Falcor Power Tools, running the kitchen and dining
                  operations of Hotel Delhi Darbarr, and overseeing thousands of daily retail SKU
                  transactions at Wholesale Syndicate supermarket.
                </p>
                <p>
                  These operational experiences directly exposed the acute friction of human-mediated
                  commerce: manual invoice reconciliations, counter bottlenecks, long credit cycles,
                  and margin shrinkage. Satelink is the deliberate answer to these lessons: software
                  infrastructure designed for machines to settle commerce directly, instantaneously,
                  and deterministically.
                </p>
              </div>

              {/* Founder Moments Gallery Strip */}
              <div className="pt-4 border-t border-stone-1">
                <span className="font-mono text-xs uppercase tracking-wider text-stone-3 mb-3 block">
                  Field Operations & Systems Architecture Moments
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {founderMedia.slice(1, 5).map((m) => (
                    <div
                      key={m.id}
                      className="group relative aspect-[4/3] overflow-hidden rounded border border-stone-1 bg-stone-1/20"
                    >
                      <Image
                        src={m.localPath}
                        alt={m.alt}
                        fill
                        sizes="(max-width: 640px) 50vw, 25vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <span className="absolute bottom-1 left-1 rounded bg-ink/70 px-1.5 py-0.2 font-mono text-[9px] text-ivory">
                        {m.context}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Primary Timeline Component */}
        <section>
          <div className="mb-12 max-w-3xl">
            <span className="font-mono text-xs uppercase tracking-wider text-stone-3">
              INSTITUTIONAL TIMELINE (2019 - 2026)
            </span>
            <h2 className="mt-2 font-serif text-3xl sm:text-4xl font-normal text-ink">
              The Path to Machine Commerce
            </h2>
            <p className="mt-3 font-serif text-lg text-stone-4">
              Explore each chapter of our operating journey, including active platforms,
              completed research initiatives, and discontinued physical ventures.
            </p>
          </div>

          <HistoricalTimeline />
        </section>

        {/* Archival Footage Strip & Field Recordings */}
        <section className="mt-28 border-t border-stone-1 pt-16">
          <div className="max-w-3xl mb-10">
            <span className="font-mono text-xs uppercase tracking-wider text-stone-3">
              ARCHIVAL FOOTAGE & BENCH RECORDINGS
            </span>
            <h2 className="mt-2 font-serif text-2xl sm:text-3xl font-normal text-ink">
              Operational Records & Verified Field Video
            </h2>
            <p className="mt-2 font-sans text-sm text-stone-4">
              Recorded during physical machinery inspections, hardware bench calibrations, and warehouse
              operations between 2019 and 2023.
            </p>
          </div>

          {/* Featured Verified YouTube Video: Falcor Power Tools */}
          <div className="mb-12 rounded-2xl border border-stone-2 bg-ivory-2/40 p-6 sm:p-10 shadow-sm">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-7">
                <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-stone-2 bg-stone-1/40 shadow-md">
                  <iframe
                    src="https://www.youtube-nocookie.com/embed/PaQZ9K-jzGY"
                    title="Before You Buy: Falcor Angle Grinder Unboxing & Shop Review - Pradeep Jakuraa"
                    className="absolute inset-0 h-full w-full border-0"
                    loading="lazy"
                    allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>

              <div className="lg:col-span-5 space-y-4">
                <div>
                  <span className="font-mono text-xs uppercase tracking-wider text-amber-ink">
                    VERIFIED HISTORICAL VIDEO (2021)
                  </span>
                  <h3 className="mt-1 font-serif text-2xl text-ink">
                    Falcor Power Tools: Shop Review & Machinery Unboxing
                  </h3>
                  <p className="mt-1 font-mono text-xs text-stone-3">
                    Author: Pradeep Jakuraa / Falcor Power Tools
                  </p>
                </div>

                <p className="font-sans text-sm leading-relaxed text-stone-4">
                  Archival field demonstration recorded during active commercial trade operations in Coimbatore.
                  The video documents rotary tool inspection, armature component analysis, and practical workshop
                  diagnostics before customer dispatch.
                </p>

                <div className="rounded-lg border border-stone-1 bg-ivory p-4 text-xs font-mono text-stone-4 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-stone-3">Format:</span>
                    <span>16:9 HD Embedded (No-Cookie)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-3">Business:</span>
                    <span>Falcor Power Tools (Historical)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-3">Status:</span>
                    <span>Verified YouTube Archive</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Hotel Delhi Darbarr Archival Note & Documentary Status */}
          <div className="mb-12 rounded-xl border border-stone-1 bg-ivory p-6 sm:p-8">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              <div className="md:col-span-4 relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-stone-1 bg-stone-1/20">
                <Image
                  src="/media/restaurant/hotel-delhi-darbarr-dining.jpg"
                  alt="Hotel Delhi Darbarr restaurant dining area"
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover"
                />
                <span className="absolute bottom-2 left-2 rounded bg-ink/75 px-2 py-0.5 font-mono text-[10px] text-ivory">
                  2021 / Dining Hall
                </span>
              </div>

              <div className="md:col-span-8 space-y-2">
                <span className="font-mono text-xs uppercase tracking-wider text-stone-3">
                  HOSPITALITY DIVISION DOCUMENTARY RECORD
                </span>
                <h4 className="font-serif text-xl text-ink">
                  Hotel Delhi Darbarr Operational Archive
                </h4>
                <p className="font-sans text-sm leading-relaxed text-stone-4">
                  Hotel Delhi Darbarr was acquired and operated under the Falcor Commercial entity between 2021 and 2022.
                  Archival verification confirms photographic documentation of the dining floor, commercial kitchen, and customer checkout stations.
                  No public video broadcasts were published for this division; operations were managed entirely through physical ledgers and closed-circuit operational monitoring.
                </p>
                <div className="pt-2 text-xs font-mono text-stone-3">
                  Status: Divested / Archival photographic documentation verified
                </div>
              </div>
            </div>
          </div>

          {/* Operational Bench Recordings Grid */}
          {videoPosters && videoPosters.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {videoPosters.map((v) => (
                <div
                  key={v.id}
                  className="rounded-lg border border-stone-1 bg-ivory p-3 transition-colors hover:border-stone-3"
                >
                  <div className="relative aspect-[16/10] w-full overflow-hidden rounded bg-stone-1/20">
                    <Image
                      src={v.localPath}
                      alt={v.alt}
                      fill
                      sizes="(max-width: 640px) 100vw, 33vw"
                      className="object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                      <div className="flex size-9 items-center justify-center rounded-full bg-ivory/90 text-ink shadow">
                        <svg className="size-4 fill-current ml-0.5" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                    <span className="absolute top-2 right-2 rounded bg-ink/75 px-1.5 py-0.5 font-mono text-[9px] text-ivory">
                      Archival Record
                    </span>
                  </div>
                  <div className="mt-3">
                    <h4 className="font-serif text-sm font-medium text-ink">{v.title}</h4>
                    <p className="mt-1 font-sans text-xs text-stone-4">{v.caption}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Closing Call to Action */}
        <section className="mt-28 rounded-2xl bg-ink p-8 sm:p-14 text-ivory text-center">
          <div className="max-w-2xl mx-auto space-y-6">
            <span className="font-mono text-xs uppercase tracking-wider text-stone-3">
              WHERE WE ARE TODAY
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-normal text-ivory">
              Satelink: Machine Commerce Infrastructure
            </h2>
            <p className="font-sans text-stone-3 text-base sm:text-lg leading-relaxed">
              Explore how seven years of operational learning culminated in the premier
              machine-to-machine payment and settlement protocol for autonomous software.
            </p>
            <div className="pt-2 flex flex-wrap justify-center gap-4">
              <a
                href="https://satelink.network"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-ivory px-6 py-3 font-sans text-sm font-medium text-ink hover:bg-ivory-2 transition-colors shadow-sm"
              >
                <span>Visit satelink.network</span>
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
              <Link
                href="/company"
                className="inline-flex items-center gap-2 rounded-full border border-stone-3 px-6 py-3 font-sans text-sm font-medium text-ivory hover:border-ivory transition-colors"
              >
                <span>About Jakuraa Commercial</span>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
