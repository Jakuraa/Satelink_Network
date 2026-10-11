import React, { ReactNode } from 'react';
import Link from 'next/link';

export interface HeroCta {
  label: string;
  href: string;
  external?: boolean;
}

export interface HeroWrapProps {
  eyebrow?: ReactNode;
  headline: string | ReactNode;
  description?: string | ReactNode;
  primaryCta?: HeroCta;
  secondaryCta?: HeroCta;
  actions?: ReactNode;
  media?: ReactNode;
  children?: ReactNode;
  contained?: boolean;
  theme?: 'light' | 'dark' | 'band';
  className?: string;
  align?: 'left' | 'center';
}

export function HeroWrap({
  eyebrow,
  headline,
  description,
  primaryCta,
  secondaryCta,
  actions,
  media,
  children,
  contained = true,
  theme = 'light',
  className = '',
  align = 'left',
}: HeroWrapProps) {
  const isBand = theme === 'band';
  const isDark = theme === 'dark';

  const themeClasses = isBand
    ? 'bg-band text-on-band border-b border-on-band-rule/20'
    : isDark
    ? 'bg-ink text-ivory border-b border-stone-1/20'
    : 'bg-ivory text-ink border-b border-stone-1/50';

  const headlineColor = isBand ? 'text-on-band' : isDark ? 'text-ivory' : 'text-ink';
  const descriptionColor = isBand ? 'text-on-band-muted' : isDark ? 'text-stone-3' : 'text-stone-4';

  const primaryBtnClass = isBand
    ? 'bg-ivory text-ink hover:bg-ivory-2'
    : isDark
    ? 'bg-ivory text-ink hover:bg-ivory-2'
    : 'bg-ink text-ivory hover:bg-stone-4';

  const secondaryBtnClass = isBand
    ? 'border border-on-band-rule/40 text-on-band hover:bg-band/50 hover:border-on-band'
    : isDark
    ? 'border border-stone-2 text-ivory hover:bg-stone-2/20'
    : 'border border-stone-2 text-ink hover:border-stone-4 hover:bg-ivory-2';

  const alignClasses = align === 'center' ? 'text-center mx-auto items-center' : 'text-left items-start';

  return (
    <section
      className={`hero_wrap relative w-full pt-20 pb-16 md:pt-28 md:pb-24 transition-colors ${themeClasses} ${className}`}
    >
      <div className={`mx-auto px-6 lg:px-8 ${contained ? 'max-w-7xl' : 'w-full'}`}>
        <div className={`flex flex-col ${alignClasses} max-w-4xl`}>
          {eyebrow && (
            <div className="mb-4 inline-flex items-center gap-2 text-xs font-mono tracking-wider uppercase opacity-80">
              {typeof eyebrow === 'string' ? (
                <span className="rounded px-2 py-0.5 border border-current text-[11px] font-semibold">
                  {eyebrow}
                </span>
              ) : (
                eyebrow
              )}
            </div>
          )}

          <h1
            className={`font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-normal tracking-tight leading-[1.08] ${headlineColor}`}
          >
            {headline}
          </h1>

          {description && (
            <div
              className={`mt-6 text-lg sm:text-xl leading-relaxed font-sans font-light max-w-3xl ${descriptionColor}`}
            >
              {description}
            </div>
          )}

          {(primaryCta || secondaryCta || actions) && (
            <div
              className={`mt-8 flex flex-wrap gap-4 items-center ${
                align === 'center' ? 'justify-center' : 'justify-start'
              }`}
            >
              {primaryCta && (
                primaryCta.external ? (
                  <a
                    href={primaryCta.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium transition-all shadow-sm ${primaryBtnClass}`}
                  >
                    <span>{primaryCta.label}</span>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </a>
                ) : (
                  <Link
                    href={primaryCta.href}
                    className={`inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium transition-all shadow-sm ${primaryBtnClass}`}
                  >
                    <span>{primaryCta.label}</span>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M14 5l7 7m0 0l-7 7m7-7H3"
                      />
                    </svg>
                  </Link>
                )
              )}

              {secondaryCta && (
                secondaryCta.external ? (
                  <a
                    href={secondaryCta.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium transition-all ${secondaryBtnClass}`}
                  >
                    <span>{secondaryCta.label}</span>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </a>
                ) : (
                  <Link
                    href={secondaryCta.href}
                    className={`inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium transition-all ${secondaryBtnClass}`}
                  >
                    <span>{secondaryCta.label}</span>
                  </Link>
                )
              )}

              {actions}
            </div>
          )}
        </div>

        {media && <div className="mt-12 w-full">{media}</div>}
        {children && <div className="mt-8 w-full">{children}</div>}
      </div>
    </section>
  );
}
