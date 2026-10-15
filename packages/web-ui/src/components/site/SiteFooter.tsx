import React from 'react';
import { FooterWrap, FooterConfig } from './FooterWrap';

export const satelinkFooterConfig: FooterConfig = {
  brandName: 'Satelink',
  brandTagline: 'Machine commerce infrastructure',
  brandDescription:
    'Derived market intelligence and metered data services that software agents and companies can buy, call, and settle automatically.',
  brandHref: '/',
  columns: [
    {
      heading: 'Machine Commerce',
      links: [
        { href: '/intelligence', label: 'Trading Intelligence' },
        { href: '/corporate', label: 'Corporate Services' },
        { href: '/pricing', label: 'Pricing' },
      ],
    },
    {
      heading: 'Infrastructure',
      links: [
        { href: '/machine', label: 'For Agents (x402)' },
        { href: '/rpc', label: 'RPC Gateway' },
        {
          href: 'https://polygonscan.com/address/0x577D3716d6Ad5b676d230f5409deF9838FABaCEF',
          label: 'Vault on Polygonscan',
          external: true,
        },
      ],
    },
    {
      heading: 'Developers',
      links: [
        { href: 'https://docs.satelink.network', label: 'Documentation', external: true },
        { href: '/status', label: 'Status' },
        { href: 'https://github.com/Jakuraa/x402-kit', label: 'x402-kit (GitHub)', external: true },
      ],
    },
    {
      heading: 'Company',
      links: [
        { href: 'https://jakuraa.com', label: 'Jakuraa Commercial', external: true },
        { href: '/terms', label: 'Terms of Service' },
        { href: '/privacy', label: 'Privacy Policy' },
        { href: '/refund', label: 'Refund & Cancellation' },
        { href: '/contact', label: 'Contact' },
      ],
    },
  ],
  legalLinks: [
    { href: '/terms', label: 'Terms' },
    { href: '/privacy', label: 'Privacy' },
    { href: '/refund', label: 'Refund & Cancellation' },
    { href: '/contact', label: 'Contact' },
  ],
  socialLinks: [
    { href: 'https://github.com/Jakuraa/x402-kit', label: 'GitHub', icon: 'github' },
    { href: 'mailto:satelinknetwork@gmail.com', label: 'Email', icon: 'mail' },
  ],
  copyrightText: 'Jakuraa Commercial Pvt Ltd. All rights reserved.',
  addressLines: [
    '38/39 Malaviya Street, Ram Nagar, Coimbatore 641009, Tamil Nadu, India',
    'satelinknetwork@gmail.com',
  ],
  metaBadges: [
    { label: 'PROTOCOL', value: 'X402 / EVM' },
    { label: 'SETTLEMENT', value: 'USDT / POLYGON' },
    { label: 'NETWORK', value: 'LIVE' },
  ],
};

export function SiteFooter() {
  return <FooterWrap config={satelinkFooterConfig} />;
}
