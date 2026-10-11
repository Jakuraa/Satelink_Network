import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { sortedNews } from "@/content/people";
import { Container, ArrowLink, formatDate } from "@/components/Page";

export const metadata: Metadata = {
  title: "Newsroom & Dispatches | Jakuraa",
  description:
    "Official corporate announcements, technology dispatches, and protocol milestones from Jakuraa and Satelink.",
};

export default function NewsPage() {
  const items = sortedNews();

  return (
    <main className="min-h-screen bg-ivory text-ink">
      {/* Anthropic-inspired Newsroom Header Shell */}
      <section className="border-b border-stone-1 pt-16 pb-12 sm:pt-24 sm:pb-16">
        <Container>
          <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
            {/* Left Column: Title & Mission */}
            <div className="lg:col-span-7">
              <span className="font-mono text-xs uppercase tracking-wider text-green font-semibold">
                INSTITUTIONAL NEWSROOM
              </span>
              <h1 className="mt-3 font-serif text-4xl sm:text-5xl lg:text-6xl text-ink tracking-tight font-normal">
                News & Dispatches
              </h1>
              <p className="mt-4 text-base sm:text-lg text-stone-4 font-sans leading-relaxed max-w-xl">
                Official announcements, technical milestones, and protocol releases
                from Jakuraa and its flagship machine-commerce platform, Satelink.
              </p>
            </div>

            {/* Right Column: Press & Media Inquiries Card */}
            <div className="lg:col-span-5 rounded-2xl border border-stone-2 bg-ivory-2/50 p-6 sm:p-7 space-y-4">
              <div className="border-b border-stone-2 pb-3">
                <span className="font-mono text-xs text-stone-3 uppercase font-semibold">
                  MEDIA & EDITORIAL RELATIONS
                </span>
              </div>

              <div className="space-y-3 font-sans text-sm">
                <div>
                  <span className="block text-xs font-mono text-stone-3 uppercase">PRESS INQUIRIES</span>
                  <a href="mailto:press@jakuraa.com" className="font-mono text-sm text-green hover:underline">
                    press@jakuraa.com
                  </a>
                </div>

                <div>
                  <span className="block text-xs font-mono text-stone-3 uppercase">NON-MEDIA INQUIRIES</span>
                  <a href="mailto:contact@jakuraa.com" className="font-mono text-sm text-stone-4 hover:text-ink hover:underline">
                    contact@jakuraa.com
                  </a>
                </div>

                <div className="pt-2 border-t border-stone-1 flex items-center justify-between text-xs font-mono">
                  <span className="text-stone-3">BRAND ASSETS & SPECS</span>
                  <Link href="/media-kit" className="text-green hover:underline font-medium">
                    Download Press Kit →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Dispatches Editorial Listing */}
      <section className="py-16 sm:py-20">
        <Container>
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-1 pb-6 mb-10">
            <span className="font-mono text-xs text-stone-3 uppercase tracking-wider">
              PUBLISHED DISPATCHES ({items.length})
            </span>
            <div className="flex items-center gap-3 text-xs font-mono text-stone-3">
              <span>Primary Rail: Base & Polygon PoS</span>
            </div>
          </div>

          <div className="divide-y divide-stone-1 border-b border-stone-1">
            {items.map((n) => (
              <article key={n.slug} className="py-10 first:pt-0">
                <div className="grid gap-6 sm:grid-cols-12 sm:items-baseline">
                  <div className="sm:col-span-3">
                    <time dateTime={n.date} className="font-mono text-xs text-stone-3 block">
                      {formatDate(n.date)}
                    </time>
                    <span className="mt-2 inline-block rounded bg-green-soft px-2 py-0.5 font-mono text-[10px] uppercase font-semibold text-green">
                      Protocol Milestone
                    </span>
                  </div>

                  <div className="sm:col-span-9 space-y-3">
                    <h2 className="font-serif text-2xl sm:text-3xl text-ink hover:text-green transition-colors">
                      <Link href={`/news/${n.slug}`}>
                        {n.title}
                      </Link>
                    </h2>
                    <p className="text-base text-stone-4 font-sans leading-relaxed max-w-3xl">
                      {n.summary}
                    </p>
                    <div className="pt-2">
                      <Link
                        href={`/news/${n.slug}`}
                        className="inline-flex items-center gap-1.5 text-xs font-mono text-green hover:underline font-semibold"
                      >
                        <span>Read full dispatch</span>
                        <span>→</span>
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* Research Cross-Link Feature */}
          <div className="mt-16 rounded-2xl border border-stone-2 bg-ivory-2/40 p-8 sm:p-10">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <span className="font-mono text-xs uppercase tracking-wider text-green font-semibold">
                  TECHNICAL RESEARCH ARCHIVE
                </span>
                <h3 className="mt-2 font-serif text-2xl sm:text-3xl text-ink">
                  Protocol Specifications & Working Papers
                </h3>
                <p className="mt-2 text-sm sm:text-base text-stone-4 font-sans max-w-xl">
                  Deep-dive specifications covering HTTP 402 implementation, RevenueVaultV2 smart contract security, and agent decision microstructure.
                </p>
              </div>
              <ArrowLink href="/research">Explore research archive</ArrowLink>
            </div>
          </div>
        </Container>
      </section>
    </main>
  );
}
