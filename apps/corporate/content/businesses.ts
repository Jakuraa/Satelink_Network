// Business verticals - derived only from the Memorandum of Association objects
// and the company's registrations. The founder sets `status`; nothing here may
// claim clients, volumes, facilities, partners, headcount or revenue.

export type BusinessStatus = "Operating" | "Registered capability" | "Planned";

export type Business = {
  slug: string;
  name: string;
  short: string;
  status: BusinessStatus;
  basis: string;
  summary: string;
  body: string[];
  scope: string[];
  illustration: "network" | "crates" | "globe" | "gear" | "pages";
  externalUrl?: string;
  // Medicines/pharma wording is gated on this. Leave null unless the founder
  // supplies the licence numbers issued under the Drugs and Cosmetics Act.
  drugLicence?: string | null;
};

export const businesses: Business[] = [
  {
    slug: "technology",
    name: "Technology - Satelink",
    short: "Satelink",
    status: "Operating",
    basis: "MOA object 3(b)(6): to develop, publish and license software and websites.",
    summary:
      "AI-agent and machine-commerce infrastructure: software agents and automated systems discover, evaluate, access, meter, pay for, and settle digital services programmatically.",
    body: [
      "Satelink is Jakuraa's flagship technology platform. It provides programmatic infrastructure for AI agents and automated systems to discover digital services, evaluate options, and access APIs through controlled machine-readable workflows.",
      "Supported platform capabilities include metered Polygon PoS RPC at flat $0.00003/call, keyless x402 micropayments in USDC on Base, prepaid USDT credit vaults on Polygon PoS, and the Trading Intelligence analytics API. Satelink Trading AI is an application built on the platform in controlled paper-trading beta.",
    ],
    scope: ["Agent procurement & machine commerce", "Polygon PoS RPC gateway", "Keyless x402 micropayments (Base)", "Usage metering and on-chain settlement"],
    illustration: "network",
    externalUrl: "https://satelink.network",
  },
  {
    slug: "trading-distribution",
    name: "Trading & Distribution",
    short: "Trading & Distribution",
    status: "Registered capability",
    basis: "MOA main object 3(a): wholesale and retail trade of goods.",
    summary:
      "Wholesale and retail trade in goods, including surgical and medical equipment and power tools.",
    body: [
      "The company's main object covers wholesale and retail trade. This page describes that registered capability; it is not a claim of current trading volumes, stock or customers.",
    ],
    scope: ["Wholesale trade", "Retail trade", "Surgical and medical equipment", "Power tools"],
    illustration: "crates",
    drugLicence: null,
  },
  {
    slug: "international-trade",
    name: "International Trade",
    short: "International Trade",
    status: "Registered capability",
    basis: "MOA object 3(a) and Importer-Exporter Code AADCF9341B (DGFT Coimbatore).",
    summary: "Import and export of goods under the company's Importer-Exporter Code.",
    body: [
      "Jakuraa holds an Importer-Exporter Code issued by the Directorate General of Foreign Trade, which permits the company to import and export goods. This page describes that registration, not active trade lanes or partners.",
    ],
    scope: ["Import of goods", "Export of goods"],
    illustration: "globe",
  },
  {
    slug: "industrial-manufacturing",
    name: "Industrial Manufacturing",
    short: "Industrial Manufacturing",
    status: "Registered capability",
    basis: "Udyam registration UDYAM-TN-03-0082507, NIC 28199 (other general-purpose machinery).",
    summary: "Manufacture of general-purpose machinery and parts, as registered under Udyam.",
    body: [
      "The company's Udyam registration covers the manufacture of general-purpose machinery and parts (NIC 28199). This page describes that registration; it is not a claim of a factory, output or clients.",
    ],
    scope: ["General-purpose machinery", "Machinery parts"],
    illustration: "gear",
  },
  {
    slug: "publishing-insights",
    name: "Publishing & Insights",
    short: "Publishing & Insights",
    status: "Planned",
    basis: "MOA object 3(b)(1): publishing of articles, research and write-ups.",
    summary: "Articles, research and write-ups on machine commerce and the businesses we operate.",
    body: [
      "We plan to publish research and write-ups drawn from the work we do. Nothing has been published under this vertical yet; items will appear in News when they exist.",
    ],
    scope: ["Articles", "Research", "Write-ups"],
    illustration: "pages",
  },
];

export function getBusiness(slug: string) {
  return businesses.find((b) => b.slug === slug);
}

/** Pharma/medicines wording is only allowed when a drug licence is on file. */
export function scopeFor(b: Business): string[] {
  const scope = [...b.scope];
  if (b.drugLicence) scope.splice(2, 0, "Medicines (licensed distribution)");
  return scope;
}
