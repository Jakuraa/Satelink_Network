import type { Metadata } from "next";
import { OPERATOR_PROGRAM_PAUSED } from "@/lib/operator-program";
import Link from "next/link";
import { docsByCategory } from "@/lib/docs";

export const metadata: Metadata = {
  title: "Satelink Documentation",
  description:
    "Technical documentation for the Satelink AI-agent & machine-commerce platform, including HTTP 402 machine payments, API reference, Polygon PoS RPC gateway, and Trading AI paper beta docs.",
  alternates: { canonical: "https://docs.satelink.network" },
  openGraph: {
    title: "Satelink Documentation",
    description:
      "Technical documentation for the Satelink AI-agent & machine-commerce platform, Polygon PoS RPC gateway, and Trading AI paper beta docs.",
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
      "Technical documentation for the Satelink AI-agent & machine-commerce platform, Polygon PoS RPC gateway, and Trading AI paper beta docs.",
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
        Satelink provides software infrastructure for AI agents and automated
        systems to programmatically discover, procure, and settle digital services.
        Trading AI documentation (in paper-trading beta) is available at{" "}
        <a href="/trading-agent/docs">/trading-agent/docs</a>. The pages below
        document the Satelink RPC gateway on Polygon PoS, where developers
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
