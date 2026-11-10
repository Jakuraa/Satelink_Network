// Satelink AI Assistance — what the Release A preview is, shown with real screenshots from its automated browser tests.
// Capabilities come from the generated registry file; nothing here is hand-typed from memory. No prices: fees are proposed.
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { buildMetadata, jsonLdScript, webPageLd } from "@satelink/seo";
import { SITES } from "@satelink/content";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import PREVIEW from "@/content/preview-capabilities.generated.json";

const TITLE = "Satelink AI Assistance preview — simulated, no charges";
const DESCRIPTION = "Describe an outcome; Satelink plans it, quotes it and acts only after you approve, then issues a receipt. A local preview for people, developers, agents and machines. Everything is simulated.";
export const metadata: Metadata = buildMetadata({ title: TITLE, description: DESCRIPTION, path: "/preview" });

const JOURNEYS = [
  { who: "People", title: "Shopping", img: "s1-task.png", alt: "A completed simulated purchase task with its plan, quote and timeline", body: "Ask for a digital product. See the plan and the quote, approve it, and get a verified receipt. Supplier: Demo Digital Store (MOCK)." },
  { who: "People", title: "Food", img: "s2-quote.png", alt: "A simulated food order quote awaiting approval", body: "Connect a service with your consent, order from a menu, approve the exact cart, and revoke access any time. Supplier: Food Delivery (MOCK — not connected to Swiggy)." },
  { who: "People", title: "Trading AI, one workflow among the others", img: "s3-evaluation.png", alt: "A simulated strategy evaluation with a rule-by-rule risk decision", body: "Describe a strategy; it is evaluated out of sample on a synthetic dataset; fixed rules decide GO, WAIT or REJECT; only GO can be paper traded. SIMULATED_PAPER_EXECUTION: NOT_ACTUAL_RETURNS. Not investment advice." },
  { who: "Developers", title: "Service procurement over an API", img: "s4-keys.png", alt: "The developer hub showing a scoped key with its usage", body: "Create a scoped, revocable key, ask for a quote, approve it with an idempotency key, read the result and the receipt. Supplier: Demo Data API (MOCK)." },
  { who: "AI agents", title: "Agents ask; people approve", img: "s5-approval.png", alt: "A task where an AI agent has asked its owner to approve a quote", body: "An agent connects over MCP or A2A, discovers capabilities and gets quotes. It cannot approve spending: every purchase waits for a person in the console." },
  { who: "Machines", title: "Pay per call over HTTP 402", img: "s6-receipt.png", alt: "A simulated receipt for an x402 preview payment from a mock facilitator", body: "A machine receives machine-readable payment terms, retries with a mock-signed payment on a testnet id, and gets the result and a receipt. Nothing is settled." },
];
const LABEL: Record<string, string> = { SIMULATED: "Simulated", PREVIEW: "Preview", COMING_SOON: "Coming soon" };

export default function PreviewPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(webPageLd({ url: `${SITES.satelink.origin}/preview`, name: TITLE, description: DESCRIPTION })) }} />
      <section className="border-b border-sl-border">
        <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 md:py-20">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-sl-accent">Satelink AI Assistance</p>
          <h1 className="max-w-4xl font-sl-display text-balance font-normal leading-[1.05] tracking-[-0.02em] text-sl-text" style={{ fontSize: "var(--sl-display-1)" }}>Preview — simulated, no charges.</h1>
          <p className="mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-sl-text-muted">Describe an outcome. Satelink picks a model, finds a capability, plans it, quotes it and acts only after you approve, then issues a receipt. The same engine serves people, developers, AI agents and machines.</p>
          <div className="mt-6 flex flex-wrap gap-2" data-testid="preview-status">
            <Badge variant="planned">{PREVIEW.simulation_label}</Badge>
            <Badge variant="planned">{PREVIEW.availability}</Badge>
          </div>
          <ul className="mt-6 max-w-2xl list-inside list-disc space-y-1 text-sm leading-relaxed text-sl-text-muted">
            <li>Every supplier below is a labelled local mock. No real order is placed and no money moves.</li>
            <li>Intended pricing is pay per use, with no mandatory subscription. Fees are {PREVIEW.fees_status}, so none are published here.</li>
            <li>Separate from this preview, the <Link className="underline" href="/products/rpc">metered Polygon RPC</Link> and <Link className="underline" href="/products/x402">x402 payments</Link> are running services.</li>
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6">
        <SectionHeader eyebrow="Six journeys, one engine" title="Real screenshots from the preview's automated tests" lede="Each journey is exercised end to end by browser tests. Screenshots are unedited; the data in them is test data." />
        <div className="mt-10 grid gap-6 md:grid-cols-2" data-testid="journeys">
          {JOURNEYS.map((j) => (
            <Card key={j.title} className="flex h-full flex-col">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sl-text-subtle">{j.who}</p>
              <h2 className="mt-1 font-semibold text-sl-text">{j.title}</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-sl-text-muted">{j.body}</p>
              <Image src={`/product/preview/${j.img}`} alt={j.alt} width={1440} height={900} sizes="(max-width: 768px) 100vw, 560px" className="mt-4 h-64 w-full rounded-md border border-sl-border object-cover object-top" />
            </Card>
          ))}
        </div>
      </section>

      <section className="border-t border-sl-border bg-sl-bg-raised">
        <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6">
          <SectionHeader eyebrow="Capability registry" title="What the preview knows about" lede="Generated from the registry the product itself reads." />
          <ul className="mt-8 grid gap-3 md:grid-cols-2" data-testid="capabilities">
            {PREVIEW.capabilities.map((c) => (
              <li key={c.id} className="rounded-md border border-sl-border bg-sl-surface p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-sl-text">{c.name}</span>
                  <Badge variant="planned">{LABEL[c.release_status] ?? c.release_status}</Badge>
                </div>
                <p className="mt-1 leading-relaxed text-sl-text-muted">{c.description}</p>
                {c.providers.length > 0 && <p className="mt-1 text-xs text-sl-text-subtle">Provider: {c.providers.join(", ")}</p>}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-sl-text-muted">Machine-readable: <a className="underline" href="/.well-known/satelink-capabilities.json">/.well-known/satelink-capabilities.json</a> · <a className="underline" href="/llms.txt">llms.txt</a></p>
        </div>
      </section>
    </>
  );
}
