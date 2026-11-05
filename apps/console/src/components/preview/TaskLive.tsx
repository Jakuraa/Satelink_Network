"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { STATE_LABEL, TERMINAL, stateTone, type Task, usd } from "@/lib/preview-shared";
import { Badge } from "@/components/ui";
import { PlanPanel, QuoteCard } from "./QuoteCard";
import { SimulationBadge } from "./SimulationBadge";
import { getTask, newKey, post, type ApiError } from "./taskClient";
import { ConnectButton } from "./ConnectButton";
import { TradingResult } from "./TradingResult";

type Ev = { seq: number; from: string | null; to: string; at: string };

export function TaskLive({ initial }: { initial: Task }) {
  const [task, setTask] = useState(initial);
  const [events, setEvents] = useState<Ev[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ApiError | null>(null);
  const [answer, setAnswer] = useState("");

  const refresh = useCallback(async () => { const t = await getTask(task.id); if (t) setTask(t); }, [task.id]);

  // Back from the provider's consent page (?connected=<id>): resume the task automatically.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("connected") && task.state === "AWAITING_INPUT" && task.question?.field === "connection") {
      window.history.replaceState(null, "", window.location.pathname);
      post<{ task: Task }>(`tasks/${task.id}/input`, { field: "connection", value: "connected" }).then((r) => { if (r.ok) setTask(r.data.task); else setErr(r.error); });
    }
  }, [task.id, task.state, task.question?.field]);

  useEffect(() => {
    const es = new EventSource(`/api/console/tasks/tasks/${task.id}/events`);
    es.addEventListener("state", (m) => {
      const e = JSON.parse((m as MessageEvent).data) as Ev;
      setEvents((prev) => (prev.some((p) => p.seq === e.seq) ? prev : [...prev, e]));
    });
    es.addEventListener("task", (m) => setTask(JSON.parse((m as MessageEvent).data) as Task));
    es.onerror = () => { /* the browser reconnects automatically; the page also polls below */ };
    return () => es.close();
  }, [task.id]);

  useEffect(() => {
    if (TERMINAL.includes(task.state)) return;
    const t = setInterval(refresh, 1500);
    return () => clearInterval(t);
  }, [task.state, refresh]);

  const act = async (path: string, body: unknown) => {
    setBusy(true); setErr(null);
    const r = await post<{ task: Task }>(`tasks/${task.id}/${path}`, body);
    setBusy(false);
    if (r.ok) setTask(r.data.task); else { setErr(r.error); refresh(); }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={stateTone(task.state)}><span data-testid="task-state" data-state={task.state}>{STATE_LABEL[task.state] || task.state}</span></Badge>
          <SimulationBadge />
          {task.model_badge && <span className="text-[12px] text-sl-text-subtle">{task.model_badge}</span>}
        </div>
        {err && <p role="alert" className="rounded-md border border-sl-warn/60 px-3 py-2 text-[13px]">{err.message} <span className="text-sl-text-subtle">({err.code})</span></p>}
        {task.error && TERMINAL.includes(task.state) && (
          <p role="status" data-testid="task-error" className="rounded-md border border-sl-border bg-sl-bg-raised px-3 py-2 text-[13px]">{task.error.message}</p>
        )}
        {task.state === "AWAITING_INPUT" && task.question?.field === "connection" && task.question.connector_id && (
          <div className="space-y-2 rounded-md border border-sl-border bg-sl-surface p-3" data-testid="connect-needed">
            <p className="text-[13px] text-sl-text">{task.question.text}</p>
            <ConnectButton connectorId={task.question.connector_id} returnTo={`/tasks/${task.id}`} />
          </div>
        )}
        {task.state === "AWAITING_INPUT" && task.question && task.question.field !== "connection" && (
          <form className="space-y-2 rounded-md border border-sl-border bg-sl-surface p-3" onSubmit={(e) => { e.preventDefault(); act("input", { field: task.question!.field, value: answer }); }}>
            <label htmlFor="answer" className="block text-[13px] text-sl-text">{task.question.text}</label>
            <div className="flex gap-2">
              <input id="answer" value={answer} onChange={(e) => setAnswer(e.target.value)} required className="h-9 min-w-0 flex-1 rounded-md border border-sl-border-strong bg-sl-bg px-2.5 text-[13px] text-sl-text focus:border-sl-accent focus:outline-none focus:ring-2 focus:ring-sl-accent/30" />
              <button disabled={busy} className="h-9 rounded-md bg-sl-accent px-3 text-[13px] font-medium text-sl-accent-ink disabled:opacity-60">Send</button>
            </div>
          </form>
        )}
        <PlanPanel task={task} />
        {task.quote && (
          <QuoteCard
            quote={task.quote}
            busy={busy}
            onApprove={task.state === "AWAITING_APPROVAL" ? () => act("approve", { quote_id: task.quote!.quote_id, quote_version: task.quote!.version, idempotency_key: newKey("appr") }) : undefined}
            onCancel={["AWAITING_APPROVAL", "AWAITING_INPUT", "QUOTED"].includes(task.state) ? () => act("cancel", {}) : undefined}
          />
        )}
        {task.trading && <TradingResult t={task.trading} />}
        {task.output && <StepOutput output={task.output} />}
        {task.reservation && (
          <section aria-label="Simulated credit" className="flex flex-wrap items-center gap-2 rounded-md border border-sl-border bg-sl-surface px-3 py-2 text-[13px]">
            <span className="text-sl-text-muted">Simulated credit hold:</span>
            <span className="tnum font-medium">{usd(task.reservation.amount_usd)}</span>
            <Badge tone={task.reservation.state === "captured" ? "good" : "neutral"}>{task.reservation.state}</Badge>
            <SimulationBadge compact />
          </section>
        )}
        {task.receipt_id && (
          <Link href={`/receipts/${task.receipt_id}`} data-testid="receipt-link" className="inline-flex h-9 items-center rounded-md border border-sl-border px-3 text-[13px] font-medium hover:border-sl-accent">
            View receipt
          </Link>
        )}
      </div>
      <aside aria-label="Timeline" className="rounded-md border border-sl-border bg-sl-surface">
        <h2 className="border-b border-sl-border px-3 py-2 text-xs font-semibold uppercase tracking-wider text-sl-text-muted">Timeline</h2>
        {events.length === 0 ? <p className="p-3 text-[13px] text-sl-text-subtle">Connecting to the live timeline…</p> : (
          <ol className="space-y-1.5 p-3 text-[13px]" data-testid="timeline" aria-live="polite">
            {events.map((e) => (
              <li key={e.seq} className="flex items-baseline justify-between gap-2">
                <span className="text-sl-text">{STATE_LABEL[e.to] || e.to}</span>
                <time className="tnum shrink-0 text-[11px] text-sl-text-subtle" dateTime={e.at}>{new Date(e.at).toLocaleTimeString()}</time>
              </li>
            ))}
          </ol>
        )}
      </aside>
    </div>
  );
}

// Supplier output: plain text only (never HTML, never links) — it is untrusted (R7).
function StepOutput({ output }: { output: Record<string, unknown> }) {
  const body = (output.result && typeof output.result === "object" ? output.result : output) as Record<string, unknown>;
  const show = (v: unknown) => (Array.isArray(v) ? (v.length ? v.map(String).join(", ") : "none") : typeof v === "object" && v !== null ? JSON.stringify(v) : String(v));
  return (
    <section aria-label="Result" data-testid="task-output" className="rounded-md border border-sl-border bg-sl-surface px-3 py-2 text-[13px]">
      <h2 className="mb-1 font-medium text-sl-text">Result <span className="text-[12px] font-normal text-sl-text-muted">(from the supplier — simulated)</span></h2>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1">
        {Object.entries(body).slice(0, 12).map(([k, v]) => (
          <div key={k} className="contents"><dt className="text-sl-text-muted">{k.replace(/_/g, " ")}</dt><dd className="break-all" data-testid={`output-${k}`}>{show(v)}</dd></div>
        ))}
      </dl>
    </section>
  );
}
