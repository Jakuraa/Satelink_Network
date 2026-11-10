"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { STATE_LABEL, SUGGESTED_TASKS, usd, type Task } from "@/lib/preview-shared";
import { PlanPanel, QuoteCard } from "./QuoteCard";
import { SimulationBadge } from "./SimulationBadge";
import { formatMicros, newKey, post, type ApiError } from "./taskClient";
import { ConnectButton } from "./ConnectButton";

type Turn =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; served_by?: string; cost_usd?: string }
  | { role: "task"; task: Task }
  | { role: "error"; error: ApiError };


export function AssistantChat({ badge, initialPrompt = "" }: { badge: string | null; initialPrompt?: string }) {
  const router = useRouter();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState(initialPrompt);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [ready, setReady] = useState(false); // no native form submit before hydration
  useEffect(() => setReady(true), []);

  const send = async (msg: string) => {
    if (!msg.trim() || busy) return;
    setBusy(true); setText("");
    setTurns((t) => [...t, { role: "user", text: msg }]);
    const r = await post<{ kind: "reply" | "task"; reply?: string; served_by?: string; cost_usd?: string; task?: Task }>("assistant/messages", { text: msg, idempotency_key: newKey("chat") });
    setBusy(false);
    if (!r.ok) setTurns((t) => [...t, { role: "error", error: r.error }]);
    else if (r.data.kind === "task" && r.data.task) setTurns((t) => [...t, { role: "task", task: r.data.task! }]);
    else setTurns((t) => [...t, { role: "assistant", text: r.data.reply || "", served_by: r.data.served_by, cost_usd: r.data.cost_usd }]);
    inputRef.current?.focus();
  };

  const updateTask = (task: Task) => setTurns((ts) => ts.map((x) => (x.role === "task" && x.task.id === task.id ? { role: "task", task } : x)));

  return (
    <div className="flex min-h-[60vh] flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-sl-text-subtle">
        <SimulationBadge />
        {badge && <span data-testid="model-badge">{badge}</span>}
      </div>
      <ol className="flex-1 space-y-3 pb-4" aria-live="polite" aria-label="Conversation">
        {turns.length === 0 && (
          <li className="rounded-md border border-dashed border-sl-border px-4 py-6 text-sl-text-muted">
            <p className="font-medium text-sl-text">Describe the outcome you want.</p>
            <p className="mt-1">Satelink picks a model, finds a capability, plans, quotes, and only acts after you approve. Everything here is simulated — nothing is charged.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {SUGGESTED_TASKS.map((s) => s.href
                ? <Link key={s.domain} href={s.href} className="rounded-full border border-sl-border px-3 py-1 text-[12px] text-sl-text hover:border-sl-accent"><span className="text-sl-text-subtle">{s.domain}: </span>{s.text}</Link>
                : <button key={s.domain} type="button" disabled={!ready || busy} onClick={() => send(s.text)} data-testid={`suggest-${s.domain}`} className="rounded-full border border-sl-border px-3 py-1 text-left text-[12px] text-sl-text hover:border-sl-accent disabled:opacity-60"><span className="text-sl-text-subtle">{s.domain}: </span>{s.text}</button>)}
              <button type="button" disabled={!ready || busy} onClick={() => send("What can you do?")} className="rounded-full border border-sl-border px-3 py-1 text-[12px] text-sl-text hover:border-sl-accent disabled:opacity-60">What can you do?</button>
            </div>
          </li>
        )}
        {turns.map((t, i) => (
          <li key={i}>
            {t.role === "user" && <p className="ml-auto w-fit max-w-[85%] rounded-md bg-sl-accent/15 px-3 py-2 text-sl-text">{t.text}</p>}
            {t.role === "assistant" && (
              <div className="max-w-[85%] rounded-md border border-sl-border bg-sl-surface px-3 py-2">
                <p className="text-sl-text">{t.text}</p>
                <p className="mt-1 text-[11px] text-sl-text-subtle" data-testid="turn-model">Model: {t.served_by} · {usd(t.cost_usd)}</p>
              </div>
            )}
            {t.role === "error" && <p role="alert" className="rounded-md border border-sl-warn/60 px-3 py-2 text-[13px]">{t.error.message}</p>}
            {t.role === "task" && <TaskTurn task={t.task} onUpdate={updateTask} onOpen={(id) => router.push(`/tasks/${id}`)} />}
          </li>
        ))}
      </ol>
      <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="sticky bottom-0 flex gap-2 border-t border-sl-border bg-sl-bg py-3">
        <label htmlFor="assistant-input" className="sr-only">Message</label>
        <textarea id="assistant-input" ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={2000}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }}
          placeholder="e.g. Buy a $10 e-book gift code" className="min-w-0 flex-1 resize-none rounded-md border border-sl-border-strong bg-sl-surface px-3 py-2 text-[14px] text-sl-text placeholder:text-sl-text-subtle focus:border-sl-accent focus:outline-none focus:ring-2 focus:ring-sl-accent/30" />
        <button type="submit" disabled={!ready || busy || !text.trim()} className="h-auto rounded-md bg-sl-accent px-4 text-[14px] font-medium text-sl-accent-ink hover:bg-sl-accent-strong disabled:opacity-60">{busy ? "Working…" : "Send"}</button>
      </form>
    </div>
  );
}

function TaskTurn({ task, onUpdate, onOpen }: { task: Task; onUpdate: (t: Task) => void; onOpen: (id: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const act = async (path: string, body: unknown) => {
    setBusy(true); setErr(null);
    const r = await post<{ task: Task }>(`tasks/${task.id}/${path}`, body);
    setBusy(false);
    if (!r.ok) { setErr(r.error.message); return; }
    onUpdate(r.data.task);
    if (path === "approve") onOpen(task.id);
  };
  return (
    <div className="space-y-3 rounded-md border border-sl-border bg-sl-bg-raised p-3" data-testid="task-turn">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-sl-text">Task: <span className="text-sl-text-muted">{task.intent}</span></p>
        <span className="text-[12px] text-sl-text-subtle" data-testid="task-turn-state">{STATE_LABEL[task.state] || task.state}</span>
      </div>
      {task.plan?.model && <p className="text-[11px] text-sl-text-subtle" data-testid="turn-model">Model: {task.plan.model.served_by} · {usd(formatMicros(task.plan.model.cost_minor))}</p>}
      {err && <p role="alert" className="text-[13px]">{err}</p>}
      {task.state === "AWAITING_INPUT" && task.question?.field === "connection" && task.question.connector_id && (
        <div className="space-y-2" data-testid="connect-needed">
          <p className="text-[13px] text-sl-text">{task.question.text}</p>
          <ConnectButton connectorId={task.question.connector_id} returnTo={`/tasks/${task.id}`} />
        </div>
      )}
      {task.state === "AWAITING_INPUT" && task.question && task.question.field !== "connection" && (
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); act("input", { field: task.question!.field, value: answer }); }}>
          <label htmlFor={`a-${task.id}`} className="block text-[13px] text-sl-text">{task.question.text}</label>
          <div className="flex gap-2">
            <input id={`a-${task.id}`} value={answer} onChange={(e) => setAnswer(e.target.value)} required className="h-9 min-w-0 flex-1 rounded-md border border-sl-border-strong bg-sl-surface px-2.5 text-[13px] text-sl-text focus:border-sl-accent focus:outline-none focus:ring-2 focus:ring-sl-accent/30" />
            <button disabled={busy} className="h-9 rounded-md bg-sl-accent px-3 text-[13px] font-medium text-sl-accent-ink disabled:opacity-60">Send</button>
          </div>
        </form>
      )}
      {task.error && <p role="status" className="text-[13px] text-sl-text-muted">{task.error.message}</p>}
      <PlanPanel task={task} />
      {task.quote && task.state === "AWAITING_APPROVAL" && (
        <QuoteCard quote={task.quote} busy={busy} onApprove={() => act("approve", { quote_id: task.quote!.quote_id, quote_version: task.quote!.version, idempotency_key: newKey("appr") })} onCancel={() => act("cancel", {})} />
      )}
      <Link href={`/tasks/${task.id}`} className="inline-block text-[12px] text-sl-text underline-offset-2 hover:underline">Open task</Link>
    </div>
  );
}
