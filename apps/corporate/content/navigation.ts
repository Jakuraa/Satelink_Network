/**
 * Navigation data for the new site architecture.
 * Provides the structure for global headers and footers.
 */

export type NavItem = {
  label: string;
  href: string;
  external?: boolean;
};

export const primaryNav: readonly NavItem[] = [
  { label: 'Products', href: '/products' },
  { label: 'Systems', href: '/businesses' },
  { label: 'History', href: '/history' },
  { label: 'Research', href: '/news' },
  { label: 'Technology', href: '/technology' },
  { label: 'About', href: '/company' },
  { label: 'Contact', href: '/contact' },
] as const;

export const satelinkNav: NavItem = {
  label: 'Satelink',
  href: 'https://satelink.network',
  external: true,
} as const;

/**
 * Helper to get all internal navigation items.
 */
export const getInternalNav = (): NavItem[] =>
  primaryNav.filter(item => !item.external);
