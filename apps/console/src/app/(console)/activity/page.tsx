import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Empty, ErrorNote, PageHeader, Panel } from "@/components/ui";
import { requirePreview, STATE_LABEL, stateTone, taskApi, type Task } from "@/lib/preview";

export const metadata: Metadata = { title: "Activity & Security · Satelink" };
export const dynamic = "force-dynamic";

type Key = { key_id: string; name: string; prefix: string; scopes: string[]; status: string; last_used_at: string | null; requests_total: string };
type Conn = { connector_id: string; name: string; status: string; scopes: string[] };
const when = (s: string | null) => (s ? `${new Date(s).toISOString().slice(0, 16).replace("T", " ")} UTC` : "never");

// Who and what can act for you, and what happened recently — all from your own records (no sample data).
export default async function ActivityPage() {
  requirePreview();
  const [tasks, keys, conns] = await Promise.all([
    taskApi<{ tasks: Task[] }>("/tasks?limit=20"),
    taskApi<{ keys: Key[] }>("/developer/keys"),
    taskApi<{ connections: Conn[] }>("/connections"),
  ]);
  return (
    <>
      <PageHeader title="Activity & Security" lede="Recent task activity, and every key and connection that can act for you. Sign-in sessions are in Settings." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="API keys that can act for you">
          {!keys.ok ? <ErrorNote what="your keys" /> : keys.data.keys.filter((k) => k.status === "active").length === 0 ? (
            <p className="text-[13px] text-sl-text-muted">No active keys. <Link href="/developer-hub" className="underline">Create one</Link> if an app or agent needs access.</p>
          ) : (
            <ul className="space-y-2 text-[13px]" data-testid="active-keys">
              {keys.data.keys.filter((k) => k.status === "active").map((k) => (
                <li key={k.key_id} className="flex flex-wrap justify-between gap-2">
                  <span className="min-w-0"><span className="font-medium text-sl-text">{k.name}</span> <code className="text-sl-text-subtle">{k.prefix}…</code><br /><span className="text-sl-text-muted">{k.scopes.join(", ")}</span></span>
                  <span className="text-sl-text-muted">last used {when(k.last_used_at)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[12px] text-sl-text-subtle">Agents can never approve spending: every agent purchase waits for you.</p>
        </Panel>
        <Panel title="Connected services">
          {!conns.ok ? <ErrorNote what="your connections" /> : (
            <ul className="space-y-2 text-[13px]">
              {conns.data.connections.map((c) => (
                <li key={c.connector_id} className="flex justify-between gap-2">
                  <span className="text-sl-text">{c.name}</span>
                  <Badge tone={c.status === "connected" ? "good" : "neutral"}>{c.status.replace("_", " ")}</Badge>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[12px]"><Link href="/connections" className="underline">Manage connections</Link></p>
        </Panel>
      </div>
      <div className="mt-4">
        <Panel title="Recent task activity">
          {!tasks.ok ? <ErrorNote what="your activity" /> : tasks.data.tasks.length === 0 ? (
            <Empty title="No activity yet" body="Tasks you or your agents start appear here." />
          ) : (
            <ul className="divide-y divide-sl-border text-[13px]" data-testid="activity-list">
              {tasks.data.tasks.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                  <Link href={`/tasks/${t.id}`} className="min-w-0 flex-1 truncate text-sl-text hover:underline">{t.intent}</Link>
                  <span className="flex items-center gap-2 text-sl-text-muted">
                    <span>{t.actor_type === "human" ? "you" : t.actor_type}</span>
                    <Badge tone={stateTone(t.state)}>{STATE_LABEL[t.state] || t.state}</Badge>
                    <time dateTime={t.updated_at} className="tnum text-[11px]">{when(t.updated_at)}</time>
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
