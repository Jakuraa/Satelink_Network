'use client';

import { useRef } from 'react';
import { m, LazyMotion, domAnimation, useInView, useReducedMotion } from 'framer-motion';

interface StaggerGroupProps {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
}

export function StaggerGroup({ children, className, stagger = 0.08 }: StaggerGroupProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -10% 0px' });

  if (reduce) return <div className={className}>{children}</div>;

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        ref={ref}
        className={className}
        initial="hidden"
        animate={inView ? 'show' : 'hidden'}
        variants={{
          show: { transition: { staggerChildren: stagger } },
          hidden: {},
        }}
      >
        {children}
      </m.div>
    </LazyMotion>
  );
}

export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        className={className}
        variants={{
          hidden: { opacity: 0, y: 16 },
          show: { 
            opacity: 1, 
            y: 0, 
            transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] } 
          },
        }}
      >
        {children}
      </m.div>
    </LazyMotion>
  );
}
