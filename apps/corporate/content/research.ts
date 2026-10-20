/**
 * Research & technology items for jakuraa.com.
 * Only real, verifiable artifacts with real dates (mandate §9, 2026-10-20). x402 is Coinbase's
 * open protocol (2025, now governed by the x402 Foundation); Jakuraa did not author it.
 */

export type ResearchItem = {
  slug: string;
  category: string;
  title: string;
  date: string | null;
  status: 'published' | 'in-progress' | 'planned';
  summary: string;
  /** Where the artifact can be inspected. */
  url?: string;
  placeholder?: boolean;
};

export const researchItems: readonly ResearchItem[] = [
  {
    slug: 'x402-kit',
    category: 'Open source',
    title: 'x402-kit: per-call USDC paywall middleware for Express',
    date: '2026-07-15',
    status: 'published',
    summary:
      'Public repository (github.com/Jakuraa/x402-kit). Express middleware that charges USDC per API call using the x402 protocol, verified and settled through the Coinbase CDP facilitator.',
    url: 'https://github.com/Jakuraa/x402-kit',
    placeholder: false,
  },
  {
    slug: 'revenue-vault-v2',
    category: 'Smart contracts',
    title: 'RevenueVaultV2 on Polygon PoS',
    date: '2026-07-05',
    status: 'published',
    summary:
      'Permissionless USDT deposit vault at 0x577D3716d6Ad5b676d230f5409deF9838FABaCEF that backs Satelink prepaid credits. Source in the Satelink_Network repository (contracts/).',
    url: 'https://polygonscan.com/address/0x577D3716d6Ad5b676d230f5409deF9838FABaCEF',
    placeholder: false,
  },
] as const;

/**
 * Returns all non-placeholder research items.
 */
export const getPublishedResearch = (): ResearchItem[] =>
  researchItems.filter(item => item.status === 'published' && !item.placeholder);
