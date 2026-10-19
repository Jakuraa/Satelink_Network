// Data-driven mega-footer (§7 / Section 4 & 5). Reconstructed to match Anthropic reference:
// Full-scale editorial canvas, brand mark & statutory identity on the left,
// 5 aligned columns with stacked grouped sub-sections on the right, and distinct bottom strip.
import React from "react";
import Link from "next/link";
import { ThemeToggle } from "../ui/ThemeToggle";
import { Wordmark } from "./Wordmark";

export type FLink = {
  label: string;
  href: string;
  hideWhenEmptyCollection?: string;
  badge?: string;
  external?: boolean;
};

export type FSection = {
  title: string;
  links: FLink[];
};

export type FColumn = {
  title: string;
  links: FLink[];
  sections?: FSection[];
};

export type FooterData = {
  columns: FColumn[];
  secondary: FColumn[];
  social: { platform: string; href: string }[];
};

export function DataFooter({
  footer,
  entity,
  /** Collections known to be empty → their links are hidden (§7 auto-hide). */
  emptyCollections = [],
}: {
  footer: FooterData;
  entity: { name: string; addressOneLine: string };
  emptyCollections?: string[];
}) {
  const visible = (links: FLink[]) =>
    links.filter((l) => !(l.hideWhenEmptyCollection && emptyCollections.includes(l.hideWhenEmptyCollection)));
  const year = new Date().getFullYear();

  // Extract legal links from secondary or fallback
  const legalLinks = footer.secondary?.[0]?.links || [
    { label: "Privacy policy", href: "/privacy" },
    { label: "Terms of service", href: "/terms" },
    { label: "Refund & Cancellation", href: "/refund" },
    { label: "Billing & payment policy", href: "/billing-policy" },
    { label: "Security disclosure", href: "/responsible-disclosure" },
    { label: "Acceptable use policy", href: "/acceptable-use" },
  ];

  return (
    <footer className="w-full border-t border-stone-800 bg-stone-950 text-stone-100 transition-colors" data-testid="mega-footer">
      <div className="mx-auto max-w-[1360px] px-6 py-16 sm:px-8 sm:py-20 lg:py-24">
        {/* Main Composition Grid: Brand identity on upper-left, Multi-column stacked navigation on the right */}
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-12 lg:gap-12">
          {/* Brand & Identity Area (Left) */}
          <div className="flex flex-col lg:col-span-4 xl:col-span-4 max-w-sm">
            <Link
              href="/"
              className="inline-flex items-center text-stone-100 hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              aria-label="Satelink Homepage"
            >
              <Wordmark />
            </Link>

            <p className="mt-4 text-sm leading-relaxed text-stone-400">
              AI-agent assistance and machine-commerce infrastructure for software agents and machines to discover, evaluate, access, use, meter, and pay for supported digital services programmatically.
            </p>

            {/* Live Operational Network Status Indicator */}
            <div className="mt-6">
              <a
                href="https://status.satelink.network"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 font-mono text-xs text-stone-200 transition-colors hover:border-white/25 hover:bg-white/10"
              >
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
                <span className="font-medium">Network: Operational</span>
                <span className="text-stone-500 text-[10px]">↗</span>
              </a>
            </div>

            {/* Direct Connect / Developer Links */}
            <div className="mt-6 flex items-center gap-3">
              <a
                href="https://github.com/Jakuraa/Satelink_Network"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub Repository"
                className="inline-flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-stone-400 transition-colors hover:border-white/30 hover:text-white"
              >
                <svg className="size-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
              </a>
              <a
                href="mailto:satelinknetwork@gmail.com"
                aria-label="Direct Technical Support"
                className="inline-flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-stone-400 transition-colors hover:border-white/30 hover:text-white"
              >
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </a>
              <a
                href="https://jakuraa.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Jakuraa Commercial Parent Enterprise"
                className="inline-flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-stone-400 transition-colors hover:border-white/30 hover:text-white"
              >
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-.778.099-1.533.284-2.253" />
                </svg>
              </a>
              <a
                href="/.well-known/satelink.json"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Machine Manifest Discovery"
                className="inline-flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 font-mono text-[10px] text-stone-400 transition-colors hover:border-white/30 hover:text-white"
              >
                JSON
              </a>
            </div>

            {/* Operator & Statutory Attestation */}
            <div className="mt-8 rounded-lg border border-white/10 bg-white/[0.02] p-3.5 text-xs text-stone-500 leading-relaxed">
              <span className="font-semibold text-stone-400 block mb-1">Corporate Operator</span>
              Operated by <strong className="text-stone-200 font-medium">Jakuraa Commercial Private Limited</strong> (CIN: U52190TZ2019PTC033093), incorporated in Coimbatore, Tamil Nadu, India.
            </div>
          </div>

          {/* Right Navigation: 5 tall multi-column sections with stacked link groups */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-8 xl:col-span-8 lg:grid-cols-5 lg:gap-6">
            {footer.columns.map((col) => (
              <FooterCol key={col.title} column={col} emptyCollections={emptyCollections} />
            ))}
          </div>
        </div>

        {/* Bottom Bar: Horizontal divider, statutory credentials, verified legal links & theme toggle */}
        <div className="mt-16 flex flex-col gap-6 border-t border-stone-800 pt-8 text-xs text-stone-500 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p>
              &copy; {year} {entity.name}. All rights reserved.
            </p>
            <p className="font-mono text-[11px] text-stone-500/90">
              Operated by Jakuraa Commercial Private Limited &bull; {entity.addressOneLine}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {legalLinks.map((l) => (
              <Link
                key={l.href + l.label}
                href={l.href}
                className="text-stone-500 transition-colors hover:text-stone-200"
              >
                {l.label}
              </Link>
            ))}
            <div className="ml-2 pl-2 border-l border-white/10">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  column,
  emptyCollections,
}: {
  column: FColumn;
  emptyCollections: string[];
}) {
  const visible = (links: FLink[]) =>
    links.filter((l) => !(l.hideWhenEmptyCollection && emptyCollections.includes(l.hideWhenEmptyCollection)));

  // If column provides structured stacked sub-sections, render each stacked section!
  if (column.sections && column.sections.length > 0) {
    return (
      <div className="flex flex-col space-y-8">
        {column.sections.map((sec) => {
          const links = visible(sec.links);
          if (!links.length) return null;
          return (
            <div key={sec.title} className="flex flex-col">
              <h3 className="mb-3.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                {sec.title}
              </h3>
              <ul className="space-y-2">
                {links.map((l) => (
                  <FooterLinkItem key={l.href + l.label} link={l} />
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    );
  }

  // Fallback to single link group
  const links = visible(column.links);
  if (!links.length) return null;
  return (
    <div className="flex flex-col">
      <h3 className="mb-3.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-stone-400">
        {column.title}
      </h3>
      <ul className="space-y-2">
        {links.map((l) => (
          <FooterLinkItem key={l.href + l.label} link={l} />
        ))}
      </ul>
    </div>
  );
}

function FooterLinkItem({ link }: { link: FLink }) {
  const isExternal = link.external || link.href.startsWith("http");
  return (
    <li>
      {isExternal ? (
        <a
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex items-center gap-1.5 text-xs sm:text-sm text-stone-400 transition-colors hover:text-white"
        >
          <span>{link.label}</span>
          <svg
            className="size-3 text-stone-500 transition-colors group-hover:text-white shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      ) : (
        <Link
          href={link.href}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-stone-400 transition-colors hover:text-white"
        >
          <span>{link.label}</span>
          {link.badge && (
            <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-emerald-400 font-semibold">
              {link.badge}
            </span>
          )}
        </Link>
      )}
    </li>
  );
}
