'use client';

import React, { useState } from 'react';
import Image from 'next/image';

export interface VideoCardProps {
  title: string;
  description: string;
  category?: string;
  youtubeId?: string;
  videoSrc?: string;
  posterSrc: string;
  year?: string;
  className?: string;
}

export function VideoCard({
  title,
  description,
  category = 'Archival Record',
  youtubeId,
  videoSrc,
  posterSrc,
  year,
  className = '',
}: VideoCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <article
      className={`rounded-2xl border border-stone-1 bg-ivory p-6 shadow-sm transition-all hover:border-stone-3 hover:shadow-md flex flex-col justify-between ${className}`}
    >
      <div>
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-stone-2 bg-stone-1/20">
          {!isPlaying ? (
            <>
              <Image
                src={posterSrc}
                alt={`Poster for ${title}`}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                <button
                  type="button"
                  onClick={() => setIsPlaying(true)}
                  aria-label={`Play video: ${title}`}
                  className="flex size-12 items-center justify-center rounded-full bg-ivory/95 text-ink shadow-lg transition-transform hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-green"
                >
                  <svg className="size-5 fill-current ml-0.5" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>
              </div>
              <span className="absolute top-2.5 right-2.5 rounded bg-ink/80 px-2 py-0.5 font-mono text-[10px] text-ivory backdrop-blur-xs">
                {category}
              </span>
            </>
          ) : youtubeId ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0`}
              title={title}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full border-0"
            />
          ) : videoSrc ? (
            <video
              src={videoSrc}
              controls
              autoPlay
              playsInline
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-ivory-2 p-4 text-center font-mono text-xs text-stone-4">
              Archival video stream previewing via terminal records.
            </div>
          )}
        </div>

        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono text-stone-3">
            <span>{category}</span>
            {year && <span>{year}</span>}
          </div>
          <h4 className="font-serif text-lg font-medium text-ink">
            {title}
          </h4>
          <p className="font-sans text-sm leading-relaxed text-stone-4">
            {description}
          </p>
        </div>
      </div>
    </article>
  );
}
