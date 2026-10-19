// /pricing — Satelink Pricing & Usage Architecture.
// Structured after modern frontier AI assistance and execution platforms (claude.com pattern).
// Truth-in-advertising verified: plans, allowances and units render from PlanCatalog (lib/plan-catalog.ts).
import type { Metadata } from "next";
import { buildMetadata, faqLd, jsonLdScript } from "@satelink/seo";
import { planCatalog } from "@/lib/plan-catalog";
import { PricingView } from "@/components/PricingView";

export const metadata: Metadata = buildMetadata({
  title: "Pricing & Execution Plans",
  description:
    "Satelink pricing: AI assistance and execution for people, agents, and connected services. Free discovery tier, Pro ₹999/mo, Max 5× ₹3,999/mo, Max 20× ₹7,999/mo with upfront annual discounts. Transparent usage metering, burst budgets, and machine-native payment rails.",
  path: "/pricing",
});

export default function PricingPage() {
  const catalog = planCatalog();
  const launch = catalog.plans.find((p) => p.id === "launch");

  const faq = [
    {
      question: "What is a Usage Unit (UU)?",
      answer: `A Usage Unit (UU) is Satelink's transparent computational execution unit. 1 UU = $${catalog.unit.usd_list_value} USD of list value (~₹0.084). Rather than arbitrary message caps, your plan allowance is drawn down based on actual model tokens, tool execution, search queries, and sandbox compute with zero token markup.`,
    },
    {
      question: "How do the session burst and weekly allowances work?",
      answer: `Each tier features dual-window protection: a weekly allowance that resets every Monday at 00:00 UTC, and a rolling ${catalog.windows.session_hours}-hour session allowance. The session window ensures high-velocity bursts without risking premature exhaustion of your weekly allowance in a single run.`,
    },
    {
      question: "What happens when my allowance is reached?",
      answer: "When your session or weekly limit is reached, execution pauses gracefully and fails closed with explicit notification. You can wait for the rolling session window to refill, upgrade to a higher tier (Max 5× or Max 20×), draw from non-expiring purchased usage credits, or switch to your own provider API keys (BYOK). Nothing is ever silently billed without your explicit consent.",
    },
    {
      question: "What taxes apply to subscriptions and credit purchases?",
      answer: "All advertised plan and credit prices are exclusive of statutory taxes. For Indian resident customers, Goods and Services Tax (18% GST) is calculated and charged at checkout. Invoices with full GSTIN details and statutory tax breakdowns are issued upon successful payment. Cross-border international exports are zero-rated where documented.",
    },
    {
      question: "What payment rails are supported?",
      answer: "Satelink supports two dedicated, non-custodial rails: Transacty processes fiat payments including UPI and credit/debit cards with instant confirmation. PayRam operates as our self-hosted, non-custodial crypto payment gateway for USDT deposits on Polygon (RevenueVaultV2) and USDC micro-payments on Base (x402). Razorpay is permanently excluded from our payment architecture.",
    },
    {
      question: "Can autonomous software or AI agents pay without a human subscription?",
      answer: "Yes. Autonomous software can utilize the x402 payment protocol on Base (USDC) or prepaid smart contract vaults on Polygon (USDT) to pay per call deterministically. When an unauthenticated agent makes a request requiring payment, Satelink responds with HTTP 402 and cryptographic payment parameters, allowing keyless pay-per-call execution without account signup.",
    },
    {
      question: "How do additional usage credits (credit packs) work?",
      answer: "Additional usage credits allow heavy execution without upgrading your monthly plan tier. Available in suggested candidate packages (₹8,400 / ₹21,000 / ₹84,000) or custom amounts, usage credits never expire and are consumed only after your included plan allowance is depleted.",
    },
    {
      question: "What is the refund and cancellation policy?",
      answer: "You may cancel recurring subscriptions at any time via your Console settings; cancellation takes effect at the end of the current billing cycle. Refunds for unused subscriptions or credit purchases follow our statutory Refund Policy. Consumed model inference and computational resources are non-refundable.",
    },
    ...(launch?.intro
      ? [
          {
            question: "How does Launch work?",
            answer: `${launch.intro.copy} Launch includes the same allowance as Pro; cancel before renewal and you won't be charged again.`,
          },
        ]
      : []),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(faqLd(faq)) }}
      />
      <PricingView catalog={catalog} faqList={faq} />
    </>
  );
}
