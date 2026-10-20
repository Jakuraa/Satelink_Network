'use client';

import { useRef } from 'react';
import { m, LazyMotion, domAnimation, useInView, useReducedMotion } from 'framer-motion';

interface ScrollRevealProps {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'span';
}

export function ScrollReveal({ 
  children, 
  delay = 0, 
  y = 16, 
  className,
  as = 'div'
}: ScrollRevealProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -12% 0px' });
  
  if (reduce) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }

  const Comp = m[as];
  return (
    <LazyMotion features={domAnimation}>
      <Comp
        ref={ref as never}
        className={className}
        initial={{ opacity: 0, y }}
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y }}
        transition={{ 
          duration: 0.5, 
          ease: [0.23, 1, 0.32, 1], 
          delay: delay / 1000 
        }}
      >
        {children}
      </Comp>
    </LazyMotion>
  );
}
