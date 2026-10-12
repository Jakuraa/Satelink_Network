'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { HistoricalMediaRef } from '@/content/history';

export interface HistoricalMediaGalleryProps {
  items: HistoricalMediaRef[];
  className?: string;
}

export function HistoricalMediaGallery({ items, className = '' }: HistoricalMediaGalleryProps) {
  const [selectedItem, setSelectedItem] = useState<HistoricalMediaRef | null>(null);

  if (!items || items.length === 0) {
    return null;
  }

  return (
    <div className={`mt-8 w-full ${className}`}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => setSelectedItem(item)}
            className="group cursor-pointer rounded-lg border border-stone-1 bg-ivory p-3 transition-all hover:border-stone-3 hover:shadow-md"
          >
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded bg-stone-1/30">
              <Image
                src={item.localPath}
                alt={item.alt}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
              {item.type === 'video' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
                  <div className="flex size-10 items-center justify-center rounded-full bg-ivory/90 text-ink shadow">
                    <svg className="size-5 fill-current ml-0.5" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              )}
              {item.year && (
                <span className="absolute top-2 right-2 rounded bg-ink/75 px-2 py-0.5 font-mono text-[10px] text-ivory">
                  {item.year}
                </span>
              )}
            </div>
            <div className="mt-3">
              <h4 className="font-serif text-sm font-medium text-ink group-hover:text-amber transition-colors line-clamp-1">
                {item.title}
              </h4>
              <p className="mt-1 font-sans text-xs text-stone-4 line-clamp-2">
                {item.caption}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox Modal */}
      {selectedItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={selectedItem.title}
          onClick={() => setSelectedItem(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[90vh] max-w-4xl w-full overflow-hidden rounded-lg border border-stone-2 bg-ivory p-6 shadow-2xl"
          >
            <button
              onClick={() => setSelectedItem(null)}
              aria-label="Close modal"
              className="absolute top-4 right-4 z-10 flex size-9 items-center justify-center rounded-full bg-stone-1 text-ink hover:bg-stone-2 transition-colors"
            >
              <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="relative aspect-[16/10] w-full overflow-hidden rounded bg-stone-1/20">
              <Image
                src={selectedItem.localPath}
                alt={selectedItem.alt}
                fill
                sizes="100vw"
                className="object-contain"
                priority
              />
            </div>

            <div className="mt-4 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 border-t border-stone-1 pt-4">
              <div>
                <h3 className="font-serif text-lg font-medium text-ink">
                  {selectedItem.title}
                </h3>
                <p className="mt-1 font-sans text-sm text-stone-4">
                  {selectedItem.caption}
                </p>
              </div>
              {selectedItem.year && (
                <span className="font-mono text-xs text-stone-3 shrink-0">
                  Recorded: {selectedItem.year}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
