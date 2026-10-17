import React from 'react';
import { FooterWrap, FooterConfig } from './layout/FooterWrap';
import { company, registeredOfficeLine } from '@/content/company';

const col1Sections = [
  {
    heading: 'Enterprise',
    links: [
      { href: '/company', label: 'About Jakuraa' },
      { href: '/history', label: 'Operating History' },
      { href: '/company/leadership', label: 'Leadership & Directors' },
      { href: '/legal/company-information', label: 'Corporate Governance' },
      { href: '/careers', label: 'Careers & Talent' },
    ],
  },
  {
    heading: 'Communication',
    links: [
      { href: '/contact', label: 'Contact Offices' },
      { href: '/media-kit', label: 'Press & Media Kit' },
      { href: '/news', label: 'Dispatches & Newsroom' },
    ],
  },
];

const col2Sections = [
  {
    heading: 'Satelink Platform',
    links: [
      { href: 'https://satelink.network', label: 'Satelink Platform', external: true },
      { href: 'https://satelink.network/products/machine-commerce', label: 'Machine Commerce', external: true },
      { href: 'https://satelink.network/products/rpc', label: 'Polygon RPC Gateway', external: true },
      { href: 'https://satelink.network/platform/x402', label: 'x402 Machine Protocol', external: true },
      { href: 'https://satelink.network/trading-agent', label: 'Satelink Trading AI', badge: 'Beta', external: true },
    ],
  },
  {
    heading: 'Commercial Portfolio',
    links: [
      { href: '/businesses', label: 'Operating Businesses' },
      { href: '/products', label: 'Platform Catalog' },
      { href: '/contact', label: 'Enterprise Procurement' },
    ],
  },
];

const col3Sections = [
  {
    heading: 'Deep Technology',
    links: [
      { href: '/technology', label: 'Technology Overview' },
      { href: '/systems', label: 'Systems Architecture' },
      { href: '/technology', label: 'Computing Rails' },
      { href: '/systems', label: 'Protocol Engineering' },
    ],
  },
  {
    heading: 'Systems Research',
    links: [
      { href: '/research', label: 'Research Papers' },
      { href: '/research', label: 'Agent Commerce Models' },
      { href: '/technology', label: 'Deterministic Gates' },
      { href: 'https://status.satelink.network', label: 'Network Telemetry', external: true },
    ],
  },
];

const col4Sections = [
  {
    heading: 'Developer Ecosystem',
    links: [
      { href: 'https://docs.satelink.network', label: 'Developer Documentation', external: true },
      { href: 'https://satelink.network/developers', label: 'Developer Guides', external: true },
      { href: 'https://satelink.network/developers/api', label: 'API Reference', external: true },
      { href: 'https://github.com/Jakuraa', label: 'GitHub Repositories', external: true },
    ],
  },
  {
    heading: 'Public Information',
    links: [
      { href: '/faq', label: 'Corporate FAQ' },
      { href: '/llms.txt', label: 'Machine LLMs Manifest' },
      { href: '/sitemap.xml', label: 'Public Sitemap' },
    ],
  },
];

const col5Sections = [
  {
    heading: 'Statutory Registry',
    links: [
      { href: '/legal/company-information', label: 'Corporate Information' },
      { href: '/legal/company-information', label: 'Statutory Disclosures' },
      { href: '/legal/grievance', label: 'Grievance Officer' },
      { href: '/contact', label: 'Registered Office' },
    ],
  },
  {
    heading: 'Legal Policies',
    links: [
      { href: '/legal/privacy', label: 'Privacy Policy' },
      { href: '/legal/terms', label: 'Terms of Use' },
      { href: '/contact', label: 'Security & Vulnerability' },
      { href: '/legal', label: 'Statutory Overview' },
    ],
  },
];

export const jakuraaFooterConfig: FooterConfig = {
  brandName: 'JAKURAA',
  brandTagline: 'A technology, engineering, and commercial enterprise.',
  brandDescription:
    'Architecting autonomous software, computing infrastructure, and machine-commerce platforms across physical and digital domains.',
  foundedYear: '2019',
  brandHref: '/',
  columns: [
    {
      heading: 'Company & Governance',
      sections: col1Sections,
      links: col1Sections.flatMap((s) => s.links),
    },
    {
      heading: 'Platforms & Capabilities',
      sections: col2Sections,
      links: col2Sections.flatMap((s) => s.links),
    },
    {
      heading: 'Engineering & Research',
      sections: col3Sections,
      links: col3Sections.flatMap((s) => s.links),
    },
    {
      heading: 'Resources & Developers',
      sections: col4Sections,
      links: col4Sections.flatMap((s) => s.links),
    },
    {
      heading: 'Trust & Statutory',
      sections: col5Sections,
      links: col5Sections.flatMap((s) => s.links),
    },
  ],
  legalLinks: [
    { href: '/legal/company-information', label: 'Company information' },
    { href: '/legal/privacy', label: 'Privacy policy' },
    { href: '/legal/terms', label: 'Terms of use' },
    { href: '/legal/grievance', label: 'Grievance officer' },
    { href: '/media-kit', label: 'Media kit' },
    { href: '/contact', label: 'Contact' },
  ],
  socialLinks: [
    { href: 'https://github.com/Jakuraa', label: 'GitHub', icon: 'github' },
    { href: 'mailto:contact@jakuraa.com', label: 'Email', icon: 'mail' },
  ],
  copyrightText: `${company?.legalName || 'Jakuraa Commercial Private Limited'}. All rights reserved.`,
  entityNotice: `CIN: ${company?.cin || 'U52190TZ2019PTC033093'} | GSTIN: ${company?.gstin || '33AAFCJ6394G1Z2'} | DGFT IEC: ${company?.iec || 'AALCJ6394G'}`,
  addressLines: [registeredOfficeLine()],
  metaBadges: [
    { label: 'INSTITUTION', value: 'JAKURAA COMMERCIAL' },
    { label: 'ESTABLISHED', value: '2019' },
    { label: 'HEADQUARTERS', value: 'COIMBATORE, INDIA' },
    { label: 'FLAGSHIP PLATFORM', value: 'SATELINK NETWORK' },
    { label: 'INFRASTRUCTURE RAILS', value: 'BASE & POLYGON' },
  ],
};

export function SiteFooter() {
  return <FooterWrap config={jakuraaFooterConfig} theme="dark" />;
}
