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

export const FooterLink = z.object({ label: z.string(), href: z.string(), hideWhenEmptyCollection: z.string().optional() });
export const FooterColumn = z.object({ title: z.string(), links: z.array(FooterLink) });
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
        { title: "Satelink Trading AI", items: [
          { label: "Overview", href: "/trading-agent", description: "AI trading OS for people, AI agents and machines", badge: "Beta" },
          { label: "How it works", href: "/trading-agent/how-it-works", description: "Reason, validate, score, authorize, execute, learn" },
          { label: "Risk and safety", href: "/trading-agent/risk", description: "AI proposes; deterministic risk and your signed mandate decide" },
          { label: "AI", href: "/trading-agent/ai", description: "What the AI can and cannot do" },
          { label: "Brokers", href: "/trading-agent/brokers", description: "Connector status, stage by stage" },
          { label: "Security", href: "/trading-agent/security" },
          { label: "Status", href: "/trading-agent/status" },
        ] },
        { title: "Machine commerce", items: [
          { label: "Machine Commerce", href: "/products/machine-commerce", description: "Discover, pay and settle — end to end" },
          { label: "API Metering", href: "/products/metering", description: "Usage, caps and receipts per agent" },
        ] },
      ],
      featureCard: { eyebrow: "Paper trading in controlled beta", title: "Request beta access", description: "Live execution is not yet available.", href: "/contact-sales?interest=beta" },
    },
    {
      label: "Solutions",
      groups: [
        { title: "By use case", items: [
          { label: "AI Agents", href: "/solutions/ai-agents" },
          { label: "Trading Systems", href: "/solutions/trading" },
          { label: "API Monetization", href: "/solutions/api-monetization" },
          { label: "Automation", href: "/solutions/automation" },
          { label: "Commerce", href: "/solutions/commerce" },
        ] },
        { title: "By company", items: [
          { label: "Startups", href: "/solutions/startups" },
          { label: "AI-native companies", href: "/solutions/ai-native" },
          { label: "Enterprise", href: "/solutions/enterprise" },
          { label: "Contact sales", href: "/contact-sales" },
        ] },
      ],
      featureCard: { eyebrow: "Talk to us", title: "Contact sales", description: "Volume, invoicing or a custom integration.", href: "/contact-sales" },
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
          { label: "RPC Infrastructure", href: "/products/rpc", description: "Polygon RPC at $0.00003 per call" },
          { label: "x402 Machine Payments", href: "/products/x402", description: "Keyless pay-per-call in USDC" },
          { label: "MCP server", href: "/trading-agent/docs", description: "Trading AI tools for AI agents (not public yet)" },
          { label: "x402 protocol", href: "/platform/x402" },
          { label: "Metering", href: "/platform/metering" },
          { label: "Status", href: "/status" },
          { label: "Changelog", href: "/changelog" },
        ] },
      ],
      featureCard: { eyebrow: "5 minutes", title: "Quickstart", description: "Make your first paid call from a script.", href: "/developers/quickstart" },
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
    { label: "Request beta access", href: "/contact-sales?interest=beta", variant: "primary" },
  ],
};

export const footerFallback: Footer = {
  site: "satelink",
  columns: [
    { title: "Products", links: [
      { label: "Satelink Trading AI", href: "/trading-agent" },
      { label: "How it works", href: "/trading-agent/how-it-works" },
      { label: "Risk and safety", href: "/trading-agent/risk" },
      { label: "Request beta access", href: "/contact-sales?interest=beta" },
      { label: "Machine Commerce", href: "/products/machine-commerce" },
      { label: "API Metering", href: "/products/metering" },
      { label: "Pricing", href: "/pricing" },
    ] },
    { title: "Platform", links: [
      { label: "Overview", href: "/product/overview" },
      { label: "API", href: "/platform/api" },
      { label: "x402", href: "/platform/x402" },
      { label: "Machine identity", href: "/platform/machine-identity" },
      { label: "Metering & credits", href: "/platform/metering" },
      { label: "Payments", href: "/platform/payments" },
      { label: "Settlement", href: "/platform/settlement" },
      { label: "Integrations", href: "/platform/integrations" },
    ] },
    { title: "Solutions", links: [
      { label: "Enterprise", href: "/solutions/enterprise" },
      { label: "Startups", href: "/solutions/startups" },
      { label: "Developers", href: "/solutions/developers" },
      { label: "AI agents", href: "/solutions/ai-agents" },
      { label: "Commerce", href: "/solutions/commerce" },
      { label: "Trading systems", href: "/solutions/trading" },
      { label: "API monetization", href: "/solutions/api-monetization" },
      { label: "Automation", href: "/solutions/automation" },
    ] },
    { title: "Developers", links: [
      { label: "Documentation", href: "https://docs.satelink.network" },
      { label: "Quickstart", href: "/developers/quickstart" },
      { label: "API reference", href: "/developers/api" },
      { label: "SDKs", href: "/developers/sdks" },
      { label: "Console", href: "https://console.satelink.network" },
      { label: "RPC Infrastructure", href: "/products/rpc" },
      { label: "x402 Machine Payments", href: "/products/x402" },
      { label: "MCP server", href: "/trading-agent/docs" },
      { label: "x402-kit (GitHub)", href: "https://github.com/Satelink-Protocol" },
    ] },
    { title: "Resources", links: [
      { label: "Blog", href: "/blog" },
      { label: "Customer stories", href: "/customer-stories", hideWhenEmptyCollection: "customer-stories" },
      { label: "News", href: "/news" },
      { label: "Changelog", href: "/changelog" },
      { label: "Academy", href: "/academy" },
      { label: "Tutorials", href: "/academy/tutorials" },
      { label: "Use cases", href: "/academy/use-cases" },
    ] },
  ],
  secondary: [
    { title: "Help and security", links: [
      { label: "Support center", href: "/support" },
      { label: "Status", href: "/status" },
      { label: "Security", href: "/security" },
      { label: "Report abuse", href: "/contact" },
      { label: "Responsible disclosure", href: "/responsible-disclosure" },
    ] },
    { title: "Company", links: [
      { label: "Jakuraa", href: "https://jakuraa.com" },
      { label: "Leadership", href: "https://jakuraa.com/company/leadership" },
      { label: "Company", href: "https://jakuraa.com/company" },
      { label: "Research", href: "https://jakuraa.com/research" },
      { label: "News", href: "https://jakuraa.com/news" },
      { label: "Careers", href: "https://jakuraa.com/careers" },
      { label: "Contact", href: "/contact" },
      { label: "Contact sales", href: "/contact-sales" },
    ] },
    { title: "Terms and policies", links: [
      { label: "Privacy policy", href: "/privacy" },
      { label: "Terms of service", href: "/terms" },
      { label: "Refund & Cancellation", href: "/refund" },
      { label: "Billing & payment", href: "/billing-policy" },
      { label: "Acceptable use policy", href: "/acceptable-use" },
      { label: "Cookie policy", href: "/cookies" },
      { label: "Data processing", href: "/data-processing" },
      { label: "Sub-processors", href: "/sub-processors" },
    ] },
  ],
  social: [],
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
