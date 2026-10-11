'use client';

import React, { useState } from 'react';
import Image from 'next/image';

interface ConversationVideoProps {
  videoId: string;
  title: string;
  author: string;
  description: string;
  posterSrc: string;
  youtubeUrl: string;
  className?: string;
}

export function ConversationVideo({
  videoId,
  title,
  author,
  description,
  posterSrc,
  youtubeUrl,
  className = '',
}: ConversationVideoProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className={`overflow-hidden rounded-2xl border border-stone-2 bg-ivory shadow-sm ${className}`}>
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#0d0c0a]">
        {!isPlaying ? (
          <div className="group relative h-full w-full cursor-pointer" onClick={() => setIsPlaying(true)}>
            <Image
              src={posterSrc}
              alt={`Video thumbnail: ${title}`}
              fill
              sizes="(max-width: 1024px) 100vw, 65vw"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02]"
              priority={false}
            />
            {/* Subtle dark gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent transition-opacity group-hover:opacity-90" />

            {/* Play Button */}
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPlaying(true);
                }}
                aria-label={`Play video: ${title}`}
                className="flex size-16 items-center justify-center rounded-full bg-ivory text-ink shadow-2xl transition-all duration-200 ease-out hover:scale-110 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-green"
              >
                <svg className="size-6 fill-current ml-1" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </button>
            </div>

            {/* Top metadata strip */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
              <span className="rounded-full bg-black/60 px-3 py-1 font-mono text-[11px] text-ivory backdrop-blur-md">
                Source: {author}
              </span>
              <span className="rounded-full bg-green/90 px-3 py-1 font-mono text-[10px] uppercase font-semibold text-ivory backdrop-blur-md">
                Verified Analysis
              </span>
            </div>

            {/* Bottom title strip */}
            <div className="absolute bottom-4 left-4 right-4 text-ivory">
              <p className="font-serif text-lg font-medium sm:text-xl line-clamp-1 drop-shadow-md">
                {title}
              </p>
              <p className="font-mono text-xs text-stone-3 mt-0.5">
                Click to load privacy-protected stream
              </p>
            </div>
          </div>
        ) : (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
            title={title}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full border-0"
          />
        )}
      </div>

      <div className="p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-stone-3 border-b border-stone-1 pb-4">
          <div className="flex items-center gap-2">
            <span className="text-green font-semibold uppercase">PERSPECTIVE</span>
            <span>/</span>
            <span>CHANNEL: {author}</span>
          </div>
          <a
            href={youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-stone-4 hover:text-ink transition-colors font-medium"
          >
            <span>Watch on YouTube</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor">
              <path d="M2.5 9.5L9.5 2.5M9.5 2.5V8.5M9.5 2.5H3.5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
        </div>

        <h3 className="mt-4 font-serif text-xl sm:text-2xl text-ink">
          {title}
        </h3>
        <p className="mt-3 text-sm sm:text-base leading-relaxed text-stone-4 font-sans">
          {description}
        </p>
      </div>
    </div>
  );
}
