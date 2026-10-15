import type { Metadata } from "next";
import { Manrope, IBM_Plex_Mono } from "next/font/google";
import "../../../../packages/ui/src/styles/theme.css";
import "./globals.css";

// Central typography system:
// - Manrope (400, 500, 600, 700): primary headings, body, navigation, UI
// - IBM Plex Mono (400, 500, 600): technical labels, protocol identifiers, telemetry
const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-manrope",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://satelink.network"),
  title: {
    default: "Satelink Trading AI — AI trading operating system for people, AI agents and machines",
    template: "%s | Satelink",
  },
  description:
    "Reason, validate, score, authorize, execute, learn. AI proposes; deterministic risk and your signed mandate decide. You keep custody; withdrawals are never enabled. Paper trading in controlled beta. Live execution is not yet available.",
  keywords: [
    "Satelink Trading AI",
    "AI trading agents",
    "AI trading operating system",
    "algorithmic trading",
    "risk management",
    "trading mandates",
    "MCP",
    "machine commerce",
    "x402",
    "pay per call API",
  ],
  authors: [{ name: "Satelink Network" }],
  robots: "index, follow",
  // No blanket canonical here - a root-level canonical makes EVERY page
  // canonical to "/" (the bug called out in the reposition audit). Each page
  // sets its own via `alternates.canonical` in its metadata.
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    type: "website",
    url: "https://satelink.network",
    siteName: "Satelink Network",
    title: "Satelink Trading AI — AI trading operating system for people, AI agents and machines",
    description:
      "Reason, validate, score, authorize, execute, learn. AI proposes; deterministic risk and your signed mandate decide. You keep custody; withdrawals are never enabled. Paper trading in controlled beta. Live execution is not yet available.",
    images: ["https://satelink.network/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Satelink Trading AI — AI trading operating system for people, AI agents and machines",
    description:
      "Reason, validate, score, authorize, execute, learn. AI proposes; deterministic risk and your signed mandate decide. You keep custody; withdrawals are never enabled. Paper trading in controlled beta. Live execution is not yet available.",
  },
};

const ORG_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Satelink Network",
  description:
    "Satelink Trading AI: an AI trading operating system for people, AI agents and machines, plus machine-commerce rails (x402 payments, metered Polygon RPC). Operated by Jakuraa Commercial Pvt Ltd.",
  url: "https://satelink.network",
  email: "satelinknetwork@gmail.com",
  foundingDate: "2025",
  sameAs: ["https://github.com/Jakuraa/x402-kit"],
};

// Primary product for this merchant account.
const INTELLIGENCE_PRODUCT_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "Satelink Trading Intelligence",
  description:
    "Derived trading intelligence - funding-rate heatmaps, open-interest shifts, liquidation clusters, market microstructure - computed from public market data. Raw exchange feeds are never redistributed.",
  url: "https://satelink.network/trading-agent/product",
  offers: {
    "@type": "Offer",
    price: "0.01",
    priceCurrency: "USD",
    priceSpecification: {
      "@type": "UnitPriceSpecification",
      price: "0.01",
      priceCurrency: "USD",
      unitText: "per call",
    },
    description:
      "One-time USD credit pack (non-recurring), spent per call at $0.01/call. See /pricing.",
    availability: "https://schema.org/InStock",
  },
};

// Secondary - the infrastructure the intelligence product runs on, also sold
// directly.
const RPC_PRODUCT_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Satelink RPC Gateway",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Any (HTTP API)",
  url: "https://rpc.satelink.network",
  description:
    "Multi-chain JSON-RPC gateway (Polygon, Ethereum, Arbitrum, Base) metered at a flat $0.00003 USDT per call from prepaid USDT credits, or $0.10 = 1,000 calls via x402 (USDC on Base). No free RPC tier.",
  offers: {
    "@type": "Offer",
    price: "0.00003",
    priceCurrency: "USD",
    description: "Flat metered rate per RPC call, paid from prepaid USDT credits (Polygon). Card/UPI plans and packs pay for Trading Intelligence only.",
  },
};

// Runs before paint to avoid a flash of the wrong theme (same logic as the
// approved static page's initTheme()).
const THEME_INIT = `(function(){try{var s=localStorage.getItem('satelink-theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.setAttribute('data-theme',s||(d?'dark':'light'));}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${manrope.variable} ${ibmPlexMono.variable}`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_JSON_LD) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(INTELLIGENCE_PRODUCT_JSON_LD) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(RPC_PRODUCT_JSON_LD) }}
        />
        <link
          rel="alternate"
          type="application/rss+xml"
          title="Satelink Changelog"
          href="https://satelink.network/feed.xml"
        />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
