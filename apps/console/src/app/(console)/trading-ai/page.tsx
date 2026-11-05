import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Empty, ErrorNote, PageHeader, Panel } from "@/components/ui";
import { SimulationBadge } from "@/components/preview/SimulationBadge";
import { requirePreview, STATE_LABEL, stateTone, taskApi, TRADING_LABEL, type Task } from "@/lib/preview";

export const metadata: Metadata = { title: "Trading AI · Satelink" };
export const dynamic = "force-dynamic";

const PROMPTS = [
  "Backtest an ETH breakout strategy, 20 day channel",
  "Backtest BTC 10/30 moving average crossover",
];

// Trading AI is one workflow on the same engine: describe → walk-forward evaluation → deterministic risk decision →
// paper trade (GO only). Synthetic recorded data; no live broker execution.
export default async function TradingAiPage() {
  requirePreview();
  const r = await taskApi<{ tasks: Task[] }>("/tasks?limit=100");
  const trading = r.ok ? r.data.tasks.filter((t) => t.plan?.steps?.some((s) => s.capability_id.startsWith("trading."))) : [];
  return (
    <>
      <PageHeader title="Trading AI" lede="Describe a strategy in plain words. Satelink evaluates it out of sample, applies fixed risk rules, and can paper-trade it." actions={<SimulationBadge />} />
      <p className="mb-4 rounded-md border border-sl-market/60 bg-sl-market/10 px-3 py-2 text-[13px] font-semibold" data-testid="trading-label">{TRADING_LABEL} · Education and simulation only — not investment advice. Live broker execution is not available.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Start an evaluation">
          <ul className="space-y-2 text-[13px]">
            {PROMPTS.map((p) => (
              <li key={p}><Link href={`/assistant?prompt=${encodeURIComponent(p)}`} className="block rounded-md border border-sl-border px-3 py-2 hover:border-sl-accent">{p}</Link></li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] text-sl-text-subtle">Data: synthetic recorded dataset (labelled on every result). Paper trades fill on an internal simulator.</p>
        </Panel>
        <Panel title="How a result is decided">
          <ol className="list-inside list-decimal space-y-1 text-[13px] text-sl-text-muted">
            <li>Walk-forward evaluation with fees, spread and slippage; a look-ahead check.</li>
            <li>Deterministic risk rules produce GO, WAIT or REJECT with a rule-by-rule trace.</li>
            <li>Only GO can be paper-traded, after you approve the quote.</li>
          </ol>
        </Panel>
      </div>
      <div className="mt-4">
        <Panel title="Your trading tasks">
          {!r.ok ? <ErrorNote what="your trading tasks" /> : trading.length === 0 ? (
            <Empty title="No evaluations yet" body="Start with one of the strategies above or describe your own in the assistant." cta={{ label: "Open the assistant", href: "/assistant" }} />
          ) : (
            <ul className="divide-y divide-sl-border text-[13px]" data-testid="trading-tasks">
              {trading.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 py-1.5">
                  <Link href={`/tasks/${t.id}`} className="min-w-0 flex-1 truncate text-sl-text hover:underline">{t.intent}</Link>
                  <span className="flex items-center gap-2">
                    {t.trading?.risk?.decision && <Badge tone={t.trading.risk.decision === "GO" ? "good" : "warn"}>{t.trading.risk.decision}</Badge>}
                    <Badge tone={stateTone(t.state)}>{STATE_LABEL[t.state] || t.state}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
