// Client component by import (used only from AssistantChat / TaskLive).
import { useEffect, useRef, useState } from "react";
import { usd, type Quote, type Task } from "@/lib/preview-shared";
import { SimulationBadge } from "./SimulationBadge";

const btn = "inline-flex h-9 items-center justify-center rounded-md px-3 text-[13px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sl-accent/45 disabled:opacity-60";

// The clock is read only after mount: server and browser render the same deterministic text first (no hydration
// mismatch), then the live countdown takes over.
function useCountdown(iso: string) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, new Date(iso).getTime() - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [iso]);
  if (left === null) return { expired: false, text: `at ${new Date(iso).toISOString().slice(11, 16)} UTC` };
  const m = Math.floor(left / 60000); const s = Math.floor((left % 60000) / 1000);
  return { expired: left === 0, text: `in ${m}:${String(s).padStart(2, "0")}` };
}

export function QuoteCard({ quote, onApprove, onCancel, busy }: { quote: Quote; onApprove?: () => void; onCancel?: () => void; busy?: boolean }) {
  const cd = useCountdown(quote.expires_at);
  const hasMerchant = quote.lines.some((l) => l.supplier_cost_paid_from === "merchant_checkout");
  return (
    <section aria-label="Quote" data-testid="quote-card" className="rounded-md border border-sl-border bg-sl-surface">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-sl-border px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-sl-text-muted">Quote · v{quote.version}</h2>
        <SimulationBadge />
      </header>
      <div className="space-y-3 p-3">
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Quote lines">
          <table className="tnum w-full text-left text-[13px]">
            <thead className="text-[11px] uppercase tracking-wider text-sl-text-subtle">
              <tr><th scope="col" className="py-1 pr-2 font-medium">Item</th><th scope="col" className="py-1 pr-2 text-right font-medium">Supplier</th><th scope="col" className="py-1 pr-2 text-right font-medium">Satelink fee</th><th scope="col" className="py-1 text-right font-medium">Tax</th></tr>
            </thead>
            <tbody>
              {quote.lines.map((l) => (
                <tr key={l.capability_id + l.description} className="border-t border-sl-border/60 align-top">
                  <td className="py-1.5 pr-2 text-sl-text">{l.description}<div className="text-[11px] text-sl-text-subtle">{l.supplier_cost_paid_from === "merchant_checkout" ? "Paid by you at the merchant's checkout (simulated)" : "Paid from Satelink credits (simulated)"}</div></td>
                  <td className="py-1.5 pr-2 text-right">{usd(l.supplier_cost_usd)}</td>
                  <td className="py-1.5 pr-2 text-right">{usd(l.satelink_fee_usd)}</td>
                  <td className="py-1.5 text-right">{usd(l.tax_usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className={`grid grid-cols-1 gap-2 text-[13px] ${hasMerchant ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          {hasMerchant && <div className="rounded border border-sl-border px-2 py-1.5"><dt className="text-[11px] uppercase tracking-wider text-sl-text-subtle">Merchant total (you pay the merchant)</dt><dd className="tnum font-semibold" data-testid="merchant-total">{usd(quote.merchant_paid_by_user_usd)}</dd></div>}
          <div className="rounded border border-sl-border px-2 py-1.5"><dt className="text-[11px] uppercase tracking-wider text-sl-text-subtle">From Satelink credits</dt><dd className="tnum font-semibold" data-testid="credit-charge">{usd(quote.credit_charge_usd)}</dd></div>
          <div className="rounded border border-sl-border px-2 py-1.5"><dt className="text-[11px] uppercase tracking-wider text-sl-text-subtle">Total</dt><dd className="tnum font-semibold">{usd(quote.total_usd)} {quote.currency}</dd></div>
        </dl>
        <p className="text-[12px] text-sl-text-muted"><strong className="font-semibold text-sl-text">Fees {quote.fee_policy_status}.</strong> {quote.disclosure.replace(/ ?Fees are PROPOSED — NOT APPROVED\./, "")}</p>
        {(onApprove || cd.expired) && <p className="text-[12px] text-sl-text-subtle" aria-live="polite">{cd.expired ? "This quote has expired." : `Quote expires ${cd.text}.`}</p>}
        {(onApprove || onCancel) && (
          <div className="flex flex-wrap gap-2">
            {onApprove && <ApproveButton quote={quote} disabled={busy || cd.expired} onConfirm={onApprove} />}
            {onCancel && <button type="button" onClick={onCancel} disabled={busy} className={`${btn} border border-sl-border text-sl-text hover:bg-sl-surface-hover`}>Cancel task</button>}
          </div>
        )}
      </div>
    </section>
  );
}

function ApproveButton({ quote, disabled, onConfirm }: { quote: Quote; disabled?: boolean; onConfirm: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" disabled={disabled} onClick={() => ref.current?.showModal()} className={`${btn} bg-sl-accent text-sl-accent-ink hover:bg-sl-accent-strong`} data-testid="approve-open">Review &amp; approve</button>
      <dialog ref={ref} aria-labelledby="approve-title" className="m-auto w-[min(92vw,30rem)] rounded-md border border-sl-border bg-sl-surface p-0 text-sl-text backdrop:bg-black/60" data-testid="approve-dialog">
        <form method="dialog" className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <h2 id="approve-title" className="text-base font-semibold">Approve this simulated purchase?</h2>
            <SimulationBadge compact />
          </div>
          <ul className="space-y-1.5 text-[13px]">
            {quote.lines.filter((l) => l.capability_id !== "ai.model.inference").map((l) => <li key={l.description}><span className="text-sl-text-muted">Exact action:</span> {l.description}</li>)}
            <li><span className="text-sl-text-muted">Merchant total:</span> <strong className="tnum">{usd(quote.merchant_paid_by_user_usd)}</strong> — paid by you directly to the merchant at its checkout (simulated)</li>
            <li><span className="text-sl-text-muted">Satelink fee:</span> <strong className="tnum">{usd(quote.credit_charge_usd)}</strong> — from Satelink credits (simulated); charged only after merchant confirmation</li>
            <li className="text-sl-text-muted">Nothing is charged in the preview. No real order is placed. Fees are {quote.fee_policy_status}.</li>
          </ul>
          <div className="flex justify-end gap-2 pt-1">
            <button value="cancel" className={`${btn} border border-sl-border hover:bg-sl-surface-hover`} autoFocus>Back</button>
            <button value="ok" className={`${btn} bg-sl-accent text-sl-accent-ink hover:bg-sl-accent-strong`} data-testid="approve-confirm" onClick={(e) => { e.preventDefault(); ref.current?.close(); onConfirm(); }}>Approve (simulated)</button>
          </div>
        </form>
      </dialog>
    </>
  );
}

export function PlanPanel({ task }: { task: Task }) {
  if (!task.plan?.steps?.length) return null;
  return (
    <section aria-label="Plan" data-testid="plan-panel" className="rounded-md border border-sl-border bg-sl-surface">
      <header className="flex items-center justify-between border-b border-sl-border px-3 py-2"><h2 className="text-xs font-semibold uppercase tracking-wider text-sl-text-muted">Plan</h2>{task.plan.model && <span className="text-[11px] text-sl-text-subtle" data-testid="plan-model">Model: {task.plan.model.served_by}</span>}</header>
      <ol className="space-y-2 p-3 text-[13px]">
        {task.plan.steps.map((s) => (
          <li key={s.step_no} className="rounded border border-sl-border px-2.5 py-2">
            <p className="font-medium text-sl-text">{s.step_no}. {s.capability_name || s.capability_id}</p>
            <dl className="mt-1 grid grid-cols-1 gap-x-4 gap-y-0.5 text-[12px] text-sl-text-muted sm:grid-cols-2">
              {s.provider_name && <div><dt className="inline">Provider: </dt><dd className="inline text-sl-text">{s.provider_name}</dd></div>}
              {s.offer && <div><dt className="inline">Item: </dt><dd className="inline text-sl-text">{s.offer.title} · {usd(s.offer.price_usd)}</dd></div>}
              {s.permission && <div><dt className="inline">Permission: </dt><dd className="inline text-sl-text">{s.permission}</dd></div>}
              {s.success_condition && <div><dt className="inline">Success when: </dt><dd className="inline text-sl-text">{s.success_condition.replace(/_/g, " ")}</dd></div>}
            </dl>
          </li>
        ))}
      </ol>
    </section>
  );
}
