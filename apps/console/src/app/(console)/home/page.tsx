import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Empty, ErrorNote, PageHeader, Panel } from "@/components/ui";
import { SimulationBadge } from "@/components/preview/SimulationBadge";
import { requirePreview, STATE_LABEL, stateTone, SUGGESTED_TASKS, taskApi, type Task, usd } from "@/lib/preview";

export const metadata: Metadata = { title: "Home · Satelink" };
export const dynamic = "force-dynamic";

// Release A preview home: what needs you now (approvals, questions), what you can ask for, what happened recently.
export default async function HomePage() {
  requirePreview();
  const r = await taskApi<{ tasks: Task[] }>("/tasks?limit=50");
  const tasks = r.ok ? r.data.tasks : [];
  const pending = tasks.filter((t) => t.state === "AWAITING_APPROVAL" || t.state === "AWAITING_INPUT");
  return (
    <>
      <PageHeader title="Home" lede="Ask for an outcome; approve the quote; get a receipt. Preview — simulated, no charges." actions={<SimulationBadge />} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Needs your approval">
          {!r.ok ? <ErrorNote what="your tasks" /> : pending.length === 0 ? (
            <p className="text-[13px] text-sl-text-muted" data-testid="pending-empty">Nothing is waiting for you.</p>
          ) : (
            <ul className="space-y-2" data-testid="pending-approvals">
              {pending.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                  <Link href={`/tasks/${t.id}`} className="min-w-0 flex-1 truncate text-sl-text hover:underline">{t.intent}</Link>
                  <span className="flex items-center gap-2">
                    {t.quote && t.state === "AWAITING_APPROVAL" && <span className="tnum">{usd(t.quote.total_usd)}</span>}
                    <Badge tone={stateTone(t.state)}>{t.approval_request ? "Agent asked · " : ""}{STATE_LABEL[t.state] || t.state}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Try something">
          <ul className="grid gap-2 sm:grid-cols-2" data-testid="suggested-tasks">
            {SUGGESTED_TASKS.map((s) => (
              <li key={s.domain}>
                <Link href={s.href || `/assistant?prompt=${encodeURIComponent(s.text)}`}
                  className="block h-full rounded-md border border-sl-border px-3 py-2 text-[13px] hover:border-sl-accent">
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-sl-text-subtle">{s.domain}</span>
                  <span className="text-sl-text">{s.text}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      <div className="mt-4">
        <Panel title="Recent tasks">
          {!r.ok ? <ErrorNote what="your tasks" /> : tasks.length === 0 ? (
            <Empty title="No tasks yet" body="Pick a suggestion above or describe what you want in the assistant." cta={{ label: "Open the assistant", href: "/assistant" }} />
          ) : (
            <ul className="divide-y divide-sl-border text-[13px]">
              {tasks.slice(0, 6).map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 py-1.5">
                  <Link href={`/tasks/${t.id}`} className="min-w-0 flex-1 truncate text-sl-text hover:underline">{t.intent}</Link>
                  <Badge tone={stateTone(t.state)}>{STATE_LABEL[t.state] || t.state}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
