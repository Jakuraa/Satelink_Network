/**
 * Structured data for the Research & Technology section.
 * Real items are based on existing news regarding x402 and RevenueVaultV2.
 * Placeholders are generated for layout purposes and clearly marked.
 */

export type ResearchItem = {
  slug: string;
  category: string;
  title: string;
  date: string | null;
  status: 'published' | 'in-progress' | 'planned';
  summary: string;
  placeholder?: boolean;
};

export const researchItems: readonly ResearchItem[] = [
  {
    slug: 'x402-machine-payments',
    category: 'Protocol',
    title: 'x402: A Standard for Machine-to-Machine Payments',
    date: '2023-11-15',
    status: 'published',
    summary: 'Proposing a standardized HTTP status code for machine payments.',
    placeholder: false,
  },
  {
    slug: 'revenue-vault-v2',
    category: 'Smart Contracts',
    title: 'RevenueVaultV2: Secure On-Chain Settlement',
    date: '2023-12-01',
    status: 'published',
    summary: 'Architecture details of the upgraded revenue vault contract.',
    placeholder: false,
  },
  {
    slug: 'machine-economics',
    category: 'Economics',
    title: 'The Future of Machine Economics and Agent Commerce',
    date: null,
    status: 'planned',
    summary: 'Exploring economic models where agents transact autonomously.',
    placeholder: true,
  },
  {
    slug: 'autonomous-settlement',
    category: 'Infrastructure',
    title: 'Scaling Autonomous Settlement on Layer 2 Networks',
    date: null,
    status: 'in-progress',
    summary: 'Analyzing throughput of autonomous settlement mechanisms.',
    placeholder: true,
  },
  {
    slug: 'market-intelligence-agents',
    category: 'Data',
    title: 'Market Intelligence via Decentralized Agent Networks',
    date: null,
    status: 'planned',
    summary: 'Using swarms of agents to gather and verify market data.',
    placeholder: true,
  },
  {
    slug: 'distributed-infrastructure',
    category: 'Systems',
    title: 'Resilient Distributed Infrastructure for AI Agents',
    date: null,
    status: 'planned',
    summary: 'Building fault-tolerant systems for continuous agent operation.',
    placeholder: true,
  },
] as const;

/**
 * Returns all non-placeholder research items.
 */
export const getPublishedResearch = (): ResearchItem[] =>
  researchItems.filter(item => item.status === 'published' && !item.placeholder);
