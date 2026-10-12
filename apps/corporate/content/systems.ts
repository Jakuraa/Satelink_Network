/**
 * Structured data for the 'What We Build' / technology areas section.
 * Data is derived from existing businesses.ts and company.ts capabilities.
 */

export type SystemArea = {
  id: string;
  title: string;
  description: string;
  capabilities: string[];
  status: 'active' | 'research' | 'planned';
};

export const systems: readonly SystemArea[] = [
  {
    id: 'autonomous-systems',
    title: 'Autonomous Systems',
    description: 'Satelink machine payment infrastructure for agent networks.',
    capabilities: ['Machine payments', 'Agent networks', 'Payment channels'],
    status: 'active',
  },
  {
    id: 'machine-commerce',
    title: 'Machine Commerce',
    description: 'Implementation of the x402 protocol for pay-per-call APIs.',
    capabilities: ['x402 protocol', 'Pay-per-call', 'API monetization'],
    status: 'active',
  },
  {
    id: 'market-intelligence',
    title: 'Market Intelligence',
    description: 'Blockchain data analytics and robust RPC service provision.',
    capabilities: ['Blockchain data', 'RPC services', 'Data analytics'],
    status: 'active',
  },
  {
    id: 'financial-systems',
    title: 'Financial Systems',
    description: 'On-chain settlement mechanisms and secure vault contracts.',
    capabilities: ['On-chain settlement', 'Vault contracts', 'Treasury'],
    status: 'active',
  },
  {
    id: 'infrastructure',
    title: 'Infrastructure',
    description: 'Distributed systems engineering and granular usage metering.',
    capabilities: ['Distributed systems', 'Usage metering', 'Scalability'],
    status: 'active',
  },
  {
    id: 'industrial-technology',
    title: 'Industrial Technology',
    description: 'Udyam manufacturing registration and compliance integration.',
    capabilities: ['Manufacturing', 'Udyam registration', 'Compliance'],
    status: 'active',
  },
] as const;

/**
 * Returns all active systems.
 */
export const getActiveSystems = (): SystemArea[] =>
  systems.filter(s => s.status === 'active');
