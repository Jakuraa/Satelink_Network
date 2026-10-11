'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

interface HeroMediaProps {
  /** Path to video source. If not provided, shows placeholder. */
  videoSrc?: string;
  /** Path to poster image for video. */
  posterSrc?: string;
  /** Alt text for accessibility */
  alt?: string;
  className?: string;
}

export function HeroMedia({
  videoSrc,
  posterSrc,
  alt = 'Video placeholder',
  className = '',
}: HeroMediaProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!videoSrc) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '100px', // start loading before it comes into view
        threshold: 0.01,
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [videoSrc]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden rounded-xl bg-[var(--ink)] ${className}`}
      style={{ aspectRatio: '16/9' }}
      aria-label={alt}
      role="img"
    >
      {!videoSrc ? (
        <Placeholder shouldReduceMotion={shouldReduceMotion} />
      ) : (
        <>
          {/* We only render the video source if it's in view to lazy load */}
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            muted
            autoPlay={!shouldReduceMotion}
            playsInline
            loop
            poster={posterSrc}
            aria-hidden="true"
          >
            {isInView && <source src={videoSrc} type="video/mp4" />}
          </video>
        </>
      )}
    </div>
  );
}

function Placeholder({ shouldReduceMotion }: { shouldReduceMotion: boolean | null }) {
  // SVG Grid & Nodes placeholder
  // CSS animations inline for simplicity and self-containment
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[var(--ink)] overflow-hidden">
      <style>
        {`
          @keyframes pulseLine {
            0% { opacity: 0.1; stroke-width: 1; }
            50% { opacity: 0.6; stroke-width: 1.5; }
            100% { opacity: 0.1; stroke-width: 1; }
          }
          @keyframes nodePulse {
            0% { r: 1.5; opacity: 0.5; }
            50% { r: 2.5; opacity: 1; }
            100% { r: 1.5; opacity: 0.5; }
          }
          .anim-line-1 { animation: pulseLine 3s cubic-bezier(0.23, 1, 0.32, 1) infinite; }
          .anim-line-2 { animation: pulseLine 4s cubic-bezier(0.23, 1, 0.32, 1) infinite 1s; }
          .anim-line-3 { animation: pulseLine 3.5s cubic-bezier(0.23, 1, 0.32, 1) infinite 2s; }
          .anim-line-4 { animation: pulseLine 4.5s cubic-bezier(0.23, 1, 0.32, 1) infinite 0.5s; }
          
          .anim-node { animation: nodePulse 4s cubic-bezier(0.23, 1, 0.32, 1) infinite; }
        `}
      </style>
      
      <svg
        className="h-full w-full opacity-60"
        viewBox="0 0 800 450"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        {/* Lines */}
        <g stroke="var(--green)" strokeWidth="1" strokeLinecap="round" opacity="0.3">
          <line x1="100" y1="100" x2="300" y2="150" className={shouldReduceMotion ? '' : 'anim-line-1'} />
          <line x1="300" y1="150" x2="500" y2="100" className={shouldReduceMotion ? '' : 'anim-line-2'} />
          <line x1="500" y1="100" x2="700" y2="250" className={shouldReduceMotion ? '' : 'anim-line-3'} />
          
          <line x1="100" y1="350" x2="300" y2="300" className={shouldReduceMotion ? '' : 'anim-line-4'} />
          <line x1="300" y1="300" x2="500" y2="350" className={shouldReduceMotion ? '' : 'anim-line-1'} />
          <line x1="500" y1="350" x2="700" y2="250" className={shouldReduceMotion ? '' : 'anim-line-2'} />
          
          <line x1="300" y1="150" x2="300" y2="300" className={shouldReduceMotion ? '' : 'anim-line-3'} />
          <line x1="500" y1="100" x2="500" y2="350" className={shouldReduceMotion ? '' : 'anim-line-4'} />
          <line x1="100" y1="100" x2="100" y2="350" className={shouldReduceMotion ? '' : 'anim-line-1'} />
        </g>
        
        {/* Nodes */}
        <g fill="rgba(255, 255, 255, 0.5)">
          <circle cx="100" cy="100" r="1.5" className={shouldReduceMotion ? '' : 'anim-node'} style={{animationDelay: '0s'}} />
          <circle cx="300" cy="150" r="1.5" className={shouldReduceMotion ? '' : 'anim-node'} style={{animationDelay: '1s'}} />
          <circle cx="500" cy="100" r="1.5" className={shouldReduceMotion ? '' : 'anim-node'} style={{animationDelay: '2s'}} />
          <circle cx="700" cy="250" r="1.5" className={shouldReduceMotion ? '' : 'anim-node'} style={{animationDelay: '0.5s'}} />
          <circle cx="100" cy="350" r="1.5" className={shouldReduceMotion ? '' : 'anim-node'} style={{animationDelay: '1.5s'}} />
          <circle cx="300" cy="300" r="1.5" className={shouldReduceMotion ? '' : 'anim-node'} style={{animationDelay: '2.5s'}} />
          <circle cx="500" cy="350" r="1.5" className={shouldReduceMotion ? '' : 'anim-node'} style={{animationDelay: '0.2s'}} />
        </g>
      </svg>
      
      <div className="absolute bottom-4 right-4 text-[10px] uppercase tracking-wider text-white/20 select-none">
        Video placeholder
      </div>
    </div>
  );
}
