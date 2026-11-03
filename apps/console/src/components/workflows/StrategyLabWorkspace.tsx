"use client";

import Link from "next/link";
import { useState } from "react";
import { FlaskConical, Loader2, PlayCircle, Sparkles } from "lucide-react";
import { Panel } from "@/components/ui";
import type { CompileResult, Run, Template } from "@/lib/workflows-shared";
import { RunResult, StatusBadge, WorkflowGraph, btnPrimary, btnSecondary, field } from "./parts";

const EXAMPLES = [
  "Buy bitcoin when the 20-day moving average crosses above the 50-day",
  "ETH breakout: buy on a new 30-day high, exit on a 15-day low, use 50% of capital",
  "A trend-following strategy for crypto",
  "Short BTC with 5x leverage when RSI is above 70",
];

function idemKey() {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return "lab_" + Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

async function post<T>(path: string, body: unknown): Promise<{ status: number; data: T }> {
  const res = await fetch(`/api/console/workflows/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: res.status, data: (await res.json().catch(() => ({ ok: false, error: "bad_response" }))) as T };
}

export function StrategyLabWorkspace({ template }: { template: Template | null }) {
  const [prompt, setPrompt] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [compiled, setCompiled] = useState<CompileResult | null>(null);
  const [busy, setBusy] = useState<"compile" | "run" | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // One idempotency key per compiled spec: a retry or double-click never creates a second run.
  const [runKey, setRunKey] = useState<string | null>(null);

  async function compile(nextAnswers = answers) {
    setBusy("compile"); setErr(null); setRun(null);
    const { status, data } = await post<CompileResult & { error?: string }>("strategy-lab/compile", { prompt, answers: nextAnswers });
    setBusy(null);
    if (status >= 500 || (!data.status && data.error)) { setErr("The Strategy Lab service is unavailable. Try again shortly."); return; }
    setCompiled(data);
    setRunKey(data.status === "compiled" ? idemKey() : null);
  }

  async function runBacktest() {
    if (!compiled?.spec) return;
    setBusy("run"); setErr(null);
    const { status, data } = await post<{ ok: boolean; run?: Run; error?: string; message?: string }>("workflows/runs", {
      template: "strategy_lab.backtest.v1", input: { spec: compiled.spec }, idempotency_key: runKey || idemKey(),
    });
    setBusy(null);
    if (status === 401) { setErr("Connect or create an API key to run backtests — runs are recorded against your account."); return; }
    if (!data.ok || !data.run) { setErr(data.message || data.error || "The backtest could not be started."); return; }
    setRun(data.run);
  }

  function answer(id: string, value: string) {
    const next = { ...answers, [id]: value };
    setAnswers(next);
    void compile(next);
  }

  const spec = compiled?.spec;
  const graphNodes = run?.graph.nodes || template?.nodes.map((n) => ({ ...n, status: n.id === "compile" && spec ? ("done" as const) : ("pending" as const) })) || [];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-4">
        <Panel title="Describe your strategy">
          <form onSubmit={(e) => { e.preventDefault(); setAnswers({}); void compile({}); }} className="space-y-3">
            <label htmlFor="lab-prompt" className="sr-only">Strategy description</label>
            <textarea
              id="lab-prompt" rows={3} maxLength={2000} value={prompt} onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Buy bitcoin when the 20-day moving average crosses above the 50-day"
              className={field}
            />
            <div className="flex flex-wrap items-center gap-2">
              <button type="submit" className={btnPrimary} disabled={prompt.trim().length < 3 || busy !== null}>
                {busy === "compile" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Sparkles aria-hidden className="size-4" />} Build strategy
              </button>
              <span className="text-xs text-sl-text-subtle">Try:</span>
              {EXAMPLES.map((x) => (
                <button key={x} type="button" onClick={() => { setPrompt(x); setCompiled(null); setRun(null); setAnswers({}); }}
                  className="rounded-full border border-sl-border px-2.5 py-0.5 text-[11px] text-sl-text-muted hover:border-sl-accent hover:text-sl-text">
                  {x.length > 42 ? x.slice(0, 40) + "…" : x}
                </button>
              ))}
            </div>
          </form>
        </Panel>

        {compiled?.status === "needs_clarification" && (
          <Panel title="A few questions first">
            <div className="space-y-4">
              {compiled.questions?.map((q) => (
                <fieldset key={q.id} className="space-y-2">
                  <legend className="text-sm text-sl-text">{q.text}</legend>
                  <div className="flex flex-wrap gap-2">
                    {q.options.map((o) => {
                      const value = typeof o === "string" ? o : o.value;
                      const label = typeof o === "string" ? o : o.label;
                      return (
                        <button key={value} type="button" onClick={() => answer(q.id, value)} disabled={busy !== null}
                          className={`${btnSecondary} h-auto py-1.5 text-left text-xs ${answers[q.id] === value ? "border-sl-accent" : ""}`}>{label}</button>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
          </Panel>
        )}

        {compiled?.status === "unsupported" && (
          <Panel title="This request can't be evaluated">
            <ul className="list-disc space-y-1 pl-5 text-sm text-sl-text">{compiled.reasons?.map((r) => <li key={r}>{r}</li>)}</ul>
            <p className="mt-3 text-xs text-sl-text-muted">Supported today: moving-average crossover and Donchian breakout, long-only, on Binance spot BTC/USDT and ETH/USDT daily bars.</p>
          </Panel>
        )}

        {spec && (
          <Panel title="Strategy spec" action={<span className="font-mono text-[11px] text-sl-text-subtle">{spec.id} · v{spec.version}</span>}>
            <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[9rem_1fr]">
              <dt className="text-sl-text-muted">Rule</dt><dd className="text-sl-text">{spec.name}</dd>
              <dt className="text-sl-text-muted">Parameters</dt><dd className="font-mono text-sl-text">{Object.entries(spec.params).map(([k, v]) => `${k}=${v}`).join("  ")}</dd>
              <dt className="text-sl-text-muted">Market</dt><dd className="text-sl-text">{spec.market.name} · {spec.market.venue} spot · {spec.timeframe} bars · {spec.direction.replace("_", " ")}</dd>
              <dt className="text-sl-text-muted">Position size</dt><dd className="text-sl-text">{spec.risk.allocation_pct}% of simulated capital, no leverage</dd>
              <dt className="text-sl-text-muted">Costs modelled</dt><dd className="text-sl-text">{spec.costs.fee_bps} bps fee · {spec.costs.half_spread_bps} bps half-spread · {spec.costs.slippage_bps} bps slippage</dd>
              <dt className="text-sl-text-muted">Evaluation</dt><dd className="text-sl-text">walk-forward, {spec.evaluation.windows} out-of-sample windows of {spec.evaluation.test_bars} days, data from {spec.evaluation.start}</dd>
              <dt className="text-sl-text-muted">Interpreter</dt><dd className="text-sl-text-muted">{spec.interpreter.kind} v{spec.interpreter.version} — model-assisted drafting is not enabled yet</dd>
            </dl>
            {!!compiled?.assumptions?.length && (
              <div className="mt-3 rounded-md border border-sl-border bg-sl-bg-raised px-3 py-2 text-xs text-sl-text-muted">
                <p className="font-medium text-sl-text">Assumptions made — edit your description to change them</p>
                <ul className="mt-1 list-disc pl-4">{compiled.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
              </div>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="button" onClick={runBacktest} className={btnPrimary} disabled={busy !== null || !!run}>
                {busy === "run" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <FlaskConical aria-hidden className="size-4" />}
                {busy === "run" ? "Running walk-forward backtest…" : "Run backtest"}
              </button>
              <span className="text-xs text-sl-text-subtle">Not charged during the beta.</span>
            </div>
          </Panel>
        )}

        {err && <div role="alert" className="rounded-md border border-sl-warn/50 bg-sl-bg-raised px-3 py-2 text-sm text-sl-text">{err}</div>}

        {run && (
          <Panel title="Scorecard" action={<div className="flex items-center gap-2"><StatusBadge status={run.status} /><Link href={`/workflows/${run.id}`} className="text-xs text-sl-accent hover:underline">Run details & trace</Link></div>}>
            <RunResult run={run} />
            {run.status === "completed" && (
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-sl-border pt-3">
                <Link href="/paper-trading" className={btnSecondary}><PlayCircle aria-hidden className="size-4" /> Continue to paper trading</Link>
                <p className="text-xs text-sl-text-muted">Paper trading is a separate, explicitly confirmed step (simulated orders only, $0.05 per run). Strategies are never deployed automatically, and no live orders are placed.</p>
              </div>
            )}
          </Panel>
        )}
      </div>

      <aside className="space-y-4">
        <Panel title="Workflow">
          <div className="[&_ol]:flex-col [&_ol]:items-stretch [&_li>span]:hidden">
            <WorkflowGraph nodes={graphNodes} />
          </div>
        </Panel>
        <Panel title="How results are judged">
          <ul className="list-disc space-y-1 pl-4 text-xs text-sl-text-muted">
            <li>Signals on a bar&apos;s close fill at the next bar&apos;s open.</li>
            <li>Fees, spread and slippage are always charged in the simulation.</li>
            <li>Every window is tested on data the rule never saw.</li>
            <li>A strategy must beat the best simple baseline in 3 of 4 windows — most don&apos;t, and the scorecard says so.</li>
          </ul>
        </Panel>
      </aside>
    </div>
  );
}
