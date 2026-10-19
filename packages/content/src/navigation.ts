// Navigation + Footer content model + fallback fixtures + readers (§6/§7).
// The public shells are data-driven: components take this data as props; each
// app fetches it (CMS globals via REST) and falls back to these fixtures so the
// site renders fully even when the CMS is down or unset.
import { z } from "zod";
import { getCollection } from "./client";

// ---- Schemas ----
export const NavItem = z.object({
  label: z.string(),
  href: z.string(),
  description: z.string().optional(),
  badge: z.string().optional(),
});
export const NavGroup = z.object({ title: z.string().optional(), items: z.array(NavItem) });
export const NavMenu = z.object({
  label: z.string(),
  // A menu with an href and no groups renders as a plain top-level link.
  href: z.string().optional(),
  groups: z.array(NavGroup).default([]),
  featureCard: z.object({ title: z.string(), href: z.string(), description: z.string().optional(), eyebrow: z.string().optional() }).optional(),
});
export const NavCta = z.object({ label: z.string(), href: z.string(), variant: z.enum(["ghost", "primary", "secondary"]).optional() });
export const Navigation = z.object({
  site: z.enum(["satelink", "jakuraa"]).default("satelink"),
  menus: z.array(NavMenu),
  cta: z.array(NavCta),
});
export type Navigation = z.infer<typeof Navigation>;
export type NavMenu = z.infer<typeof NavMenu>;

export const FooterLink = z.object({
  label: z.string(),
  href: z.string(),
  hideWhenEmptyCollection: z.string().optional(),
  badge: z.string().optional(),
  external: z.boolean().optional(),
});
export const FooterSection = z.object({
  title: z.string(),
  links: z.array(FooterLink),
});
export const FooterColumn = z.object({
  title: z.string(),
  sections: z.array(FooterSection).optional(),
  links: z.array(FooterLink),
});
export const Footer = z.object({
  site: z.enum(["satelink", "jakuraa"]).default("satelink"),
  columns: z.array(FooterColumn),
  secondary: z.array(FooterColumn),
  social: z.array(z.object({ platform: z.string(), href: z.string() })),
});
export type Footer = z.infer<typeof Footer>;

// ---- Fallback fixtures (satelink) — the canonical IA ----
// Unified header (2026-09-25, claude.com pattern): five menus, then Log in +
// one primary action. Search and theme live in a compact icon cluster; Contact
// sales lives in Solutions and the footer — never in the header row.
const CONSOLE = "https://console.satelink.network";
export const navigationFallback: Navigation = {
  site: "satelink",
  menus: [
    {
      label: "Products",
      groups: [
        { title: "Machine commerce & rails", items: [
          { label: "Machine Commerce", href: "/products/machine-commerce", description: "Discover, evaluate, authorize, access, meter, pay, settle" },
          { label: "RPC Infrastructure", href: "/products/rpc", description: "Polygon PoS RPC at flat $0.00003 per call" },
          { label: "x402 Machine Payments", href: "/products/x402", description: "Keyless pay-per-call in USDC on Base" },
          { label: "API Metering", href: "/products/metering", description: "Usage, caps, and receipts per agent" },
        ] },
        { title: "Applications", items: [
          { label: "Trading Intelligence", href: "/products/trading-intelligence/funding-rate-heatmap", description: "Derived market analytics bought per call" },
          { label: "Satelink Trading AI", href: "/trading-agent", description: "AI proposes, deterministic risk and signed mandates decide", badge: "Beta" },
        ] },
      ],
      featureCard: { eyebrow: "Agent procurement", title: "Machine Commerce", description: "Programmatic infrastructure for AI agents to discover, access, and pay for services.", href: "/products/machine-commerce" },
    },
    {
      label: "Solutions",
      groups: [
        { title: "By use case", items: [
          { label: "AI Agents", href: "/solutions/ai-agents" },
          { label: "Machine Commerce", href: "/solutions/machine-commerce" },
          { label: "API Monetization", href: "/solutions/api-monetization" },
          { label: "Automation", href: "/solutions/automation" },
          { label: "Trading Systems", href: "/solutions/trading" },
          { label: "Commerce", href: "/solutions/commerce" },
        ] },
        { title: "By company", items: [
          { label: "AI-native companies", href: "/solutions/ai-native" },
          { label: "Developers", href: "/solutions/developers" },
          { label: "Startups", href: "/solutions/startups" },
          { label: "Enterprise", href: "/solutions/enterprise" },
          { label: "Contact sales", href: "/contact-sales" },
        ] },
      ],
      featureCard: { eyebrow: "Talk to us", title: "Contact sales", description: "Volume, dedicated keys, or custom integrations.", href: "/contact-sales" },
    },
    { label: "Pricing", href: "/pricing", groups: [] },
    {
      label: "Developers",
      groups: [
        { title: "Build", items: [
          { label: "Docs", href: "https://docs.satelink.network" },
          { label: "Quickstart", href: "/developers/quickstart" },
          { label: "API reference", href: "/developers/api" },
          { label: "SDKs", href: "/developers/sdks" },
        ] },
        { title: "Protocols and infrastructure", items: [
          { label: "RPC Infrastructure", href: "/products/rpc", description: "Polygon PoS RPC at $0.00003 per call" },
          { label: "x402 Protocol", href: "/platform/x402", description: "Keyless pay-per-call in USDC on Base" },
          { label: "API Metering", href: "/platform/metering", description: "Prepaid USDT credits on Polygon PoS" },
          { label: "Machine identity", href: "/platform/machine-identity" },
          { label: "Status", href: "/status" },
          { label: "Changelog", href: "/changelog" },
        ] },
      ],
      featureCard: { eyebrow: "5 minutes", title: "Quickstart", description: "Make your first paid call or query discovery.", href: "/developers/quickstart" },
    },
    {
      label: "Resources",
      groups: [
        { title: "Read", items: [
          { label: "Blog", href: "/blog" },
          { label: "News", href: "/news" },
          { label: "Changelog", href: "/changelog" },
        ] },
        { title: "Learn", items: [
          { label: "Academy", href: "/academy" },
          { label: "Tutorials", href: "/academy/tutorials" },
          { label: "Use cases", href: "/academy/use-cases" },
          { label: "Support center", href: "/support" },
        ] },
      ],
    },
  ],
  cta: [
    { label: "Log in", href: `${CONSOLE}/sign-in`, variant: "ghost" },
    { label: "Quickstart", href: "/developers/quickstart", variant: "primary" },
  ],
};

const col1Sections = [
  {
    title: "Core Infrastructure",
    links: [
      { label: "Machine Commerce", href: "/products/machine-commerce" },
      { label: "Polygon RPC Gateway", href: "/products/rpc" },
      { label: "x402 Machine Payments", href: "/products/x402" },
      { label: "API Metering & Quotas", href: "/products/metering" },
      { label: "Prepaid Credit Vaults", href: "/platform/payments" },
      { label: "On-Chain Settlement", href: "/platform/settlement" },
      { label: "Flat Pricing Schedule", href: "/pricing" },
    ],
  },
  {
    title: "Applications & AI",
    links: [
      { label: "Trading Intelligence API", href: "/products/trading-intelligence/funding-rate-heatmap" },
      { label: "Satelink Trading AI", href: "/trading-agent", badge: "Beta" },
      { label: "Risk Engine & Controls", href: "/trading-agent/risk" },
      { label: "Mandate Protocol", href: "/trading-agent/how-it-works" },
      { label: "Platform Overview", href: "/product/overview" },
    ],
  },
];

const col2Sections = [
  {
    title: "By Capability",
    links: [
      { label: "Autonomous AI Agents", href: "/solutions/ai-agents" },
      { label: "Machine Commerce", href: "/solutions/machine-commerce" },
      { label: "API Monetization", href: "/solutions/api-monetization" },
      { label: "Workflow Automation", href: "/solutions/automation" },
      { label: "Quantitative Trading", href: "/solutions/trading" },
      { label: "Commerce Rails", href: "/solutions/commerce" },
    ],
  },
  {
    title: "By Organization",
    links: [
      { label: "AI-Native Startups", href: "/solutions/ai-native" },
      { label: "Developer Teams", href: "/solutions/developers" },
      { label: "Enterprise Procurement", href: "/solutions/enterprise" },
      { label: "Contact Sales", href: "/contact-sales" },
    ],
  },
];

const col3Sections = [
  {
    title: "Developer Hub",
    links: [
      { label: "Documentation", href: "https://docs.satelink.network", external: true },
      { label: "Quickstart Guide", href: "/developers/quickstart" },
      { label: "API Reference", href: "/developers/api" },
      { label: "Official SDKs", href: "/developers/sdks" },
      { label: "Developer Guides", href: "/developers" },
      { label: "GitHub Repository", href: "https://github.com/Jakuraa/Satelink_Network", external: true },
    ],
  },
  {
    title: "Protocols & Rails",
    links: [
      { label: "Machine Manifest", href: "/.well-known/satelink.json", external: true },
      { label: "x402 Protocol Spec", href: "/platform/x402" },
      { label: "Machine Identity", href: "/platform/machine-identity" },
      { label: "Integration Standards", href: "/platform/integrations" },
      { label: "Network Telemetry", href: "/status" },
    ],
  },
];

const col4Sections = [
  {
    title: "Learning & Academy",
    links: [
      { label: "Satelink Academy", href: "/academy" },
      { label: "Interactive Tutorials", href: "/academy/tutorials" },
      { label: "System Use Cases", href: "/academy/use-cases" },
      { label: "Technical Courses", href: "/academy/courses" },
      { label: "Platform FAQ", href: "/faq" },
      { label: "Support Center", href: "/support" },
    ],
  },
  {
    title: "Publications",
    links: [
      { label: "Official Blog", href: "/blog" },
      { label: "Product Newsroom", href: "/news" },
      { label: "System Changelog", href: "/changelog" },
      { label: "Customer Stories", href: "/customer-stories" },
    ],
  },
];

const col5Sections = [
  {
    title: "Company",
    links: [
      { label: "About Satelink", href: "/corporate" },
      { label: "Jakuraa Parent Institution", href: "https://jakuraa.com", external: true },
      { label: "Corporate Governance", href: "https://jakuraa.com/company", external: true },
      { label: "Systems Research", href: "https://jakuraa.com/research", external: true },
      { label: "Contact & Inquiries", href: "/contact" },
    ],
  },
  {
    title: "Trust & Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Refund Policy", href: "/refund" },
      { label: "Billing & Payment Policy", href: "/billing-policy" },
      { label: "Security Disclosure", href: "/responsible-disclosure" },
      { label: "Acceptable Use Policy", href: "/acceptable-use" },
      { label: "Sub-processors", href: "/sub-processors" },
    ],
  },
];

export const footerFallback: Footer = {
  site: "satelink",
  columns: [
    {
      title: "Products and capabilities",
      sections: col1Sections,
      links: col1Sections.flatMap((s) => s.links),
    },
    {
      title: "Solutions",
      sections: col2Sections,
      links: col2Sections.flatMap((s) => s.links),
    },
    {
      title: "Developers and learning",
      sections: col3Sections,
      links: col3Sections.flatMap((s) => s.links),
    },
    {
      title: "Resources",
      sections: col4Sections,
      links: col4Sections.flatMap((s) => s.links),
    },
    {
      title: "Company and policies",
      sections: col5Sections,
      links: col5Sections.flatMap((s) => s.links),
    },
  ],
  secondary: [
    {
      title: "Legal and Trust",
      links: [
        { label: "Privacy policy", href: "/privacy" },
        { label: "Terms of service", href: "/terms" },
        { label: "Refund & Cancellation", href: "/refund" },
        { label: "Billing & payment", href: "/billing-policy" },
        { label: "Acceptable use policy", href: "/acceptable-use" },
        { label: "Security disclosure", href: "/responsible-disclosure" },
      ],
    },
  ],
  secondary: [
    {
      title: "Legal and Trust",
      links: [
        { label: "Privacy policy", href: "/privacy" },
        { label: "Terms of service", href: "/terms" },
        { label: "Refund & Cancellation", href: "/refund" },
        { label: "Billing & payment", href: "/billing-policy" },
        { label: "Acceptable use policy", href: "/acceptable-use" },
        { label: "Security disclosure", href: "/responsible-disclosure" },
      ],
    },
  ],
  social: [
    { platform: "GitHub", href: "https://github.com/Jakuraa/Satelink_Network" },
    { platform: "Status", href: "https://status.satelink.network" },
    { platform: "Contact", href: "mailto:satelinknetwork@gmail.com" },
  ],
};

// ---- Readers (CMS globals via REST, with fallback) ----
export async function getNavigation(site: "satelink" | "jakuraa" = "satelink"): Promise<Navigation> {
  const fallback = navigationFallback;
  if (site !== "satelink") return { ...fallback, site };
  return getCollection("/api/globals/navigation?depth=2", Navigation, fallback, { tag: "navigation", revalidate: 300 });
}

export async function getFooter(site: "satelink" | "jakuraa" = "satelink"): Promise<Footer> {
  const fallback = footerFallback;
  if (site !== "satelink") return { ...fallback, site };
  return getCollection("/api/globals/footer?depth=2", Footer, fallback, { tag: "footer", revalidate: 300 });
}
