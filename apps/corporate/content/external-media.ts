export interface ExternalMediaItem {
  id: string;
  title: string;
  description: string;
  category: 'autonomous-systems' | 'machine-commerce' | 'compute-infrastructure' | 'industrial-robotics';
  youtubeId?: string;
  sourceLabel: string;
  posterUrl?: string;
}

export const externalMediaRegistry: ExternalMediaItem[] = [
  {
    id: 'autonomous-settlement-demo',
    title: 'Autonomous Agent Settlement Architecture',
    description: 'Protocol demonstration of agentic transactions settling cryptographically against deterministic APIs.',
    category: 'machine-commerce',
    sourceLabel: 'Satelink Technical Demonstration',
    posterUrl: '/media/mining/crypto-mining-gpu-cluster.jpg',
  },
  {
    id: 'industrial-compute-telemetry',
    title: 'High-Density Compute Thermal Management',
    description: 'Hardware load and power distribution benchmarking under continuous compute environments.',
    category: 'compute-infrastructure',
    sourceLabel: 'Jakuraa Hardware Archives',
    posterUrl: '/media/mining/mining-hardware-poster.jpg',
  },
  {
    id: 'physical-logistics-systems',
    title: 'Physical Supply Chain Operations',
    description: 'Operational tracking, warehousing inventory cycles, and physical dispatch staging.',
    category: 'industrial-robotics',
    sourceLabel: 'Falcor Operations Archive',
    posterUrl: '/media/falcor/falcor-power-tools-10.jpg',
  },
];
