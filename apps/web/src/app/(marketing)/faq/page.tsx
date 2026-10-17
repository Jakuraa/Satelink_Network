import type { Metadata } from "next";
import Link from "next/link";
import { buildMetadata, faqLd, jsonLdScript } from "@satelink/seo";
import { FAQView, FAQItem } from "@/components/faq/FAQView";
import DISCLAIMERS from "@/lib/trading-agent/disclaimers.json";

export const metadata: Metadata = buildMetadata({
  title: "Frequently Asked Questions — Satelink",
  description:
    "Technical answers about Satelink AI-agent infrastructure, machine discovery, HTTP 402 payments, flat RPC pricing, and non-custodial boundaries.",
  path: "/faq",
});

const ALL_FAQS: FAQItem[] = [
  // 1. Platform & Agent Assistance
  {
    category: "Platform & Agent Assistance",
    question: "What is Satelink?",
    answer:
      "Satelink is programmatic infrastructure for autonomous AI agents and automated systems to discover digital services, evaluate options, and access APIs through controlled, machine-readable workflows. It is operated by Jakuraa Commercial Private Limited (incorporated in 2019 in Coimbatore, India).",
  },
  {
    category: "Platform & Agent Assistance",
    question: "Who is Satelink designed for?",
    answer:
      "Satelink serves AI agent developers building autonomous workflows, software teams requiring pay-per-call infrastructure without recurring subscription lock-in, quantitative researchers, and enterprises requiring verifiable, auditable API procurement.",
  },
  {
    category: "Platform & Agent Assistance",
    question: "What is agent procurement?",
    answer:
      "Agent procurement is the automated discovery, evaluation, authorization, access, metering, payment, and settlement for digital services by software agents. Satelink provides machine-readable specifications and payment rails that allow autonomous systems to procure supported APIs programmatically.",
  },
  {
    category: "Platform & Agent Assistance",
    question: "What role does machine commerce play?",
    answer:
      "Machine commerce is software paying software for services. Satelink provides the rails a machine uses to discover a priced API, pay for it programmatically without human credit card checkout, and settle on-chain with verifiable receipts.",
  },

  // 2. Service Discovery & APIs
  {
    category: "Service Discovery & APIs",
    question: "How do software agents discover Satelink endpoints?",
    answer:
      "Agents discover services programmatically by querying the standard machine-readable manifest at `GET https://rpc.satelink.network/.well-known/satelink.json`. This provides endpoint URIs, schema definitions, supported authentication schemes, and pricing specifications.",
  },
  {
    category: "Service Discovery & APIs",
    question: "What is /.well-known/satelink.json?",
    answer:
      "It is an RFC 8615 well-known URI that returns an immutable machine-readable catalog of Satelink's available production endpoints, current pricing contracts, and supported payment rails.",
  },
  {
    category: "Service Discovery & APIs",
    question: "Does Satelink support the Model Context Protocol (MCP)?",
    answer:
      "Yes. Satelink publishes an open MCP server package (`@satelink/mcp-server`) that enables Claude Desktop and other MCP-compliant AI clients to discover services, inspect catalog methods, and execute approved queries directly.",
  },

  // 3. Authentication & Keys
  {
    category: "Authentication & Keys",
    question: "What authentication methods does Satelink support?",
    answer:
      "Satelink supports two primary authentication modes: 1) Keyless x402 authorization using signed EIP-712 headers in USDC on Base, and 2) Developer API keys (`sat_live_...`) funded with prepaid USDT credits on Polygon PoS.",
  },
  {
    category: "Authentication & Keys",
    question: "Do I need an account to call Satelink services?",
    answer:
      "No account or human signup is required for keyless x402 calls. A software agent can pay per call directly using on-chain authorization. For developer API keys with custom rate ceilings, key registration is available via the developer console.",
  },
  {
    category: "Authentication & Keys",
    question: "What are the rate limits for developer API keys?",
    answer:
      "Newly provisioned developer keys start with a rate limit ceiling of 500 calls per day. This ceiling can be increased upon request for high-throughput enterprise workloads.",
  },

  // 4. Pricing & Billing
  {
    category: "Pricing & Billing",
    question: "How much does Satelink RPC cost?",
    answer:
      "Polygon PoS JSON-RPC access is priced at a flat rate of $0.000030 per call. Keyless bundles via x402 are priced at $0.10 for 1,000 calls in USDC on Base. There are zero dynamic surge multipliers.",
  },
  {
    category: "Pricing & Billing",
    question: "Is there a free tier of calls?",
    answer:
      "There is no anonymous free tier. Every unauthenticated request receives an immediate HTTP 402 challenge. Keys start with a 500 calls/day rate limit ceiling and require deposited USDT credits or keyless x402 payments to execute.",
  },
  {
    category: "Pricing & Billing",
    question: "How are credits deposited and tracked?",
    answer:
      "USDT deposits are committed on-chain to the `RevenueVaultV2` contract on Polygon (chain ID 137). Each call decrements the balance atomically in the epoch metering ledger.",
  },

  // 5. x402 Micropayments
  {
    category: "x402 Micropayments",
    question: "What is x402?",
    answer:
      "x402 is an open protocol standard built around the HTTP 402 Payment Required status code. It allows an API server to challenge an incoming request with pricing requirements, and allows a client to pay keylessly per call in USDC on Base (chain ID 8453).",
  },
  {
    category: "x402 Micropayments",
    question: "How does an agent pay keylessly?",
    answer:
      "When the agent receives HTTP 402, it signs an EIP-712 authorization payload containing the quoted amount and nonce, attaches it to the `X-Payment` header, and retries the request. The facilitator verifies the signature and streams the response immediately.",
  },
  {
    category: "x402 Micropayments",
    question: "Which network is used for x402 settlement?",
    answer:
      "x402 micropayments settle on Base L2 (chain ID 8453) using native USDC for minimal transaction fees and fast confirmation times.",
  },

  // 6. RPC Infrastructure
  {
    category: "RPC Infrastructure",
    question: "Which blockchain networks are supported for RPC?",
    answer:
      "Satelink operates high-throughput JSON-RPC infrastructure for Polygon PoS mainnet (chain ID 137). Support for additional chains will be announced in official release notes.",
  },
  {
    category: "RPC Infrastructure",
    question: "What RPC methods are supported?",
    answer:
      "Standard Ethereum execution and query methods are supported, including `eth_blockNumber`, `eth_getBlockByNumber`, `eth_call`, `eth_getTransactionReceipt`, and `eth_getLogs` within bounded block ranges.",
  },
  {
    category: "RPC Infrastructure",
    question: "What is the status of the node operator program?",
    answer:
      "The node operator program is paused. Operator payouts are not active, and new node registrations are not currently accepted.",
  },

  // 7. Security & Trading AI Beta
  {
    category: "Security & Trading AI Beta",
    question: "Does Satelink hold customer funds?",
    answer:
      "No. Satelink is strictly non-custodial. Broker funds remain with your authorized broker, and withdrawals are never enabled. Machine payments execute directly via user-funded wallets or prepaid credit vaults.",
  },
  {
    category: "Security & Trading AI Beta",
    question: "What is the status of Satelink Trading AI?",
    answer:
      "Satelink Trading AI is the first intended application built on the platform. It operates in controlled paper-trading beta; live execution is not yet available. AI models propose suggestions, while deterministic risk engines and signed mandates decide.",
  },
  {
    category: "Security & Trading AI Beta",
    question: "Is any content on Satelink investment advice?",
    answer: DISCLAIMERS.notAdvice,
  },
];

export default function FAQPage() {
  const jsonLdData = faqLd(
    ALL_FAQS.map((f) => ({ question: f.question, answer: f.answer }))
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLdData) }}
      />

      <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 lg:py-24">
        {/* Contextual Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex items-center gap-2 font-sl-mono text-xs text-sl-text-subtle">
            <li>
              <Link href="/" className="hover:text-sl-text transition-colors">
                Home
              </Link>
            </li>
            <li>/</li>
            <li className="text-sl-accent font-medium">FAQ</li>
          </ol>
        </nav>

        {/* Header Section (Reference E Pattern) */}
        <div className="max-w-3xl">
          <span className="font-sl-mono text-xs uppercase tracking-wider text-sl-accent font-semibold">
            Knowledge Base &amp; Protocol Reference
          </span>
          <h1 className="mt-3 font-sl-display text-4xl sm:text-5xl font-normal tracking-[-0.02em] text-sl-text">
            Frequently Asked Questions
          </h1>
          <p className="mt-4 text-lg text-sl-text-muted leading-relaxed">
            Detailed answers regarding Satelink AI-agent infrastructure, machine service discovery, HTTP 402 payment handshakes, flat RPC rates, and non-custodial safety boundaries.
          </p>
        </div>

        {/* Interactive FAQ View with Tabs and Accordions */}
        <div className="mt-12">
          <FAQView items={ALL_FAQS} />
        </div>

        {/* Related Documentation & Next Steps */}
        <div className="mt-20 border-t border-sl-border pt-12">
          <h2 className="font-sl-display text-2xl font-normal text-sl-text">
            Related Documentation &amp; Technical Specs
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href="https://docs.satelink.network"
              className="group rounded-xl border border-sl-border bg-sl-surface p-5 transition-all hover:border-sl-border-strong hover:shadow-md"
            >
              <span className="font-sl-mono text-xs text-sl-accent uppercase tracking-wider">
                Documentation
              </span>
              <h3 className="mt-1 font-semibold text-sl-text text-base group-hover:text-sl-accent transition-colors">
                Developer Docs &rarr;
              </h3>
              <p className="mt-2 text-xs text-sl-text-muted leading-relaxed">
                Full API references, integration manifests, and protocol parameters.
              </p>
            </Link>

            <Link
              href="/developers/quickstart"
              className="group rounded-xl border border-sl-border bg-sl-surface p-5 transition-all hover:border-sl-border-strong hover:shadow-md"
            >
              <span className="font-sl-mono text-xs text-sl-accent uppercase tracking-wider">
                5-Minute Guide
              </span>
              <h3 className="mt-1 font-semibold text-sl-text text-base group-hover:text-sl-accent transition-colors">
                Quickstart &rarr;
              </h3>
              <p className="mt-2 text-xs text-sl-text-muted leading-relaxed">
                Make your first discovery query or metered Polygon RPC call.
              </p>
            </Link>

            <Link
              href="/pricing"
              className="group rounded-xl border border-sl-border bg-sl-surface p-5 transition-all hover:border-sl-border-strong hover:shadow-md"
            >
              <span className="font-sl-mono text-xs text-sl-accent uppercase tracking-wider">
                Transparent Rates
              </span>
              <h3 className="mt-1 font-semibold text-sl-text text-base group-hover:text-sl-accent transition-colors">
                Pricing Schedule &rarr;
              </h3>
              <p className="mt-2 text-xs text-sl-text-muted leading-relaxed">
                Flat $0.00003/call RPC pricing and $0.10/1k calls x402 bundles.
              </p>
            </Link>

            <Link
              href="/trading-agent/risk"
              className="group rounded-xl border border-sl-border bg-sl-surface p-5 transition-all hover:border-sl-border-strong hover:shadow-md"
            >
              <span className="font-sl-mono text-xs text-sl-accent uppercase tracking-wider">
                Safety Architecture
              </span>
              <h3 className="mt-1 font-semibold text-sl-text text-base group-hover:text-sl-accent transition-colors">
                Risk Controls &rarr;
              </h3>
              <p className="mt-2 text-xs text-sl-text-muted leading-relaxed">
                Deterministic risk gates, signed mandates, and non-custodial rules.
              </p>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
