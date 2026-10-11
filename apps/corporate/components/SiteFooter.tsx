import React from 'react';
import { FooterWrap, FooterConfig } from './layout/FooterWrap';
import { company, registeredOfficeLine } from '@/content/company';

export const jakuraaFooterConfig: FooterConfig = {
  brandName: 'JAKURAA',
  brandTagline: 'A technology, engineering, and commercial enterprise.',
  brandDescription:
    'Architecting autonomous software, computing infrastructure, and machine-commerce platforms across physical and digital domains.',
  foundedYear: '2019',
  brandHref: '/',
  columns: [
    {
      heading: 'JAKURAA',
      links: [
        { href: '/company', label: 'Company Overview' },
        { href: '/company/leadership', label: 'Founder & Leadership' },
        { href: '/history', label: 'Operating History (2019 - 2026)' },
        { href: '/company', label: 'Operating Principles' },
        { href: '/businesses', label: 'Business Verticals' },
        { href: '/legal/company-information', label: 'Statutory Disclosures' },
        { href: '/contact', label: 'Institutional Enquiries' },
      ],
    },
    {
      heading: 'SATELINK PLATFORM',
      links: [
        { href: '/products', label: 'Products' },
        { href: 'https://satelink.network/trading-agent', label: 'Satelink Trading AI', external: true },
        { href: 'https://satelink.network', label: 'Platform Overview', external: true },
        { href: 'https://satelink.network/products/machine-commerce', label: 'Machine Commerce', external: true },
        { href: '/technology', label: 'AI Trading Architecture' },
        { href: 'https://satelink.network/products/trading-intelligence', label: 'Trading Intelligence', external: true },
        { href: 'https://satelink.network/platform/payments', label: 'Machine Payments', external: true },
        { href: 'https://satelink.network/platform/x402', label: 'x402 Protocol', external: true },
        { href: '/research#revenue-vault-v2', label: 'Prepaid Credit Vault' },
        { href: 'https://satelink.network/products/metering', label: 'API Metering Gateway', external: true },
        { href: '/systems', label: 'Systems Architecture' },
      ],
    },
    {
      heading: 'SOLUTIONS',
      links: [
        { href: 'https://satelink.network/solutions/ai-agents', label: 'AI Agent Infrastructure', external: true },
        { href: 'https://satelink.network/solutions/machine-commerce', label: 'Machine Commerce Rails', external: true },
        { href: 'https://satelink.network/solutions/trading', label: 'Algorithmic Trading Systems', external: true },
        { href: 'https://satelink.network/solutions/api-monetization', label: 'API Monetization', external: true },
        { href: 'https://satelink.network/solutions/developers', label: 'Developer Infrastructure', external: true },
        { href: 'https://satelink.network/solutions/enterprise', label: 'Enterprise Automation', external: true },
        { href: '/businesses/industrial-manufacturing', label: 'Industrial Machinery' },
        { href: '/businesses/trading-distribution', label: 'Trade & Distribution' },
      ],
    },
    {
      heading: 'RESEARCH & NEWS',
      links: [
        { href: '/research', label: 'Research Overview' },
        { href: '/research', label: 'Working Papers' },
        { href: '/research#x402-machine-payments', label: 'x402 Protocol Spec' },
        { href: '/research#revenue-vault-v2', label: 'RevenueVaultV2 Settlement' },
        { href: '/research#autonomous-finance', label: 'Agent Microstructure' },
        { href: '/research#distributed-telemetry', label: 'Network Telemetry' },
        { href: '/news', label: 'Newsroom & Dispatches' },
        { href: '/#video', label: 'Media & Video Analysis' },
      ],
    },
    {
      heading: 'RESOURCES',
      links: [
        { href: 'https://satelink.network/docs', label: 'Technical Documentation', external: true },
        { href: 'https://satelink.network/developers', label: 'Developer Hub', external: true },
        { href: 'https://satelink.network/pricing', label: 'Network Pricing & Rates', external: true },
        { href: 'https://status.satelink.network', label: 'System Status', external: true },
        { href: '/history#chapter-2019-compute-mining', label: 'Compute Archives (2019)' },
        { href: '/media-kit', label: 'Media Kit & Press Assets' },
        { href: '/systems', label: 'Systems Directory' },
        { href: '/sitemap.xml', label: 'Public Sitemap' },
      ],
    },
    {
      heading: 'COMPANY & DIRECTORY',
      links: [
        { href: '/company', label: 'About Jakuraa' },
        { href: '/company/leadership', label: 'Leadership & Governance' },
        { href: '/careers', label: 'Careers (Jakuraa & Satelink)' },
        { href: '/contact', label: 'Contact & Inquiries' },
        { href: '/contact', label: 'Press & Media Relations' },
        { href: '/contact', label: 'Security & Vulnerability' },
        { href: '/legal/privacy', label: 'Privacy Policy' },
        { href: '/legal/terms', label: 'Terms of Use' },
        { href: '/legal/grievance', label: 'Grievance Officer' },
      ],
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
    { href: 'https://github.com/Satelink-Protocol', label: 'GitHub', icon: 'github' },
    { href: 'mailto:contact@jakuraa.com', label: 'Email', icon: 'mail' },
  ],
  copyrightText: `${company?.legalName || 'Jakuraa Commercial Private Limited'}. All rights reserved.`,
  entityNotice: `CIN: ${company?.cin} | GSTIN: ${company?.gstin} | DGFT IEC: ${company?.iec}`,
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
