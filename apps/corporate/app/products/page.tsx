// Products (Phase 7) — what Jakuraa ships today, linking to satelink.network. No investment,
// return or partnership claims (claims lint, public tier).
import type { Metadata } from "next";
import { company } from "@/content/company";
import { Container, PageHero, SectionHeading } from "@/components/Page";
import DISCLAIMERS from "@/content/disclaimers.json";

export const metadata: Metadata = {
  title: "Products",
  description: `Products of ${company.legalName}: Satelink Trading AI, the flagship AI trading operating system, and the Satelink machine-commerce rails.`,
};

const STATUS = "Paper trading in controlled beta. Live execution is not yet available.";

const FLAGSHIP = {
  name: "Satelink Trading AI",
  href: "https://satelink.network/trading-agent",
  line: "An AI trading operating system for people, AI agents and machines. Reason, validate, score, authorize, execute, learn.",
  points: [
    "AI agents read markets and propose; they cannot place orders, see broker keys or change limits.",
    "Deterministic engines validate strategies and score each decision GO, WAIT or REJECT. A failed hard gate always wins.",
    "Nothing executes unless the risk engine and a mandate you signed allow it. Your money stays at your broker; withdrawals are never enabled.",
    "One core, three interfaces: web for people, API and MCP for AI agents and machines.",
  ],
};

const RAILS = [
  { name: "Machine Commerce", href: "https://satelink.network/products/machine-commerce", line: "Software agents discover a priced API, pay for it without a human, and settle on-chain." },
  { name: "x402 Machine Payments", href: "https://satelink.network/products/x402", line: "HTTP-native, keyless pay-per-call payments in USDC on Base." },
  { name: "RPC Infrastructure", href: "https://satelink.network/products/rpc", line: "Metered Polygon JSON-RPC at a flat per-call rate." },
  { name: "API Metering", href: "https://satelink.network/products/metering", line: "Usage, caps and receipts per agent key." },
];

export default function ProductsPage() {
  return (
    <>
      <PageHero
        eyebrow="Products"
        title="Satelink, built by Jakuraa."
        lede={<p>{company.legalName} builds and operates Satelink. Its flagship product is Satelink Trading AI.</p>}
      />

      <section aria-labelledby="flagship" className="border-t border-stone-1 py-20">
        <Container>
          <SectionHeading id="flagship" title={FLAGSHIP.name} lede={FLAGSHIP.line} />
          <p className="mt-4 inline-block rounded bg-amber-ink/10 px-2.5 py-1 font-mono text-xs font-semibold uppercase text-amber-ink">{STATUS}</p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {FLAGSHIP.points.map((p) => (
              <li key={p} className="rounded-2xl border border-stone-1 bg-ivory p-6 text-sm leading-relaxed text-stone-4">{p}</li>
            ))}
          </ul>
          <a href={FLAGSHIP.href} className="mt-8 inline-flex items-center rounded-full bg-ink px-7 py-3.5 text-sm font-medium text-ivory hover:bg-stone-4">
            Visit Satelink Trading AI on satelink.network
          </a>
          <p className="mt-3 text-sm text-stone-4">
            <a href="https://satelink.network/contact-sales?interest=beta" className="underline">Request beta access</a>
          </p>
        </Container>
      </section>

      <section aria-labelledby="rails" className="border-t border-stone-1 py-20 bg-ivory-2/40">
        <Container>
          <SectionHeading id="rails" title="Machine-commerce rails" lede="The payment and data infrastructure Satelink runs for software that pays software." />
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {RAILS.map((r) => (
              <a key={r.name} href={r.href} className="block rounded-2xl border border-stone-1 bg-ivory p-6 hover:border-ink">
                <h3 className="font-serif text-xl text-ink">{r.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-4">{r.line}</p>
                <span className="mt-4 inline-block font-mono text-xs text-green">satelink.network →</span>
              </a>
            ))}
          </div>
        </Container>
      </section>

      <section className="border-t border-stone-1 py-12">
        <Container>
          <p className="max-w-3xl text-xs leading-relaxed text-stone-4">
            {DISCLAIMERS.notAdvice} {DISCLAIMERS.independence}
          </p>
        </Container>
      </section>
    </>
  );
}
