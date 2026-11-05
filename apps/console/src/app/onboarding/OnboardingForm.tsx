"use client";

import { usd } from "@/lib/preview-shared";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SimulationBadge } from "@/components/preview/SimulationBadge";

const TYPES = [
  { v: "human", label: "Person", hint: "Get things done by asking" },
  { v: "developer", label: "Developer", hint: "Use the API from your code" },
  { v: "agent", label: "Agent builder", hint: "Let your AI agents procure services" },
] as const;
const COUNTRIES = [{ v: "IN", label: "India", currency: "INR" }, { v: "US", label: "United States", currency: "USD" }, { v: "OTHER", label: "Other", currency: "USD" }];

export function OnboardingForm() {
  const router = useRouter();
  const [type, setType] = useState<(typeof TYPES)[number]["v"]>("human");
  const [country, setCountry] = useState("IN");
  const [currency, setCurrency] = useState("INR");
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const [credit, setCredit] = useState<string | null>(null);
  // Disabled until hydrated: a click before React attaches handlers must not submit the form natively.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("saving");
    const r = await fetch("/api/console/tasks/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actor_type: type === "developer" ? "developer" : type === "agent" ? "agent" : "human" }) });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.onboarding) { setState("error"); return; }
    // Display preferences only (this browser); money is always USD in the preview.
    document.cookie = `slc_country=${country}; Path=/; Max-Age=31536000; SameSite=Lax`;
    document.cookie = `slc_currency=${currency}; Path=/; Max-Age=31536000; SameSite=Lax`;
    setCredit(j.onboarding.available_usd);
    setState("idle");
  };

  if (credit !== null) {
    return (
      <section className="space-y-3 rounded-md border border-sl-border bg-sl-surface p-4" data-testid="onboarding-done">
        <div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-semibold">You&apos;re set</h2><SimulationBadge /></div>
        <p>Your preview account has <strong className="tnum" data-testid="onboarding-credit">{usd(credit)}</strong> of promotional demo credit (simulated — it can only pay Satelink&apos;s own fees, and nothing is charged).</p>
        <button type="button" onClick={() => router.push("/assistant")} className="h-10 rounded-md bg-sl-accent px-4 font-medium text-sl-accent-ink hover:bg-sl-accent-strong" data-testid="onboarding-continue">Open the assistant</button>
      </section>
    );
  }

  const field = "h-10 w-full rounded-md border border-sl-border-strong bg-sl-surface px-3 text-sl-text focus:border-sl-accent focus:outline-none focus:ring-2 focus:ring-sl-accent/30";
  return (
    <form onSubmit={submit} className="space-y-5" data-testid="onboarding-form">
      <fieldset className="space-y-2">
        <legend className="mb-1 font-medium">How will you use Satelink?</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {TYPES.map((t) => (
            <label key={t.v} className={`cursor-pointer rounded-md border p-3 ${type === t.v ? "border-sl-accent bg-sl-accent/10" : "border-sl-border bg-sl-surface"} focus-within:ring-2 focus-within:ring-sl-accent/40`}>
              <input type="radio" name="type" value={t.v} checked={type === t.v} onChange={() => setType(t.v)} className="sr-only" />
              <span className="block font-medium">{t.label}</span>
              <span className="block text-[12px] text-sl-text-muted">{t.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1"><span className="font-medium">Country</span>
          <select className={field} value={country} onChange={(e) => { setCountry(e.target.value); setCurrency(COUNTRIES.find((c) => c.v === e.target.value)?.currency || "USD"); }}>
            {COUNTRIES.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
          </select>
        </label>
        <label className="block space-y-1"><span className="font-medium">Display currency</span>
          <select className={field} value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="INR">INR</option><option value="USD">USD</option>
          </select>
        </label>
      </div>
      {currency === "INR" && <p className="text-[12px] text-sl-text-muted" data-testid="currency-note">Prices are shown in USD in the preview. INR display needs an approved exchange-rate source and is not available yet.</p>}
      <section className="space-y-2 rounded-md border border-sl-border bg-sl-surface p-3 text-[13px]">
        <h2 className="font-medium">How paying works</h2>
        <p className="text-sl-text-muted">Pay-per-use, no subscription. You see a quote — the merchant&apos;s price and Satelink&apos;s fee — and nothing happens until you approve it. Merchants are paid by you directly at their checkout; Satelink credits only ever pay Satelink&apos;s own fee.</p>
      </section>
      <section className="space-y-2 rounded-md border border-sl-warn/50 bg-sl-warn/10 p-3 text-[13px]">
        <div className="flex flex-wrap items-center gap-2"><h2 className="font-medium">This is a preview</h2><SimulationBadge compact /></div>
        <p>Everything is simulated: orders go to a mock store, no money moves, nothing is charged. Fees shown are proposals, not approved prices. You get $1.00 of promotional demo credit to try it.</p>
      </section>
      {state === "error" && <p role="alert">Couldn&apos;t finish setup. Check that the preview API is running and try again.</p>}
      <button type="submit" disabled={!ready || state === "saving"} className="h-11 w-full rounded-md bg-sl-accent font-medium text-sl-accent-ink hover:bg-sl-accent-strong disabled:opacity-60" data-testid="onboarding-submit">
        {state === "saving" ? "Setting up…" : "Start with $1.00 demo credit (simulated)"}
      </button>
    </form>
  );
}
