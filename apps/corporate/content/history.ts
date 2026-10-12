export interface HistoricalMediaRef {
  id: string;
  localPath: string;
  title: string;
  caption: string;
  type: 'image' | 'video';
  alt: string;
  year?: string;
}

export interface HistoricalChapter {
  id: string;
  year: string;
  period: string;
  title: string;
  eyebrow: string;
  status: 'active' | 'completed' | 'discontinued' | 'evolved';
  statusLabel: string;
  summary: string;
  narrative: string[];
  keyFacts: { label: string; value: string }[];
  media: HistoricalMediaRef[];
  lessonsLearned: string[];
}

export const companyFoundingStory = {
  founder: 'Pradeep Jakuraa',
  title: 'Founder, Systems Architect & Managing Director',
  foundedYear: '2019',
  location: 'Coimbatore, Tamil Nadu, India',
  thesis:
    'Jakuraa was founded on an uncompromising principle: real systems engineering must be battle-tested against physical and economic realities. Rather than remaining an abstract software agency or a theoretical laboratory, the company actively built, acquired, and operated high-friction businesses across power tools, compute hardware, food service, and retail supermarkets before synthesizing these learnings into autonomous machine commerce.',
  portraitPath: '/media/founder/pradeep-jakuraa-portrait-primary.jpg',
  executivePortraitPath: '/media/founder/pradeep-jakuraa-portrait-executive.jpg',
  systemsBuilderPortraitPath: '/media/founder/pradeep-jakuraa-systems-builder.jpg',
};

export const historicalChapters: HistoricalChapter[] = [
  {
    id: 'chapter-2019-origins',
    year: '2019',
    period: 'Early 2019 - Mid 2019',
    eyebrow: 'ORIGIN PERIOD',
    title: 'Software Engineering and Specialized Technical Services',
    status: 'evolved',
    statusLabel: 'Evolved into corporate platform core',
    summary:
      'Founded by Pradeep Jakuraa in Coimbatore, beginning with bespoke software development, industrial 3D printing prototyping, and aerial drone survey services for commercial infrastructure.',
    narrative: [
      'Jakuraa commenced operations in early 2019 with a focus on delivering technical services to industrial clients across Tamil Nadu. The earliest operational units performed custom software engineering, computer-aided rapid prototyping using 3D additive manufacturing, and high-resolution aerial drone surveys for agricultural and infrastructure land parcels.',
      'These early contracts provided immediate operational cash flow, established rigorous client-delivery disciplines, and exposed the founding team to the real-world operational challenges faced by regional businesses.',
    ],
    keyFacts: [
      { label: 'Founding Year', value: '2019' },
      { label: 'Location', value: 'Coimbatore, Tamil Nadu' },
      { label: 'Initial Services', value: 'Software Engineering, 3D Prototyping, Drone Surveys' },
      { label: 'Operational Model', value: 'Client Contracting and Technical Delivery' },
    ],
    media: [
      {
        id: 'history-software-2019',
        localPath: '/media/history/software-engineering-services-2019.jpg',
        title: 'Early Software and Engineering Operations',
        caption: 'Bespoke software development, 3D printing, and aerial survey services in 2019.',
        type: 'image',
        alt: 'Software engineering and technical services operations in 2019',
        year: '2019',
      },
    ],
    lessonsLearned: [
      'Bespoke technical services deliver working capital but scale linearly with human hours.',
      'Custom client work lacks defensible intellectual property unless captured into standard software protocols.',
      'Direct operational cash flow from day one built a culture of financial self-reliance without venture dependency.',
    ],
  },
  {
    id: 'chapter-2019-compute-mining',
    year: '2019 - 2020',
    period: 'Mid 2019 - 2020',
    eyebrow: 'COMPUTE ARCHITECTURE',
    title: 'Hardware Benchmarking and Distributed GPU Mining Clusters',
    status: 'completed',
    statusLabel: 'Completed experimental research phase',
    summary:
      'Hands-on compute experimentation building multi-card GPU mining arrays, power curve optimization, custom BIOS flashing, thermal management, and algorithmic proof-of-work validation.',
    narrative: [
      'In mid-2019, Pradeep Jakuraa initiated extensive hardware-level experiments into physical computational infrastructure. The firm designed, assembled, and operated custom open-frame GPU compute rigs dedicated to continuous cryptographic hashing and algorithmic verification.',
      'The initiative demanded low-level mastery of power supply curves, thermal dissipation, PCI-Express bus saturation, riser integrity, and Linux kernel headless deployments. It provided foundational insight into the unit economics of compute: converting electrical kilowatt-hours and silicon cycles into verifiable cryptographic assets.',
    ],
    keyFacts: [
      { label: 'Architecture', value: 'Multi-GPU Open-Frame Compute Arrays' },
      { label: 'Core Workload', value: 'Cryptographic Hashing and Proof-of-Work' },
      { label: 'Operational Uptime', value: '24/7 Continuous Telemetry and Load Testing' },
      { label: 'Focus', value: 'Silicon Efficiency, Thermal Dynamics, Hardware Margins' },
    ],
    media: [
      {
        id: 'mining-rig-founder-early',
        localPath: '/media/mining/pradeep-jakuraa-mining-rig-early.jpg',
        title: 'Founder with Early Compute Rig',
        caption: 'Pradeep Jakuraa with open-frame GPU compute rig during 2019 calibration.',
        type: 'image',
        alt: 'Pradeep Jakuraa calibrating GPU mining hardware',
        year: '2019',
      },
      {
        id: 'mining-gpu-cluster',
        localPath: '/media/mining/crypto-mining-gpu-cluster.jpg',
        title: 'GPU Compute Cluster Array',
        caption: 'Multi-card hardware assembly under active high-airflow cooling.',
        type: 'image',
        alt: 'High-density multi-GPU mining array with cooling',
        year: '2019',
      },
      {
        id: 'mining-hardware-setup',
        localPath: '/media/mining/crypto-mining-hardware-setup.jpg',
        title: 'Hardware Telemetry Bench',
        caption: 'Dedicated electrical metering, power supply rails, and thermal monitoring.',
        type: 'image',
        alt: 'Hardware telemetry bench with power meters',
        year: '2020',
      },
      {
        id: 'video-mining-overview',
        localPath: '/media/mining/mining-cluster-poster.jpg',
        title: 'Mining Cluster Operation Poster',
        caption: 'Archival video poster of operational multi-GPU cluster hashing.',
        type: 'video',
        alt: 'Archival poster of GPU mining cluster',
        year: '2019',
      },
      {
        id: 'rd-gpu-rtx-hardware-01',
        localPath: '/media/history/jakuraa-history-gpu-rtx-hardware-01.webp',
        title: 'High-Performance GPU Staging',
        caption: 'Unboxed high-performance GeForce RTX GPU units staged for custom multi-node compute cluster fabrication.',
        type: 'image',
        alt: 'GeForce RTX GPUs staged for assembly on engineering workbench',
        year: '2021',
      },
      {
        id: 'rd-hardware-engineering-test-03',
        localPath: '/media/history/jakuraa-history-hardware-engineering-test-03.webp',
        title: 'Motherboard Multimeter Diagnostics',
        caption: 'Motherboard voltage calibration, circuit continuity diagnostics, and multimeter testing under thermal load.',
        type: 'image',
        alt: 'Motherboard and electrical circuit multimeter diagnostic testing',
        year: '2021',
      },
      {
        id: 'rd-gpu-enclosure-running-04',
        localPath: '/media/history/jakuraa-history-gpu-enclosure-running-04.webp',
        title: 'Operational High-Density Compute Enclosure',
        caption: 'Fully assembled high-density multi-GPU compute rig operating under load with active status indicators.',
        type: 'image',
        alt: 'Operational multi-GPU enclosure running under sustained compute load',
        year: '2021',
      },
      {
        id: 'early-node-telemetry-bench-02',
        localPath: '/media/history/jakuraa-history-node-telemetry-bench-02.webp',
        title: 'Compute Node Telemetry Station',
        caption: 'Compute node telemetry desk and diagnostics monitors during high-throughput network benchmarking.',
        type: 'image',
        alt: 'Node telemetry monitoring station with dual displays and diagnostic graphs',
        year: '2021',
      },
      {
        id: 'early-rack-compute-kondaas-03',
        localPath: '/media/history/jakuraa-history-rack-compute-kondaas-03.webp',
        title: 'Rack Enclosure & Power Stabilization',
        caption: 'Custom 4U rack-mount high-airflow fan enclosure paired with an industrial Kondaas power stabilization unit.',
        type: 'image',
        alt: 'Server rack compute system with heavy-duty cooling fans and Kondaas power unit',
        year: '2021',
      },
    ],
    lessonsLearned: [
      'Silicon operates under strict thermodynamic laws: computation is fundamentally energy transformation.',
      'Hardware margins compress rapidly when network difficulty outpaces operational efficiency.',
      'Direct hands-on experience with cryptographic rails established the technical foundation for autonomous agent settlement in Satelink.',
    ],
  },
  {
    id: 'chapter-2019-pharma-capital',
    year: '2019',
    period: 'October 2019',
    eyebrow: 'CAPITAL PARTICIPATION',
    title: 'Jeeva Manna Pharma Capital Participation',
    status: 'completed',
    statusLabel: 'Passive capital participation',
    summary:
      'Early working-capital participation in regional pharmaceutical wholesale and distribution operations.',
    narrative: [
      'In October 2019, Jakuraa made an early capital commitment into Jeeva Manna Pharma, a regional wholesale pharmaceutical distributor. The participation was structured as passive working capital to support batch inventory procurement and distributor credit cycles.',
      'This investment gave the founder a window into the heavily regulated pharmaceutical supply chain, credit float dynamics between manufacturers and hospital pharmacies, and the vulnerability of traditional physical wholesale margins to distributor payment delays.',
    ],
    keyFacts: [
      { label: 'Date', value: 'October 2019' },
      { label: 'Sector', value: 'Pharmaceutical Wholesale Distribution' },
      { label: 'Role', value: 'Working Capital and Equity Participation' },
      { label: 'Outcome', value: 'Operational Capital Recovered and Completed' },
    ],
    media: [],
    lessonsLearned: [
      'Working-capital cycles in pharmaceutical distribution are stretched by long credit terms and slow government/institutional reimbursements.',
      'Physical distribution businesses with paper-based settlement bear substantial credit default risk.',
      'Reinforced the need for automated, programmatically guaranteed clearing mechanisms.',
    ],
  },
  {
    id: 'chapter-2020-falcor-power-tools',
    year: '2020 - 2021',
    period: '2020 - 2021',
    eyebrow: 'INDUSTRIAL COMMERCE',
    title: 'Falcor Power Tools Industrial Trade and Distribution',
    status: 'discontinued',
    statusLabel: 'Discontinued trading division',
    summary:
      'Regional wholesale distribution, stocking, assembly, and testing of heavy-duty industrial power tools and workshop machinery.',
    narrative: [
      'During 2020 and 2021, under the operating brand Falcor Power Tools, Jakuraa established a physical commercial trading division focused on industrial machinery, power equipment, and workshop tools across western Tamil Nadu.',
      'The company procured rotary hammers, angle grinders, demolition tools, circular saws, and bench motors. The operations included physical warehouse staging, pre-delivery motor testing, packaging, wholesale dispatch to regional hardware dealers, and direct commercial demonstrations.',
      'While the business generated substantial top-line turnover, the operational burden of physical warranty liabilities, dealer credit float, and inventory obsolescence demonstrated the fundamental limits of offline hardware distribution.',
    ],
    keyFacts: [
      { label: 'Operating Brand', value: 'Falcor Power Tools' },
      { label: 'Product Lines', value: 'Industrial Power Equipment, Angle Grinders, Demolition Hammers' },
      { label: 'Facilities', value: 'Warehouse and Testing Workshop in Coimbatore' },
      { label: 'Status', value: 'Discontinued to concentrate on software infrastructure' },
    ],
    media: [
      {
        id: 'falcor-tools-01',
        localPath: '/media/falcor/falcor-power-tools-01.jpg',
        title: 'Industrial Tools Inventory',
        caption: 'Warehouse stock of heavy-duty power tools and packaged equipment.',
        type: 'image',
        alt: 'Industrial power tools inventory stock',
        year: '2020',
      },
      {
        id: 'falcor-tools-02',
        localPath: '/media/falcor/falcor-power-tools-02.jpg',
        title: 'Machinery Inspection Bench',
        caption: 'Pre-dispatch verification of electric motors and components.',
        type: 'image',
        alt: 'Machinery inspection bench',
        year: '2020',
      },
      {
        id: 'falcor-tools-03',
        localPath: '/media/falcor/falcor-power-tools-03.jpg',
        title: 'Workshop Assembly Operations',
        caption: 'Bench testing and physical assembly of industrial tools.',
        type: 'image',
        alt: 'Workshop assembly operations',
        year: '2020',
      },
      {
        id: 'falcor-tools-08',
        localPath: '/media/falcor/falcor-power-tools-08.jpg',
        title: 'Field Demonstration Testing',
        caption: 'Operational testing of high-torque equipment for commercial buyers.',
        type: 'image',
        alt: 'Field equipment testing and demonstration',
        year: '2020',
      },
      {
        id: 'falcor-warehouse-01',
        localPath: '/media/falcor/jakuraa-history-falcor-warehouse-01.webp',
        title: 'Industrial Machinery Warehouse Shelving',
        caption: 'Warehouse storage shelves with packaged rotary hammers, angle grinders, and machinery supplies.',
        type: 'image',
        alt: 'Falcor Power Tools warehouse storage shelves with boxed industrial machinery',
        year: '2021',
      },
      {
        id: 'falcor-repair-bench-02',
        localPath: '/media/falcor/jakuraa-history-falcor-repair-bench-02.webp',
        title: 'Technical Diagnostics & Armature Bench',
        caption: 'Technical diagnostics and repair workbench: armature servicing, high-airflow cooling fan calibrating, and electrical testing.',
        type: 'image',
        alt: 'Power tools technical maintenance and electrical diagnostics bench',
        year: '2021',
      },
      {
        id: 'falcor-operating-desk-03',
        localPath: '/media/falcor/jakuraa-history-falcor-operating-desk-03.webp',
        title: 'Dispatch Logistics Management Desk',
        caption: 'Late-night operations and dispatch management desk during peak industrial machinery supply cycles.',
        type: 'image',
        alt: 'Falcor Power Tools office operating desk with logistics monitors and dispatch ledgers',
        year: '2021',
      },
    ],
    lessonsLearned: [
      'Physical hardware trade involves significant capital tie-up in static warehouse inventory.',
      'Dealer credit terms frequently stretch 60 to 90 days, transferring working capital risk to the distributor.',
      'Operating real physical supply chains provided indispensable knowledge of invoice matching, freight staging, and warranty reserves.',
    ],
  },
  {
    id: 'chapter-2021-hotel-delhi-darbarr',
    year: '2021',
    period: '2021 - 2022',
    eyebrow: 'HOSPITALITY COMMERCE',
    title: 'Hotel Delhi Darbarr Restaurant Acquisition and Operations',
    status: 'discontinued',
    statusLabel: 'Divested operations',
    summary:
      'Acquisition and operational management of Hotel Delhi Darbarr, a multi-cuisine family dining restaurant in Coimbatore.',
    narrative: [
      'In 2021, Jakuraa acquired and took over operational management of Hotel Delhi Darbarr, an established multi-cuisine family dining restaurant in Coimbatore under the Falcor Commercial entity.',
      'The operations required full oversight of a commercial kitchen brigade, daily perishable food supply chains, customer service staff, health inspections, and point-of-sale cash registers. It was an intentional deep-dive into high-frequency consumer transactions and human service coordination.',
      'The venture was systematically managed and subsequently divested. The intense operational friction of perishable commodities, high labor churn, and tight unit economics permanently shaped the founder’s conviction that human-mediated operational chains must be replaced by programmatic software rails.',
    ],
    keyFacts: [
      { label: 'Entity', value: 'Hotel Delhi Darbarr (Falcor Commercial)' },
      { label: 'Format', value: 'Multi-Cuisine Family Dining Restaurant' },
      { label: 'Location', value: 'Coimbatore, Tamil Nadu' },
      { label: 'Outcome', value: 'Divested following operational review' },
    ],
    media: [
      {
        id: 'restaurant-delhi-darbarr-01',
        localPath: '/media/restaurant/hotel-delhi-darbarr-dining.jpg',
        title: 'Hotel Delhi Darbarr Dining Hall',
        caption: 'Dining floor and table service area during operational management in 2021.',
        type: 'image',
        alt: 'Hotel Delhi Darbarr restaurant dining area',
        year: '2021',
      },
    ],
    lessonsLearned: [
      'Perishable commodities have zero tolerance for demand forecasting error: unconsumed goods degrade to zero value.',
      'High labor intensity creates acute operational fragility that cannot be stabilized without severe process rigidity.',
      'Direct exposure to daily consumer retail cash collection highlighted the inefficiencies of traditional banking settlements.',
    ],
  },
  {
    id: 'chapter-2024-wholesale-syndicate',
    year: '2024 - 2025',
    period: '9 August 2024 - 23 September 2025',
    eyebrow: 'RETAIL COMMERCE EXPERIMENT',
    title: 'Wholesale Syndicate Supermarket Operations',
    status: 'discontinued',
    statusLabel: 'Format closed 23 Sep 2025; strategic review underway for automated reopening',
    summary:
      'Physical retail grocery supermarket launched on 9 August 2024 with end-to-end POS systems, FMCG inventory management, and consumer distribution. Concluded on 23 September 2025.',
    narrative: [
      'On 9 August 2024, Jakuraa launched Wholesale Syndicate, a full-format retail grocery supermarket located in Coimbatore. The store was designed to test modern consumer inventory logistics, barcoded product cataloging, distributor purchasing power, and physical checkout throughput.',
      'Over the course of 13 months, Wholesale Syndicate handled thousands of retail transactions daily across packaged consumer goods, household supplies, and staples. Pradeep Jakuraa personally oversaw the procurement cycles, vendor trade discounts, point-of-sale terminals, and floor layout optimizations.',
      'On 23 September 2025, after achieving clarity on retail inventory dynamics and consumer margins, the physical store format was formally closed. The learnings are currently under strategic review for a potential future reopening utilizing an autonomous, self-checkout, or automated fulfillment architecture.',
    ],
    keyFacts: [
      { label: 'Opening Date', value: '9 August 2024' },
      { label: 'Closure Date', value: '23 September 2025' },
      { label: 'Catalog Size', value: 'Over 3,000 active FMCG SKUs' },
      { label: 'Current Status', value: 'Closed; strategic review for automated re-entry' },
    ],
    media: [
      {
        id: 'wholesale-syndicate-01',
        localPath: '/media/wholesale/wholesale-syndicate-storefront.jpg',
        title: 'Wholesale Syndicate Brand Identity',
        caption: 'Official brand identity and logotype banner for Wholesale Syndicate retail format, launched August 2024.',
        type: 'image',
        alt: 'Official Wholesale Syndicate brand identity and logotype banner',
        year: '2024',
      },
      {
        id: 'wholesale-syndicate-02',
        localPath: '/media/wholesale/wholesale-syndicate-inventory.jpg',
        title: 'Wholesale Syndicate Warehouse Staging and POS Terminal',
        caption: 'Commodity staging, inventory ledger, and checkout billing terminal at Wholesale Syndicate.',
        type: 'image',
        alt: 'Wholesale Syndicate warehouse staging area and point of sale terminal',
        year: '2024',
      },
      {
        id: 'wholesale-syndicate-06',
        localPath: '/media/wholesale/wholesale-syndicate-checkout.jpg',
        title: 'Point-of-Sale Checkout Counter',
        caption: 'Operating retail checkout station and barcode scanning terminals.',
        type: 'image',
        alt: 'Supermarket checkout counter and point of sale',
        year: '2025',
      },
      {
        id: 'wholesale-staging-01',
        localPath: '/media/wholesale/jakuraa-history-wholesale-staging-01.webp',
        title: 'Supermarket Staging Floor & POS Checkout',
        caption: 'Wholesale Syndicate supermarket retail floor, inventory staging area, and point-of-sale checkout counter.',
        type: 'image',
        alt: 'Wholesale Syndicate commercial retail staging and POS checkout aisles',
        year: '2024',
      },
    ],
    lessonsLearned: [
      'Physical retail grocery operates at 8% to 15% gross margins, leaving little margin for error against shrinkage and labor overhead.',
      'Human cashier checkouts create the principal bottleneck in consumer retail velocity.',
      'Direct operating experience confirmed that the future of retail must integrate algorithmic inventory clearing and automated settlement.',
    ],
  },
  {
    id: 'chapter-2026-satelink-machine-commerce',
    year: '2026',
    period: '1 February 2026 - Present',
    eyebrow: 'FLAGSHIP PLATFORM',
    title: 'Satelink Machine Commerce Infrastructure',
    status: 'active',
    statusLabel: 'Active flagship production platform',
    summary:
      'Official launch of Satelink on 1 February 2026: the machine-commerce platform enabling autonomous software agents to purchase market intelligence and metered data services with cryptographic settlement.',
    narrative: [
      'On 1 February 2026, Jakuraa officially launched Satelink (satelink.network), the culmination of seven years of engineering, computing experiments, physical commerce, and operating truth.',
      'Satelink solves the critical bottleneck of the autonomous economy: AI agents and autonomous software systems need to pay for live data, compute, and market intelligence programmatically without human corporate cards or slow bank wire transfers. Utilizing the x402 protocol and USDT settlement rails on Polygon, Satelink allows agents to call APIs, verify proofs, and settle micro-transactions deterministically in sub-second cycles.',
      'Jakuraa serves as the corporate parent and systems builder behind Satelink, funding ongoing protocol development and operating the production node network.',
    ],
    keyFacts: [
      { label: 'Launch Date', value: '1 February 2026' },
      { label: 'Flagship Domain', value: 'https://satelink.network' },
      { label: 'Settlement Rail', value: 'x402 Protocol / USDT / Polygon' },
      { label: 'Primary Market', value: 'Autonomous AI Agents, Algorithmic Desks, Data Providers' },
    ],
    media: [
      {
        id: 'founder-systems-builder',
        localPath: '/media/founder/pradeep-jakuraa-systems-builder.jpg',
        title: 'Pradeep Jakuraa, Systems Builder',
        caption: 'Leading the architecture of machine commerce infrastructure.',
        type: 'image',
        alt: 'Pradeep Jakuraa, Systems Builder profile',
        year: '2025',
      },
      {
        id: 'founder-portrait-primary',
        localPath: '/media/founder/pradeep-jakuraa-portrait-primary.jpg',
        title: 'Founder Portrait',
        caption: 'Pradeep Jakuraa, founder and managing director.',
        type: 'image',
        alt: 'Portrait of Pradeep Jakuraa',
        year: '2024',
      },
    ],
    lessonsLearned: [
      'Autonomous software systems will soon conduct more economic transactions than human consumers.',
      'Machine commerce requires deterministic APIs, non-custodial smart contracts, and micro-billing rails.',
      'Every failure and success from 2019 to 2025 was necessary to understand why machine commerce is an inevitability.',
    ],
  },
];

export const institutionalLearnings = [
  {
    theme: 'Physical Inventory Drag',
    realization:
      'Physical inventory ties down working capital, depreciates through obsolescence, and requires expensive warehouse real estate. Software protocols scale with zero marginal inventory cost.',
  },
  {
    theme: 'Human Checkout Bottleneck',
    realization:
      'Whether in restaurants, hardware trade, or supermarkets, manual checkout and credit collection create operational friction. Programmatic machine-to-machine clearing eliminates settlement latency.',
  },
  {
    theme: 'Silicon and Compute Economics',
    realization:
      'Running GPU mining clusters in 2019 proved that electricity, bandwidth, and compute power are real commodities. Machine commerce treats digital intelligence as a commodity with instant cryptographic settlement.',
  },
  {
    theme: 'Honest Corporate History',
    realization:
      'Institutions are built through trial, divestment, and relentless refinement. A company that operated real supermarkets and trading counters possesses grounded judgment that purely theoretical startups cannot match.',
  },
];
