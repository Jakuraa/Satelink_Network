import type { Metadata } from "next";
import { OPERATOR_PROGRAM_PAUSED } from "@/lib/operator-program";
import Link from "next/link";
import { docsByCategory } from "@/lib/docs";

export const metadata: Metadata = {
  title: "Satelink Documentation",
  description:
    "Everything you need to build on Satelink: quick start, API reference, billing and credits, node operation, machine onboarding, and the on-chain revenue model.",
  alternates: { canonical: "https://docs.satelink.network" },
  openGraph: {
    title: "Satelink Documentation",
    description:
      "Docs for Satelink Trading AI and the legacy Satelink RPC gateway on Polygon PoS.",
    url: "https://docs.satelink.network",
    siteName: "Satelink Docs",
    type: "website",
  },
};

export default function DocsIndexPage() {
  const groups = docsByCategory();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Satelink Documentation",
    url: "https://docs.satelink.network",
    description:
      "Documentation for Satelink Trading AI and the legacy Satelink RPC gateway on Polygon PoS: pay-per-call USDT metering, permissionless deposits and machine onboarding.",
    publisher: {
      "@type": "Organization",
      name: "Satelink Network",
      url: "https://satelink.network",
    },
  };

  return (
    <article className="docs-article">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <h1>Satelink Documentation</h1>
      <p className="docs-lede">
        Satelink Trading AI is an AI trading operating system for people, AI
        agents and machines. Its documentation is at{" "}
        <a href="/trading-agent/docs">/trading-agent/docs</a>. The pages below
        document the legacy Satelink RPC gateway on Polygon PoS, where developers
        and machines pay <strong>$0.00003 per call</strong> in USDT.{" "}
        {OPERATOR_PROGRAM_PAUSED}
      </p>

      {groups.map((g) => (
        <section key={g.category}>
          <h2>{g.category}</h2>
          <div className="docs-index-grid">
            {g.docs.map((d) => (
              <Link key={d.slug} href={`/docs/${d.slug}`} className="docs-index-card">
                <h3>{d.title}</h3>
                <p>{d.description}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </article>
  );
}
