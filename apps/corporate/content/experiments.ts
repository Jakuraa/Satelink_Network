/**
 * Structured data for 'The Lab' section.
 * Includes real experiments based on actual Satelink capabilities.
 */

export type Experiment = {
  id: string;
  title: string;
  thesis: string;
  technology: string[];
  status: 'proven' | 'testing' | 'concept';
  placeholder?: boolean;
};

export const experiments: readonly Experiment[] = [
  {
    id: 'machine-payment-protocols',
    title: 'Machine Payment Protocols',
    thesis: 'Standardized HTTP codes enable seamless agent monetization.',
    technology: ['x402', 'Node.js', 'REST APIs'],
    status: 'proven',
    placeholder: false,
  },
  {
    id: 'autonomous-settlement',
    title: 'Autonomous Settlement',
    thesis: 'Vault contracts on Polygon reduce settlement costs and time.',
    technology: ['Polygon', 'Solidity', 'Smart Contracts'],
    status: 'proven',
    placeholder: false,
  },
  {
    id: 'per-request-metering',
    title: 'Per-Request Metering',
    thesis: 'Granular usage tracking enables micro-economies for AI agents.',
    technology: ['Redis', 'Go', 'Distributed Counters'],
    status: 'testing',
    placeholder: false,
  },
  {
    id: 'agent-commerce',
    title: 'Agent Commerce',
    thesis: 'Machines buying from machines will outpace human commerce.',
    technology: ['LLMs', 'Agent Frameworks', 'Crypto Wallets'],
    status: 'testing',
    placeholder: false,
  },
  {
    id: 'dynamic-pricing-oracles',
    title: 'Dynamic Pricing Oracles',
    thesis: 'Real-time API pricing based on network congestion and demand.',
    technology: ['Chainlink', 'Oracles', 'Smart Contracts'],
    status: 'concept',
    placeholder: true,
  },
  {
    id: 'zero-knowledge-auth',
    title: 'Zero-Knowledge Agent Auth',
    thesis: 'Agents can prove authorization without revealing identity.',
    technology: ['ZK-SNARKs', 'Circom', 'Cryptography'],
    status: 'concept',
    placeholder: true,
  },
] as const;

/**
 * Returns all proven experiments.
 */
export const getProvenExperiments = (): Experiment[] =>
  experiments.filter(exp => exp.status === 'proven');
