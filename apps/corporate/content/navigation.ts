/**
 * Navigation data for the new site architecture.
 * Provides the structure for global headers and footers.
 */

export type NavItem = {
  label: string;
  href: string;
  description?: string;
  external?: boolean;
  badge?: string;
};

export type NavGroup = {
  title?: string;
  items: NavItem[];
};

export type NavHighlight = {
  title: string;
  description: string;
  href: string;
  eyebrow?: string;
  external?: boolean;
};

export type CorporateMenu = {
  label: string;
  href?: string;
  groups?: NavGroup[];
  highlight?: NavHighlight;
};

export const corporateNavMenus: CorporateMenu[] = [
  {
    label: 'Company',
    groups: [
      {
        title: 'Institution',
        items: [
          { label: 'About Jakuraa', href: '/company', description: 'Established 2019 in Coimbatore. Corporate parent of Satelink.' },
          { label: 'Corporate Information', href: '/legal/company-information', description: 'Statutory disclosures, CIN, GSTIN, and IEC registrations.' },
          { label: 'Operating History', href: '/history', description: 'From foundational enterprise systems to autonomous agent rails.' },
        ],
      },
      {
        title: 'People & Governance',
        items: [
          { label: 'Leadership', href: '/company/leadership', description: 'Executive leadership and engineering directors.' },
          { label: 'Careers', href: '/careers', description: 'Engineering, infrastructure, and quantitative systems roles.' },
          { label: 'Contact', href: '/contact', description: 'Institutional inquiries and official correspondence.' },
        ],
      },
    ],
    highlight: {
      eyebrow: 'Corporate Parent',
      title: 'Jakuraa Commercial',
      description: 'Building software infrastructure for an agent-driven economy.',
      href: '/company',
    },
  },
  {
    label: 'Systems',
    groups: [
      {
        title: 'Architecture & Foundations',
        items: [
          { label: 'Systems Architecture', href: '/systems', description: 'Distributed node coordination and deterministic execution engines.' },
          { label: 'Technology Foundations', href: '/technology', description: 'Non-custodial design, signed mandates, and hard safety gates.' },
        ],
      },
      {
        title: 'Production Infrastructure',
        items: [
          { label: 'Polygon RPC Gateway', href: 'https://satelink.network/products/rpc', description: 'Metered JSON-RPC at flat $0.00003 per call.', external: true },
          { label: 'x402 Protocol', href: 'https://satelink.network/products/x402', description: 'Keyless HTTP 402 payment rails in USDC on Base.', external: true },
          { label: 'RevenueVault V2', href: '/news/revenue-vault-v2', description: 'On-chain cryptographic revenue settlement on Polygon.' },
        ],
      },
    ],
    highlight: {
      eyebrow: 'Deterministic Core',
      title: 'Systems Compass',
      description: 'Explore the architectural matrix powering autonomous machine workflows.',
      href: '/systems',
    },
  },
  {
    label: 'Products',
    groups: [
      {
        title: 'Flagship Platform',
        items: [
          { label: 'Satelink Platform', href: 'https://satelink.network', description: 'AI-agent assistance and machine-commerce infrastructure.', external: true, badge: 'Flagship' },
          { label: 'Machine Commerce', href: 'https://satelink.network/products/machine-commerce', description: 'Programmatic API discovery, metering, and settlement.', external: true },
          { label: 'Polygon RPC Gateway', href: 'https://satelink.network/products/rpc', description: 'High-throughput metered blockchain infrastructure.', external: true },
        ],
      },
      {
        title: 'Applications & Beta',
        items: [
          { label: 'Satelink Trading AI', href: 'https://satelink.network/trading-agent', description: 'Paper trading in controlled beta. Non-custodial risk engine.', external: true, badge: 'Beta' },
          { label: 'Platform Catalog', href: '/products', description: 'Complete inventory of deployed commercial software systems.' },
        ],
      },
    ],
    highlight: {
      eyebrow: 'Flagship Platform',
      title: 'Satelink Network',
      description: 'Infrastructure for AI agents that discover, access, and pay for services.',
      href: 'https://satelink.network',
      external: true,
    },
  },
  {
    label: 'Research',
    groups: [
      {
        title: 'Publications & Notes',
        items: [
          { label: 'Systems Research', href: '/research', description: 'Engineering papers on deterministic execution and payment rails.' },
          { label: 'Agent Commerce Models', href: '/research', description: 'Mechanisms for machine-to-machine micro-transactions.' },
          { label: 'Safety & Verification', href: '/research', description: 'Auditability and hard gate protocols for autonomous systems.' },
        ],
      },
    ],
    highlight: {
      eyebrow: 'Technical Papers',
      title: 'Protocol Research',
      description: 'Rigorous engineering research into machine coordination protocols.',
      href: '/research',
    },
  },
  {
    label: 'Resources',
    groups: [
      {
        title: 'Dispatches & Press',
        items: [
          { label: 'Newsroom & Dispatches', href: '/news', description: 'Official corporate announcements and protocol releases.' },
          { label: 'Media Kit', href: '/media-kit', description: 'Approved logos, marks, and corporate brand guidelines.' },
        ],
      },
      {
        title: 'Developers & Transparency',
        items: [
          { label: 'Developer Documentation', href: 'https://docs.satelink.network', description: 'Integration guides, API specs, and SDK reference.', external: true },
          { label: 'Public Sitemap', href: '/sitemap.xml', description: 'Complete index of verified public corporate pages.' },
          { label: 'Legal Disclosures', href: '/legal', description: 'Privacy, terms, statutory details, and grievance officer.' },
        ],
      },
    ],
  },
];

export const primaryNav: readonly NavItem[] = [
  { label: 'Products', href: '/products' },
  { label: 'Systems', href: '/systems' },
  { label: 'History', href: '/history' },
  { label: 'Research', href: '/research' },
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
