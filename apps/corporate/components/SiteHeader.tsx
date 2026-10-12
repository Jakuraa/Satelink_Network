'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_LINKS = [
  { label: 'Systems', href: '/systems' },
  { label: 'Research', href: '/research' },
  { label: 'Technology', href: '/technology' },
  { label: 'History', href: '/history' },
  { label: 'Company', href: '/company' },
  { label: 'Contact', href: '/contact' },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };

    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleEscape);
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    // Close mobile menu on route change
    setIsMobileMenuOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 h-16 bg-ivory/90 backdrop-blur-md flex flex-col justify-center">
      <a 
        href="#main" 
        className="absolute -top-[100%] left-4 z-50 bg-ink text-ivory px-4 py-2 focus:top-4 focus:outline-none focus-visible:outline-2 focus-visible:outline-green focus-visible:outline-offset-3 transition-transform duration-200 ease-out"
      >
        Skip to content
      </a>

      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 flex items-center justify-between h-full">
        <div className="flex-shrink-0 flex items-center relative z-50">
          <Link 
            href="/" 
            className="font-sans font-bold text-lg tracking-[0.12em] uppercase text-ink hover:text-ink/80 transition-colors duration-200 ease-out focus:outline-none focus-visible:outline-2 focus-visible:outline-green focus-visible:outline-offset-3 touch-manipulation"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="JAKURAA"
          >
            JAKURAA
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-8">
          {NAV_LINKS.map((link) => {
            const isActive = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-[15px] font-sans transition-colors duration-200 ease-out focus:outline-none focus-visible:outline-2 focus-visible:outline-green focus-visible:outline-offset-3 touch-manipulation ${
                  isActive ? 'text-ink' : 'text-stone-4 hover:text-ink'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                {link.label}
              </Link>
            );
          })}
          
          <a 
            href="https://satelink.network" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-[15px] font-sans text-stone-4 hover:text-ink transition-colors duration-200 ease-out flex items-center gap-1 focus:outline-none focus-visible:outline-2 focus-visible:outline-green focus-visible:outline-offset-3 touch-manipulation"
          >
            Satelink
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="opacity-70">
              <path d="M2.5 9.5L9.5 2.5M9.5 2.5V8.5M9.5 2.5H3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
        </nav>

        {/* Mobile menu button */}
        <div className="flex items-center md:hidden relative z-50">
          <button
            type="button"
            className="text-ink hover:text-ink/80 focus:outline-none focus-visible:outline-2 focus-visible:outline-green focus-visible:outline-offset-3 touch-manipulation p-2 -mr-2"
            aria-controls="mobile-menu"
            aria-expanded={isMobileMenuOpen}
            aria-label={isMobileMenuOpen ? "Close main menu" : "Open main menu"}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <span className="sr-only">{isMobileMenuOpen ? 'Close menu' : 'Open menu'}</span>
            <div className="w-6 h-5 relative flex flex-col justify-between">
              <span className={`block h-[2px] w-full bg-current transition-transform duration-300 ease-out ${isMobileMenuOpen ? 'rotate-45 translate-y-[9px]' : ''}`} />
              <span className={`block h-[2px] w-full bg-current transition-opacity duration-300 ease-out ${isMobileMenuOpen ? 'opacity-0' : 'opacity-100'}`} />
              <span className={`block h-[2px] w-full bg-current transition-transform duration-300 ease-out ${isMobileMenuOpen ? '-rotate-45 -translate-y-[9px]' : ''}`} />
            </div>
          </button>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      <div 
        id="mobile-menu"
        ref={menuRef}
        className={`fixed inset-0 z-40 bg-ivory md:hidden pt-20 flex flex-col transition-opacity duration-300 ease-out ${
          isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!isMobileMenuOpen}
      >
        <div className="flex-1 px-4 pt-8 pb-12 overflow-y-auto flex flex-col">
          <nav className="flex flex-col space-y-6">
            {NAV_LINKS.map((link) => {
              const isActive = pathname.startsWith(link.href);
              return (
                <div key={link.href} className="border-b border-stone-1 pb-6">
                  <Link
                    href={link.href}
                    className={`block font-serif text-3xl tracking-tight transition-colors duration-200 ease-out focus:outline-none focus-visible:outline-2 focus-visible:outline-green focus-visible:outline-offset-3 touch-manipulation ${
                      isActive ? 'text-ink' : 'text-stone-4 hover:text-ink'
                    }`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {link.label}
                  </Link>
                </div>
              );
            })}
          </nav>
          
          <div className="mt-auto pt-8">
            <a 
              href="https://satelink.network" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 font-serif text-3xl tracking-tight text-stone-4 hover:text-ink transition-colors duration-200 ease-out focus:outline-none focus-visible:outline-2 focus-visible:outline-green focus-visible:outline-offset-3 touch-manipulation"
            >
              Satelink
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="opacity-70">
                <path d="M5 19L19 5M19 5V17M19 5H7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
