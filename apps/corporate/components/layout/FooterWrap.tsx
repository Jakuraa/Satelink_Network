import React from 'react';
import Link from 'next/link';
import { Github, Mail, Globe, ExternalLink } from 'lucide-react';

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
  theme?: 'dark' | 'light';
}

export function FooterWrap({ config, className = '', theme = 'dark' }: FooterWrapProps) {
  const currentYear = new Date().getFullYear();
  const isDark = theme === 'dark';

  const containerBg = isDark
    ? 'border-t border-white/10 bg-[#0C0B09] text-ivory'
    : 'border-t border-stone-1 bg-ivory-2 text-ink';

  const brandColor = isDark ? 'text-white hover:text-ivory' : 'text-ink hover:opacity-90';
  const taglineColor = isDark ? 'text-stone-3' : 'text-stone-4';
  const descColor = isDark ? 'text-stone-3' : 'text-stone-4';
  const headingColor = isDark ? 'text-ivory' : 'text-ink';
  const linkColor = isDark ? 'text-stone-2 hover:text-white' : 'text-stone-4 hover:text-ink';
  const ruleColor = isDark ? 'border-white/10' : 'border-stone-1';
  const metaTextColor = isDark ? 'text-stone-4' : 'text-stone-3';
  const metaBadgeBorder = isDark ? 'border-white/10 bg-white/5' : 'border-stone-1 bg-ivory';
  const metaValColor = isDark ? 'text-ivory' : 'text-ink';

  return (
    <footer className={`footer_wrap w-full transition-colors ${containerBg} ${className}`}>
      <div className="mx-auto max-w-7xl px-6 py-16 sm:px-8 sm:py-20 lg:px-12">
        {/* Top Institutional Header Strip */}
        <div className="flex flex-col gap-8 pb-12 border-b border-white/10 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-xl">
            <Link
              href={config.brandHref || '/'}
              className={`inline-flex items-center gap-2.5 font-sans text-2xl font-bold tracking-[0.14em] uppercase transition-opacity ${brandColor}`}
              aria-label={config.brandName}
            >
              <span>{config.brandName}</span>
            </Link>
            <p className={`mt-2 text-sm font-medium ${taglineColor}`}>
              {config.brandTagline}
            </p>
            {config.brandDescription && (
              <p className={`mt-3 text-sm leading-relaxed ${descColor}`}>
                {config.brandDescription}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Live System Status Pill */}
            <a
              href="https://status.satelink.network"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 font-mono text-xs text-ivory hover:border-white/30 transition-colors"
            >
              <span className="size-2 rounded-full bg-green animate-pulse" />
              <span>Network Status: Operational</span>
              <span className="text-stone-4">↗</span>
            </a>

            {/* Social / Direct Links */}
            {config.socialLinks && config.socialLinks.length > 0 && (
              <div className="flex items-center gap-2.5">
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
                      className={`inline-flex size-9 items-center justify-center rounded-full border transition-colors ${
                        isDark
                          ? 'border-white/15 text-stone-3 hover:border-ivory hover:text-white bg-white/5'
                          : 'border-stone-2 text-stone-4 hover:border-ink hover:text-ink'
                      }`}
                    >
                      <Icon className="size-4" />
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 6-Column Navigation Grid */}
        <div className="pt-12 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-8 sm:gap-6">
          {config.columns.map((col) => (
            <div key={col.heading} className="flex flex-col">
              <h3 className={`text-xs font-mono font-semibold uppercase tracking-wider mb-4 ${headingColor}`}>
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
                        className={`group inline-flex items-center gap-1.5 text-sm transition-colors ${linkColor}`}
                      >
                        <span>{link.label}</span>
                        <svg
                          className="size-3 text-stone-4 transition-colors group-hover:text-white opacity-80"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                          aria-hidden="true"
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
                        className={`inline-flex items-center gap-1.5 text-sm transition-colors ${linkColor}`}
                      >
                        <span>{link.label}</span>
                        {link.badge && (
                          <span className="rounded bg-white/10 px-1.5 py-0.2 font-mono text-[9px] uppercase font-semibold text-green">
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

        {/* Institutional Metadata Badges Strip */}
        {config.metaBadges && config.metaBadges.length > 0 && (
          <div className="mt-16 pt-8 border-t border-white/10">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
              {config.metaBadges.map((badge) => (
                <div
                  key={badge.label}
                  className={`rounded-lg border px-3.5 py-2.5 font-mono text-xs ${metaBadgeBorder}`}
                >
                  <span className="block text-[10px] text-stone-4 uppercase tracking-wider">
                    {badge.label}
                  </span>
                  <span className={`font-semibold mt-0.5 block ${metaValColor}`}>
                    {badge.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Legal, Statutory & Copyright Strip */}
        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between text-xs">
          <div className="space-y-1.5 font-sans text-stone-3">
            <p>
              &copy; {currentYear} {config.copyrightText || 'Jakuraa Commercial Private Limited. All rights reserved.'}
            </p>
            {config.entityNotice && (
              <p className="font-mono text-[11px] text-stone-4">
                {config.entityNotice}
              </p>
            )}
            {config.addressLines && config.addressLines.length > 0 && (
              <p className="font-sans text-[11px] text-stone-4">
                {config.addressLines.join(' | ')}
              </p>
            )}
          </div>

          {/* Legal Navigation Links */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-sans">
            {config.legalLinks.map((ll) => (
              <Link
                key={ll.href + ll.label}
                href={ll.href}
                className="text-stone-3 hover:text-white transition-colors"
              >
                {ll.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
