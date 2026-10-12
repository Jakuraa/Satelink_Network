"use client";
// Trading AI checkout (2026-10-12 directive, Wave 1.8): plan → payment method → review
// (invoice preview, merchant CIN/GSTIN, refund policy) → pay → receipt.
// Every price comes from the API's plan config and every amount from a server quote —
// nothing is computed or hard-coded here. Checkout COMPLETION (creating the payable
// invoice) is disabled until the refund policy is published; the API refuses it too.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { Choice, FlowCard, Stepper, field, primaryBtn, secondaryBtn } from "@/components/v2/Flow";
import { MerchantBlock, RefundPolicyNotice } from "./MerchantBlock";
import { METHOD_LABEL, STATUS_LABEL, type Intent, type IntentStatus, type Merchant, type Method, type PlansPayload, type Quote, type RefundPolicy } from "@/lib/payments-shared";

const STEPS = ["Plan", "Payment method", "Review", "Pay", "Receipt"];
const TX_RE = /^0x[0-9a-fA-F]{64}$/;
const POLL_MS = 8_000;

function priceLine(p: PlansPayload["plans"][number]) {
  const usd = p.price?.USD?.display ?? p.price?.USDT?.display;
  if (!usd) return "Free";
  const intro = p.introPrice?.USD?.display;
  return intro ? `$${intro} first month, then $${usd}/month` : `$${usd}/month`;
}

const ERRORS: Record<string, string> = {
  refund_policy_unpublished: "Checkout can't be completed until the refund policy is published.",
  unsupported: "This plan has no price in that currency yet.",
  method_unavailable: "That payment method isn't switched on.",
  not_configured: "That payment method isn't configured yet.",
  no_matching_transfer: "That transaction doesn't send this invoice's token to this invoice's address.",
  not_found_or_pending: "That transaction isn't on-chain yet. Wait a moment and try again.",
  reverted: "That transaction failed on-chain.",
  tx_already_used: "That transaction already paid a different invoice.",
  chain_unavailable: "The network can't be checked right now. Try again shortly.",
};
const errText = (code?: string, fallback = "Something went wrong. Try again.") => (code && ERRORS[code]) || fallback;

export function CheckoutFlow({ plans, methods, merchant, refundPolicy, testMode }: {
  plans: PlansPayload; methods: Method[]; merchant: Merchant; refundPolicy: RefundPolicy; testMode: boolean;
}) {
  const paid = plans.plans.filter((p) => p.price);
  const [step, setStep] = useState(0);
  const [planId, setPlanId] = useState("");
  const [method, setMethod] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [status, setStatus] = useState<IntentStatus | null>(null);
  const [tx, setTx] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const policy = quote?.refundPolicy ?? refundPolicy;
  const canComplete = policy.completionAllowed;
  const plan = useMemo(() => paid.find((p) => p.id === planId), [paid, planId]);

  async function post<T>(path: string, body: unknown): Promise<{ ok: boolean; data?: T; error?: string; status: number }> {
    const r = await fetch(`/api/console/payments${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok && j?.ok, data: j?.data, error: j?.error, status: r.status };
  }

  async function review() {
    setBusy(true); setErr(null);
    const r = await post<Quote>("/checkout/quote", { planId, method });
    setBusy(false);
    if (!r.ok || !r.data) return setErr(errText(r.error, "The price couldn't be loaded."));
    setQuote(r.data); setStep(2);
  }

  async function complete() {
    if (!canComplete) return; // belt and braces — the button is disabled and the API refuses too
    setBusy(true); setErr(null);
    const r = await post<Intent>("/checkout/intents", { planId, method });
    setBusy(false);
    if (!r.ok || !r.data) return setErr(errText(r.error, "Checkout couldn't start."));
    if (r.data.checkoutUrl) { window.location.assign(r.data.checkoutUrl); return; } // hosted provider page
    setIntent(r.data); setStep(3);
  }

  async function submitTx() {
    if (!intent) return;
    setBusy(true); setErr(null); setNote(null);
    const r = await post<{ status: string; confirmations: number; confirmationsRequired: number }>(`/checkout/intents/${intent.canonicalRef}/onchain-tx`, { txHash: tx.trim() });
    setBusy(false);
    if (!r.ok || !r.data) return setErr(errText(r.error));
    setNote(r.data.status === "pending"
      ? `Found it — ${r.data.confirmations} of ${r.data.confirmationsRequired} confirmations. This page updates on its own; submit again any time.`
      : STATUS_LABEL[r.data.status] ?? r.data.status);
  }

  // live status poll while on the Pay step
  useEffect(() => {
    if (step !== 3 || !intent) return;
    let stop = false;
    const tick = async () => {
      const r = await fetch(`/api/console/payments/checkout/intents/${intent.canonicalRef}`, { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (stop || !j?.ok) return;
      setStatus(j.data);
      if (j.data.receiptReady) setStep(4);
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => { stop = true; clearInterval(id); };
  }, [step, intent]);

  return (
    <div className="mx-auto max-w-2xl">
      <Stepper steps={STEPS} current={step} />
      {(testMode || plans.note) && (
        <p role="note" className="mb-4 rounded-[var(--sl-radius)] border border-sl-border p-3 text-[13px] text-sl-text-muted">
          {plans.note ?? "Test mode."} {plans.billing.crypto && `Crypto: ${plans.billing.crypto}.`}
        </p>
      )}

      {step === 0 && (
        <FlowCard title="Choose a plan" lede="Prices are set by Satelink's plan configuration.">
          <fieldset className="space-y-2">
            <legend className="sr-only">Plan</legend>
            {paid.map((p) => (
              <Choice key={p.id} name="plan" value={p.id} checked={planId === p.id} onChange={setPlanId} title={`${p.name} — ${priceLine(p)}`}
                detail={`${p.limits.agentRunsPerDay} agent runs/day · ${p.limits.backtestsPerDay} backtests/day · ${p.limits.liveStrategies} live strategies`} />
            ))}
          </fieldset>
          <div className="mt-6 flex justify-end"><button type="button" className={primaryBtn} disabled={!planId} onClick={() => setStep(1)}>Continue</button></div>
        </FlowCard>
      )}

      {step === 1 && (
        <FlowCard title="How do you want to pay?" lede={plan ? `${plan.name} — ${priceLine(plan)}` : undefined}>
          {methods.length === 0 ? (
            <p className="text-sl-text-muted">No payment method is switched on for this deployment yet.</p>
          ) : (
            <fieldset className="space-y-2">
              <legend className="sr-only">Payment method</legend>
              {methods.map((m) => (
                <Choice key={m.id} name="method" value={m.id} checked={method === m.id} onChange={setMethod} title={METHOD_LABEL[m.id]?.title ?? m.id} detail={METHOD_LABEL[m.id]?.detail} />
              ))}
            </fieldset>
          )}
          {err && <p role="alert" className="mt-3 text-sl-down">{err}</p>}
          <div className="mt-6 flex justify-between">
            <button type="button" className={secondaryBtn} onClick={() => setStep(0)}>Back</button>
            <button type="button" className={primaryBtn} disabled={!method || busy} onClick={review}>{busy ? "Loading…" : "Review"}</button>
          </div>
        </FlowCard>
      )}

      {step === 2 && quote && (
        <FlowCard title="Review your invoice" lede="Nothing is charged until you pay.">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[15px]">
            <dt className="text-sl-text-muted">Plan</dt><dd className="text-sl-text">{plan?.name}</dd>
            <dt className="text-sl-text-muted">Amount</dt><dd className="font-mono text-sl-text">{quote.amount.display} {quote.amount.currency}{quote.introApplied ? " (first-month price)" : ""}</dd>
            {quote.periodDays && (<><dt className="text-sl-text-muted">Period</dt><dd className="text-sl-text">{quote.periodDays} days · prepaid, never auto-charged</dd></>)}
            <dt className="text-sl-text-muted">Method</dt><dd className="text-sl-text">{METHOD_LABEL[method]?.title}</dd>
          </dl>
          <div className="mt-5"><MerchantBlock merchant={quote.merchant} policy={policy} blocking={!canComplete} /></div>
          {err && <p role="alert" className="mt-3 text-sl-down">{err}</p>}
          <div className="mt-6 flex justify-between">
            <button type="button" className={secondaryBtn} onClick={() => setStep(1)}>Back</button>
            <button type="button" className={primaryBtn} disabled={busy || !canComplete} aria-describedby={!canComplete ? "complete-blocked" : undefined} onClick={complete}>
              {busy ? "Starting…" : method === "razorpay" || method === "payram_usdt" ? "Continue to payment" : "Get payment details"}
            </button>
          </div>
          {!canComplete && <p id="complete-blocked" className="mt-2 text-right text-[13px] text-sl-text-muted">Disabled: the refund policy isn't published yet.</p>}
        </FlowCard>
      )}

      {step === 3 && intent?.invoice && (
        <FlowCard title={`Send exactly ${intent.invoice.amountDisplay} ${intent.invoice.currency}`} lede={`On ${intent.invoice.network === "polygon" ? "Polygon" : "Base"} only (chain ${intent.invoice.chainId}). Other networks or tokens are not detected.`}>
          <div className="grid gap-5 sm:grid-cols-[auto_1fr]">
            <div className="justify-self-center rounded-[var(--sl-radius)] bg-white p-3" aria-hidden>
              <QRCodeSVG value={intent.invoice.uri} size={168} />
            </div>
            <dl className="grid grid-cols-[auto_1fr] content-start gap-x-4 gap-y-2 text-[14px]">
              <dt className="text-sl-text-muted">To</dt><dd className="break-all font-mono text-sl-text">{intent.invoice.payTo}</dd>
              <dt className="text-sl-text-muted">Amount</dt><dd className="font-mono text-sl-text">{intent.invoice.amountDisplay} {intent.invoice.currency}</dd>
              <dt className="text-sl-text-muted">Token</dt><dd className="break-all font-mono text-sl-text">{intent.invoice.token}</dd>
              <dt className="text-sl-text-muted">Network</dt><dd className="text-sl-text">{intent.invoice.network} ({intent.invoice.chainId})</dd>
              <dt className="text-sl-text-muted">Expires</dt><dd className="text-sl-text">{new Date(intent.invoice.expiresAt).toLocaleString()}</dd>
              <dt className="text-sl-text-muted">Status</dt>
              <dd className="text-sl-text" role="status" aria-live="polite">{status ? STATUS_LABEL[status.status] ?? status.status : "Waiting for payment"}</dd>
            </dl>
          </div>
          <label className="mt-5 block">
            <span className="mb-1 block text-[13px] text-sl-text-muted">After you pay, paste the transaction hash</span>
            <input className={`${field} font-mono`} value={tx} onChange={(e) => setTx(e.target.value)} placeholder="0x…" inputMode="text" autoComplete="off" spellCheck={false} />
          </label>
          {note && <p role="status" className="mt-3 text-sl-text-muted">{note}</p>}
          {err && <p role="alert" className="mt-3 text-sl-down">{err}</p>}
          <div className="mt-6 flex justify-end"><button type="button" className={primaryBtn} disabled={busy || !TX_RE.test(tx.trim())} onClick={submitTx}>{busy ? "Checking the chain…" : "I've paid — check"}</button></div>
          <div className="mt-5"><MerchantBlock merchant={intent.merchant} policy={status?.refundPolicy ?? policy} /></div>
        </FlowCard>
      )}

      {step === 4 && status && (
        <FlowCard title="Payment received" lede={STATUS_LABEL[status.status] ?? status.status}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[15px]">
            <dt className="text-sl-text-muted">Plan</dt><dd className="text-sl-text">{status.entitlement.planId}</dd>
            <dt className="text-sl-text-muted">Active until</dt><dd className="text-sl-text">{status.entitlement.periodEnd ? new Date(status.entitlement.periodEnd).toLocaleDateString() : "—"}</dd>
            <dt className="text-sl-text-muted">Paid</dt><dd className="font-mono text-sl-text">{status.amount.display} {status.amount.currency}</dd>
          </dl>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link className={primaryBtn} href={`/billing/receipts/${status.canonicalRef}`}>View receipt</Link>
            <Link className={secondaryBtn} href="/trading">Go to Trading AI</Link>
          </div>
          <div className="mt-5"><MerchantBlock merchant={status.merchant ?? merchant} policy={status.refundPolicy} /></div>
        </FlowCard>
      )}

      {step < 2 && <div className="mt-6"><RefundPolicyNotice policy={refundPolicy} blocking={!refundPolicy.completionAllowed} /></div>}
    </div>
  );
}
