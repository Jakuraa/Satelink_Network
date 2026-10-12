import React from 'react';
import Link from 'next/link';
import { Github, Mail, Globe } from 'lucide-react';

export interface FooterLinkItem {
  label: string;
  href: string;
  external?: boolean;
  badge?: string;
}

export interface FooterColumn {
  heading: string;
  links: FooterLinkItem[];
}

export interface FooterSocialLink {
  label: string;
  href: string;
  icon?: 'github' | 'mail' | 'globe';
}

export interface FooterMetaBadge {
  label: string;
  value: string;
}

export interface FooterConfig {
  brandName: string;
  brandTagline: string;
  brandDescription?: string;
  foundedYear?: string;
  brandHref?: string;
  columns: FooterColumn[];
  legalLinks: FooterLinkItem[];
  socialLinks?: FooterSocialLink[];
  copyrightText?: string;
  addressLines?: string[];
  entityNotice?: string;
  metaBadges?: FooterMetaBadge[];
}

export interface FooterWrapProps {
  config: FooterConfig;
  className?: string;
  theme?: 'default' | 'archival' | 'minimal';
}

export function FooterWrap({ config, className = '', theme = 'default' }: FooterWrapProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className={`footer_wrap w-full border-t border-[var(--sl-border,var(--stone-1))] bg-[var(--sl-bg,var(--ivory-2))] text-[var(--sl-text,var(--ink))] transition-colors ${className}`}
    >
      <div className="mx-auto max-w-7xl px-6 py-16 sm:px-8 sm:py-20">
        {/* Main Grid: Brand summary left, Column Navigation right */}
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-8">
          {/* Brand Identity & Mission */}
          <div className="lg:col-span-4 max-w-sm">
            <Link
              href={config.brandHref || '/'}
              className="inline-flex items-center gap-2.5 font-serif text-2xl font-medium tracking-tight text-[var(--sl-text,var(--ink))] hover:opacity-90 transition-opacity"
            >
              <span>{config.brandName}</span>
            </Link>
            <p className="mt-2 text-sm font-medium text-[var(--sl-text,var(--ink))]">
              {config.brandTagline}
            </p>
            {config.brandDescription && (
              <p className="mt-3 text-sm leading-relaxed text-[var(--sl-text-muted,var(--stone-4))]">
                {config.brandDescription}
              </p>
            )}

            {/* Social / Direct Connect */}
            {config.socialLinks && config.socialLinks.length > 0 && (
              <div className="mt-6 flex items-center gap-3">
                {config.socialLinks.map((s) => {
                  const Icon =
                    s.icon === 'github' ? Github : s.icon === 'mail' ? Mail : Globe;
                  return (
                    <a
                      key={s.href + s.label}
                      href={s.href}
                      target={s.href.startsWith('mailto:') ? undefined : '_blank'}
                      rel="noopener noreferrer"
                      aria-label={s.label}
                      className="inline-flex size-9 items-center justify-center rounded-full border border-[var(--sl-border,var(--stone-2))] text-[var(--sl-text-muted,var(--stone-4))] transition-colors hover:border-[var(--sl-text,var(--ink))] hover:text-[var(--sl-text,var(--ink))]"
                    >
                      <Icon className="size-4" />
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {/* Navigation Columns */}
          <div
            className={`lg:col-span-8 grid grid-cols-2 sm:grid-cols-${Math.min(
              config.columns.length,
              4
            )} gap-8 sm:gap-6`}
          >
            {config.columns.map((col) => (
              <div key={col.heading} className="flex flex-col">
                <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[var(--sl-text-subtle,var(--stone-3))] mb-4">
                  {col.heading}
                </h3>
                <ul className="space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link.href + link.label}>
                      {link.external ? (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group inline-flex items-center gap-1.5 text-sm text-[var(--sl-text-muted,var(--stone-4))] transition-colors hover:text-[var(--sl-text,var(--ink))]"
                        >
                          <span>{link.label}</span>
                          <svg
                            className="size-3 text-[var(--sl-text-subtle,var(--stone-3))] group-hover:text-current transition-colors"
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
                          href={link.href}
                          className="inline-flex items-center gap-1.5 text-sm text-[var(--sl-text-muted,var(--stone-4))] transition-colors hover:text-[var(--sl-text,var(--ink))]"
                        >
                          <span>{link.label}</span>
                          {link.badge && (
                            <span className="rounded-full bg-[var(--sl-accent-soft,var(--stone-1))] px-1.5 py-0.2 text-[10px] font-mono text-[var(--sl-text,var(--ink))]">
                              {link.badge}
                            </span>
                          )}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Technical Badges and Corporate Metadata Strip */}
        {config.metaBadges && config.metaBadges.length > 0 && (
          <div className="mt-12 pt-6 border-t border-[var(--sl-border,var(--stone-1))] flex flex-wrap gap-4 text-xs font-mono text-[var(--sl-text-subtle,var(--stone-3))]">
            {config.metaBadges.map((badge) => (
              <div
                key={badge.label}
                className="inline-flex items-center gap-2 rounded border border-[var(--sl-border,var(--stone-1))] px-2.5 py-1"
              >
                <span className="opacity-70">{badge.label}:</span>
                <span className="font-semibold text-[var(--sl-text,var(--ink))]">
                  {badge.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Institutional Bottom Bar */}
        <div className="mt-12 flex flex-col gap-4 border-t border-[var(--sl-border,var(--stone-1))] pt-8 text-xs text-[var(--sl-text-subtle,var(--stone-3))] sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p>
              &copy; {currentYear}{' '}
              {config.copyrightText || `${config.brandName}. All rights reserved.`}
            </p>
            {config.entityNotice && <p>{config.entityNotice}</p>}
            {config.addressLines && config.addressLines.length > 0 && (
              <p className="leading-relaxed">
                {config.addressLines.join(' · ')}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {config.legalLinks.map((link) => (
              <Link
                key={link.href + link.label}
                href={link.href}
                className="transition-colors hover:text-[var(--sl-text,var(--ink))]"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
