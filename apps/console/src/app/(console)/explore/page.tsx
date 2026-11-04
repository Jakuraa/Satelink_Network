import type { Metadata } from "next";
import { Badge, Empty, ErrorNote, PageHeader } from "@/components/ui";
import { requirePreview, taskApi, type Capability } from "@/lib/preview";

export const metadata: Metadata = { title: "Explore · Satelink" };
export const dynamic = "force-dynamic";

const STATUS: Record<Capability["release_status"], { label: string; tone: "good" | "machine" | "warn" | "neutral" }> = {
  LIVE: { label: "Live", tone: "good" }, PREVIEW: { label: "Preview", tone: "machine" }, SIMULATED: { label: "Simulated", tone: "warn" }, COMING_SOON: { label: "Coming soon", tone: "neutral" },
};
const FEE: Record<string, string> = {
  procurement_10pct_min_2000: "10% of merchant amount (min $0.002)", inference_markup_20pct: "Model cost + 20%",
  strategy_eval_flat_100000: "$0.10 per evaluation", paper_sim_flat_50000: "$0.05 per simulated order",
};

export default async function ExplorePage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  requirePreview();
  const { q = "", status = "" } = await searchParams;
  const qs = new URLSearchParams({ q: q.slice(0, 200), ...(status && STATUS[status as Capability["release_status"]] ? { status } : {}) });
  const r = await taskApi<{ capabilities: Capability[] }>(`/capabilities?${qs}`);
  const input = "h-9 rounded-md border border-sl-border-strong bg-sl-surface px-2.5 text-[13px] text-sl-text focus:border-sl-accent focus:outline-none focus:ring-2 focus:ring-sl-accent/30";
  return (
    <>
      <PageHeader title="Explore" lede="Everything the assistant can do — straight from the capability registry." />
      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <label htmlFor="q" className="sr-only">Search capabilities</label>
        <input id="q" name="q" defaultValue={q} placeholder="Search capabilities" className={`${input} min-w-0 flex-1`} />
        <label htmlFor="status" className="sr-only">Status</label>
        <select id="status" name="status" defaultValue={status} className={input}>
          <option value="">All statuses</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button className="h-9 rounded-md border border-sl-border px-3 text-[13px] font-medium hover:border-sl-accent">Search</button>
      </form>
      {!r.ok ? <ErrorNote what="the capability catalogue" /> : r.data.capabilities.length === 0 ? (
        <Empty title="Nothing matches" body="Try another search or clear the status filter." />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="capability-list">
          {r.data.capabilities.map((c) => (
            <li key={c.id} className="flex flex-col gap-2 rounded-md border border-sl-border bg-sl-surface p-3" data-testid="capability-card">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-medium text-sl-text">{c.name}</h2>
                <Badge tone={STATUS[c.release_status].tone}>{STATUS[c.release_status].label}</Badge>
              </div>
              <p className="text-[13px] text-sl-text-muted">{c.description}</p>
              <dl className="mt-auto space-y-0.5 text-[12px] text-sl-text-muted">
                <div><dt className="inline">Providers: </dt><dd className="inline text-sl-text">{c.providers.map((p) => p.name).join(", ")}</dd></div>
                <div><dt className="inline">Satelink fee: </dt><dd className="inline text-sl-text">{FEE[c.fee_policy_id] || c.fee_policy_id} — PROPOSED — NOT APPROVED</dd></div>
                <div><dt className="inline">Who pays the merchant: </dt><dd className="inline text-sl-text">{c.price_model.kind === "merchant_price" ? "you, directly at the merchant's checkout" : "no merchant — Satelink service"}</dd></div>
                <div><dt className="inline">Sign-in needed: </dt><dd className="inline text-sl-text">{c.credential_requirements.length ? c.credential_requirements.join(", ") : "Satelink account only"}</dd></div>
              </dl>
              {c.disclaimer && <p className="text-[12px] text-sl-text-subtle">{c.disclaimer}</p>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
