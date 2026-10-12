'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { historicalChapters, HistoricalChapter, institutionalLearnings } from '@/content/history';
import { HistoricalMediaGallery } from './HistoricalMediaGallery';

export function HistoricalTimeline() {
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'discontinued' | 'completed'>('all');

  const filteredChapters =
    activeFilter === 'all'
      ? historicalChapters
      : historicalChapters.filter((c) => {
          if (activeFilter === 'active') return c.status === 'active';
          if (activeFilter === 'discontinued') return c.status === 'discontinued';
          if (activeFilter === 'completed') return c.status === 'completed' || c.status === 'evolved';
          return true;
        });

  return (
    <div className="w-full">
      {/* Chapter Filter Controls */}
      <div className="mb-12 flex flex-wrap items-center justify-between gap-4 border-b border-stone-1 pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs uppercase tracking-wider text-stone-3 mr-2">
            Filter View:
          </span>
          <button
            onClick={() => setActiveFilter('all')}
            className={`rounded-full px-3.5 py-1 text-xs font-mono transition-colors ${
              activeFilter === 'all'
                ? 'bg-ink text-ivory'
                : 'bg-stone-1/60 text-stone-4 hover:bg-stone-1 hover:text-ink'
            }`}
          >
            All Chapters ({historicalChapters.length})
          </button>
          <button
            onClick={() => setActiveFilter('active')}
            className={`rounded-full px-3.5 py-1 text-xs font-mono transition-colors ${
              activeFilter === 'active'
                ? 'bg-ink text-ivory'
                : 'bg-stone-1/60 text-stone-4 hover:bg-stone-1 hover:text-ink'
            }`}
          >
            Active Platform
          </button>
          <button
            onClick={() => setActiveFilter('discontinued')}
            className={`rounded-full px-3.5 py-1 text-xs font-mono transition-colors ${
              activeFilter === 'discontinued'
                ? 'bg-ink text-ivory'
                : 'bg-stone-1/60 text-stone-4 hover:bg-stone-1 hover:text-ink'
            }`}
          >
            Commercial Experiments & Divested
          </button>
          <button
            onClick={() => setActiveFilter('completed')}
            className={`rounded-full px-3.5 py-1 text-xs font-mono transition-colors ${
              activeFilter === 'completed'
                ? 'bg-ink text-ivory'
                : 'bg-stone-1/60 text-stone-4 hover:bg-stone-1 hover:text-ink'
            }`}
          >
            Origins & Compute Benchmarks
          </button>
        </div>

        <div className="font-mono text-xs text-stone-3">
          Chronology: 2019 to 2026
        </div>
      </div>

      {/* Timeline Chapters */}
      <div className="space-y-24">
        {filteredChapters.map((chapter, index) => {
          const isFlagship = chapter.status === 'active';
          const isDiscontinued = chapter.status === 'discontinued';

          const badgeClasses = isFlagship
            ? 'bg-green-soft text-green border border-green/30'
            : isDiscontinued
            ? 'bg-amber-soft text-amber-ink border border-amber/30'
            : 'bg-stone-1 text-stone-4 border border-stone-2';

          return (
            <article
              key={chapter.id}
              id={chapter.id}
              className="scroll-mt-28 relative border-l-2 border-stone-1 pl-6 md:pl-12"
            >
              {/* Year Marker Pin */}
              <div className="absolute -left-[9px] top-1.5 size-4 rounded-full border-2 border-ivory bg-stone-3" />

              {/* Eyebrow & Metadata Header */}
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-xs font-semibold uppercase tracking-wider text-stone-3">
                  {chapter.eyebrow}
                </span>
                <span className="font-mono text-xs text-stone-2">/</span>
                <span className="font-mono text-xs font-bold text-ink">
                  {chapter.year}
                </span>
                <span className="font-mono text-xs text-stone-3">
                  ({chapter.period})
                </span>
                <span
                  className={`ml-auto rounded px-2.5 py-0.5 font-mono text-[11px] font-semibold ${badgeClasses}`}
                >
                  {chapter.statusLabel}
                </span>
              </div>

              {/* Chapter Title */}
              <h2 className="mt-3 font-serif text-2xl sm:text-3xl md:text-4xl font-normal tracking-tight text-ink">
                {chapter.title}
              </h2>

              {/* Summary */}
              <p className="mt-4 font-serif text-lg leading-relaxed text-stone-4 max-w-3xl">
                {chapter.summary}
              </p>

              {/* Narrative Paragraphs */}
              <div className="mt-6 space-y-4 max-w-3xl font-sans text-sm sm:text-base leading-relaxed text-stone-4">
                {chapter.narrative.map((p, idx) => (
                  <p key={idx}>{p}</p>
                ))}
              </div>

              {/* Key Facts Specification Table */}
              {chapter.keyFacts && chapter.keyFacts.length > 0 && (
                <div className="mt-8 max-w-3xl rounded-lg border border-stone-1 bg-ivory-2/60 p-5">
                  <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-stone-3 mb-3">
                    Operational Parameters
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                    {chapter.keyFacts.map((fact) => (
                      <div
                        key={fact.label}
                        className="flex flex-col border-b border-stone-1/60 pb-2 sm:border-b-0 sm:pb-0"
                      >
                        <span className="text-stone-3">{fact.label}</span>
                        <span className="mt-0.5 font-sans font-medium text-ink">
                          {fact.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Media Gallery */}
              {chapter.media && chapter.media.length > 0 && (
                <div className="mt-8">
                  <HistoricalMediaGallery items={chapter.media} />
                </div>
              )}

              {/* Lessons Learned */}
              {chapter.lessonsLearned && chapter.lessonsLearned.length > 0 && (
                <div className="mt-8 max-w-3xl rounded-lg border border-stone-1 bg-ivory p-6">
                  <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-amber-ink mb-3">
                    Institutional Truth & Operational Takeaways
                  </h3>
                  <ul className="space-y-2">
                    {chapter.lessonsLearned.map((lesson, lIdx) => (
                      <li key={lIdx} className="flex items-start gap-2 text-sm text-stone-4">
                        <span className="mt-1 size-1.5 rounded-full bg-amber shrink-0" />
                        <span>{lesson}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Flagship CTA link if active */}
              {isFlagship && (
                <div className="mt-8 inline-flex items-center gap-3">
                  <a
                    href="https://satelink.network"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-2.5 font-sans text-sm font-medium text-ivory hover:bg-stone-4 transition-colors"
                  >
                    <span>Launch Satelink Protocol</span>
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                  <Link
                    href="/technology"
                    className="inline-flex items-center gap-2 rounded-full border border-stone-2 px-6 py-2.5 font-sans text-sm font-medium text-ink hover:border-stone-4 hover:bg-ivory-2 transition-colors"
                  >
                    <span>Read Architecture</span>
                  </Link>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {/* Synthesis Section: What Seven Years of Real Operations Taught Us */}
      <section className="mt-28 border-t border-stone-1 pt-16">
        <div className="max-w-3xl">
          <span className="font-mono text-xs uppercase tracking-wider text-stone-3">
            SYNTHESIS & RETROSPECTIVE
          </span>
          <h2 className="mt-2 font-serif text-3xl sm:text-4xl font-normal text-ink">
            What Seven Years of Real Operations Taught Us
          </h2>
          <p className="mt-4 font-serif text-lg leading-relaxed text-stone-4">
            Jakuraa did not arrive at machine commerce through theoretical speculation. We arrived
            there because we ran physical grocery checkouts, staged industrial motor warehouses,
            managed restaurant dining floors, and calibrated GPU mining rigs.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
          {institutionalLearnings.map((item) => (
            <div
              key={item.theme}
              className="rounded-lg border border-stone-1 bg-ivory-2/40 p-6 transition-colors hover:border-stone-2"
            >
              <h3 className="font-serif text-lg font-medium text-ink">
                {item.theme}
              </h3>
              <p className="mt-3 font-sans text-sm leading-relaxed text-stone-4">
                {item.realization}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
