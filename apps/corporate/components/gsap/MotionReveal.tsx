'use client';

import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

interface MotionRevealProps {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  duration?: number;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'li' | 'header';
}

export function MotionReveal({
  children,
  delay = 0,
  y = 14,
  duration = 0.5,
  className = '',
  as = 'div',
}: MotionRevealProps) {
  const elementRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!elementRef.current || typeof window === 'undefined') return;

    // Respect user prefers-reduced-motion setting
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      gsap.set(elementRef.current, { opacity: 1, y: 0 });
      return;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        elementRef.current,
        {
          opacity: 0.85,
          y: Math.min(y, 8),
        },
        {
          opacity: 1,
          y: 0,
          duration,
          delay: delay / 1000,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: elementRef.current,
            start: 'top 95%',
            once: true,
          },
        }
      );
    }, elementRef);

    return () => {
      ctx.revert();
    };
  }, [delay, y, duration]);

  const Component = as;

  return (
    <Component ref={elementRef as never} className={className}>
      {children}
    </Component>
  );
}
