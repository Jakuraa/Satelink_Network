'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, ArrowUpRight, Menu, X, ArrowRight, Shield, Cpu, Layers } from 'lucide-react';
import { corporateNavMenus, CorporateMenu, NavItem } from '@/content/navigation';

const HOVER_INTENT_MS = 140;

export function SiteHeader() {
  const pathname = usePathname();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mobileExpandedGroup, setMobileExpandedGroup] = useState<string | null>(null);

  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggersRef = useRef<Record<string, HTMLButtonElement | null>>({});
  const menuContainerRef = useRef<HTMLDivElement>(null);

  const clearTimer = () => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  };

  const scheduleOpen = (label: string) => {
    clearTimer();
    hoverTimer.current = setTimeout(() => {
      setActiveMenu(label);
    }, HOVER_INTENT_MS);
  };

  const scheduleClose = () => {
    clearTimer();
    hoverTimer.current = setTimeout(() => {
      setActiveMenu(null);
    }, HOVER_INTENT_MS);
  };

  const closeMenu = (returnFocus = false) => {
    const current = activeMenu;
    setActiveMenu(null);
    if (returnFocus && current) {
      triggersRef.current[current]?.focus();
    }
  };

  // Keyboard accessibility: Escape closes dropdown / mobile drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeMenu) {
          closeMenu(true);
        }
        if (isMobileMenuOpen) {
          setIsMobileMenuOpen(false);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeMenu, isMobileMenuOpen]);

  // Lock body scroll on mobile drawer open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  // Close menus on route change
  useEffect(() => {
    setActiveMenu(null);
    setIsMobileMenuOpen(false);
  }, [pathname]);

  return (
    <>
      <header className="sticky top-0 z-40 h-18 bg-ivory/92 backdrop-blur-md border-b border-stone-2/70 transition-colors">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 z-50 bg-ink text-ivory px-4 py-2 rounded-md font-mono text-xs outline-none ring-2 ring-green"
        >
          Skip to content
        </a>

        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Brand Mark (Left) */}
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="group flex items-center gap-2.5 font-sans font-bold text-lg tracking-[0.12em] uppercase text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-green rounded p-1"
              aria-label="Jakuraa Commercial Private Limited Homepage"
            >
              <span className="flex size-7 items-center justify-center rounded border border-stone-3/60 bg-stone-1 font-serif text-sm font-semibold text-ink transition-colors group-hover:border-ink">
                J
              </span>
              <span>JAKURAA</span>
            </Link>
          </div>

          {/* Desktop Navigation with Dropdowns (Right-Aligned) */}
          <nav
            ref={menuContainerRef}
            className="hidden md:flex items-center space-x-1 lg:space-x-2"
            aria-label="Primary Corporate Navigation"
            onMouseLeave={scheduleClose}
          >
            {corporateNavMenus.map((menu) => {
              const isOpen = activeMenu === menu.label;
              const hasDropdown = Boolean(menu.groups && menu.groups.length > 0);
              const panelId = `corp-menu-${menu.label.toLowerCase()}`;

              if (!hasDropdown && menu.href) {
                const isActive = pathname === menu.href || pathname.startsWith(`${menu.href}/`);
                return (
                  <Link
                    key={menu.label}
                    href={menu.href}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green ${
                      isActive ? 'text-ink bg-stone-1/60 font-semibold' : 'text-stone-4 hover:text-ink hover:bg-stone-1/40'
                    }`}
                  >
                    {menu.label}
                  </Link>
                );
              }

              return (
                <div
                  key={menu.label}
                  className="relative"
                  onMouseEnter={() => scheduleOpen(menu.label)}
                  onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                      setActiveMenu((curr) => (curr === menu.label ? null : curr));
                    }
                  }}
                >
                  <button
                    ref={(el) => {
                      triggersRef.current[menu.label] = el;
                    }}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    id={`trigger-${menu.label}`}
                    onClick={() => setActiveMenu(isOpen ? null : menu.label)}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setActiveMenu(menu.label);
                        requestAnimationFrame(() => {
                          const firstLink = document.querySelector<HTMLAnchorElement>(`#${panelId} a`);
                          firstLink?.focus();
                        });
                      }
                    }}
                    className={`inline-flex items-center gap-1 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green ${
                      isOpen
                        ? 'bg-stone-1 text-ink font-semibold'
                        : 'text-stone-4 hover:text-ink hover:bg-stone-1/40'
                    }`}
                  >
                    <span>{menu.label}</span>
                    <ChevronDown
                      className={`size-3.5 text-stone-3 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-ink' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </button>

                  {/* Dropdown Panel (Reference C Specification) */}
                  {isOpen && (
                    <div
                      id={panelId}
                      role="region"
                      aria-labelledby={`trigger-${menu.label}`}
                      onMouseEnter={clearTimer}
                      onMouseLeave={scheduleClose}
                      className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-[540px] lg:w-[620px] rounded-2xl border border-stone-2 bg-ivory p-6 shadow-2xl transition-all duration-200 ease-out z-50 animate-in fade-in-0 slide-in-from-top-2"
                    >
                      <div className="grid grid-cols-12 gap-6">
                        {/* Grouped Navigation Links */}
                        <div className={menu.highlight ? 'col-span-7 space-y-6' : 'col-span-12 grid grid-cols-2 gap-6'}>
                          {menu.groups?.map((group) => (
                            <div key={group.title || 'links'} className="space-y-2.5">
                              {group.title && (
                                <h4 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-stone-3">
                                  {group.title}
                                </h4>
                              )}
                              <ul className="space-y-1">
                                {group.items.map((item) => {
                                  const isExternal = item.external || item.href.startsWith('http');
                                  const LinkComp = isExternal ? 'a' : Link;
                                  const linkProps = isExternal
                                    ? { href: item.href, target: '_blank', rel: 'noopener noreferrer' }
                                    : { href: item.href };

                                  return (
                                    <li key={item.label + item.href}>
                                      <LinkComp
                                        {...linkProps}
                                        onClick={() => closeMenu()}
                                        className="group -mx-2 flex flex-col rounded-lg p-2 transition-colors hover:bg-stone-1/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-green"
                                      >
                                        <div className="flex items-center gap-1.5 text-sm font-medium text-ink group-hover:text-ink">
                                          <span>{item.label}</span>
                                          {item.badge && (
                                            <span className="rounded bg-green/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-green">
                                              {item.badge}
                                            </span>
                                          )}
                                          {isExternal && (
                                            <ArrowUpRight className="size-3 text-stone-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-ink" />
                                          )}
                                        </div>
                                        {item.description && (
                                          <p className="mt-0.5 text-xs text-stone-4 leading-normal">
                                            {item.description}
                                          </p>
                                        )}
                                      </LinkComp>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          ))}
                        </div>

                        {/* Highlight Feature Card (Optional) */}
                        {menu.highlight && (
                          <div className="col-span-5 flex flex-col justify-between rounded-xl border border-stone-2 bg-stone-1/40 p-4">
                            <div>
                              {menu.highlight.eyebrow && (
                                <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-green">
                                  {menu.highlight.eyebrow}
                                </span>
                              )}
                              <h5 className="mt-1 font-serif text-base font-semibold text-ink">
                                {menu.highlight.title}
                              </h5>
                              <p className="mt-2 text-xs leading-relaxed text-stone-4">
                                {menu.highlight.description}
                              </p>
                            </div>
                            <div className="mt-4 pt-3 border-t border-stone-2/60">
                              {menu.highlight.external ? (
                                <a
                                  href={menu.highlight.href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={() => closeMenu()}
                                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink hover:text-green transition-colors"
                                >
                                  <span>Learn more</span>
                                  <ArrowUpRight className="size-3" />
                                </a>
                              ) : (
                                <Link
                                  href={menu.highlight.href}
                                  onClick={() => closeMenu()}
                                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink hover:text-green transition-colors"
                                >
                                  <span>Explore details</span>
                                  <ArrowRight className="size-3" />
                                </Link>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Direct Contact Link */}
            <Link
              href="/contact"
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green ${
                pathname === '/contact'
                  ? 'text-ink bg-stone-1/60 font-semibold'
                  : 'text-stone-4 hover:text-ink hover:bg-stone-1/40'
              }`}
            >
              Contact
            </Link>

            {/* Primary Action CTA (External Satelink Link) */}
            <div className="pl-3">
              <a
                href="https://satelink.network"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-medium text-ivory hover:bg-stone-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green shadow-sm"
              >
                <span>Satelink Platform</span>
                <ArrowUpRight className="size-3 opacity-80" />
              </a>
            </div>
          </nav>

          {/* Mobile Menu Hamburger Button */}
          <div className="flex items-center md:hidden">
            <button
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-lg text-ink hover:bg-stone-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-green"
              aria-controls="corporate-mobile-menu"
              aria-expanded={isMobileMenuOpen}
              aria-label={isMobileMenuOpen ? 'Close mobile menu' : 'Open mobile menu'}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
            </button>
          </div>
        </div>
      </header>

      {/* Backdrop for desktop dropdowns */}
      {activeMenu && (
        <div
          aria-hidden="true"
          className="fixed inset-0 top-18 z-30 hidden md:block bg-black/10 backdrop-blur-[1px]"
          onClick={() => closeMenu()}
          onMouseEnter={scheduleClose}
        />
      )}

      {/* Mobile Navigation Drawer */}
      {isMobileMenuOpen && (
        <div
          id="corporate-mobile-menu"
          className="fixed inset-x-0 bottom-0 top-18 z-40 bg-ivory md:hidden overflow-y-auto border-t border-stone-2"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation"
        >
          <div className="px-6 py-8 space-y-6">
            <div className="space-y-4">
              {corporateNavMenus.map((menu) => {
                const isExpanded = mobileExpandedGroup === menu.label;

                return (
                  <div key={menu.label} className="border-b border-stone-2/70 pb-4">
                    <button
                      type="button"
                      onClick={() => setMobileExpandedGroup(isExpanded ? null : menu.label)}
                      className="flex w-full items-center justify-between font-serif text-2xl font-semibold text-ink text-left"
                      aria-expanded={isExpanded}
                    >
                      <span>{menu.label}</span>
                      <ChevronDown
                        className={`size-5 text-stone-3 transition-transform ${
                          isExpanded ? 'rotate-180 text-ink' : ''
                        }`}
                      />
                    </button>

                    {isExpanded && menu.groups && (
                      <div className="mt-4 pl-2 space-y-4 animate-in fade-in-0 duration-150">
                        {menu.groups.map((group) => (
                          <div key={group.title || 'group'} className="space-y-2">
                            {group.title && (
                              <span className="font-mono text-[10px] uppercase tracking-wider text-stone-3">
                                {group.title}
                              </span>
                            )}
                            <ul className="space-y-2 pl-2 border-l border-stone-2">
                              {group.items.map((item) => {
                                const isExternal = item.external || item.href.startsWith('http');
                                const Comp = isExternal ? 'a' : Link;
                                const props = isExternal
                                  ? { href: item.href, target: '_blank', rel: 'noopener noreferrer' }
                                  : { href: item.href };

                                return (
                                  <li key={item.label}>
                                    <Comp
                                      {...props}
                                      onClick={() => setIsMobileMenuOpen(false)}
                                      className="flex items-center justify-between py-1 text-sm font-medium text-stone-4 hover:text-ink"
                                    >
                                      <span>{item.label}</span>
                                      {item.badge && (
                                        <span className="rounded bg-green/10 px-1.5 py-0.5 font-mono text-[10px] text-green">
                                          {item.badge}
                                        </span>
                                      )}
                                      {isExternal && <ArrowUpRight className="size-3 text-stone-3" />}
                                    </Comp>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="border-b border-stone-2/70 pb-4">
                <Link
                  href="/contact"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block font-serif text-2xl font-semibold text-ink"
                >
                  Contact
                </Link>
              </div>
            </div>

            {/* Mobile Footer Area */}
            <div className="pt-6 space-y-4">
              <a
                href="https://satelink.network"
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-full bg-ink py-3 text-sm font-medium text-ivory"
              >
                <span>Explore Satelink Platform</span>
                <ArrowUpRight className="size-4" />
              </a>

              <div className="pt-4 text-center font-mono text-[11px] text-stone-3">
                <p>Jakuraa Commercial Private Limited</p>
                <p className="mt-1">Established 2019 · Coimbatore, India</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
