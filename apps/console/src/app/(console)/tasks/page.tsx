import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Empty, ErrorNote, PageHeader, Table } from "@/components/ui";
import { SimulationBadge } from "@/components/preview/SimulationBadge";
import { requirePreview, STATE_LABEL, stateTone, taskApi, type Task, usd } from "@/lib/preview";

export const metadata: Metadata = { title: "My tasks · Satelink" };
export const dynamic = "force-dynamic";

export default async function TasksPage() {
  requirePreview();
  const r = await taskApi<{ tasks: Task[] }>("/tasks?limit=100");
  return (
    <>
      <PageHeader title="My tasks" lede="Every task you started, with its live state." actions={<SimulationBadge />} />
      {!r.ok ? <ErrorNote what="your tasks" /> : r.data.tasks.length === 0 ? (
        <Empty title="No tasks yet" body="Ask the assistant for something — a plan and a quote appear before anything runs." cta={{ label: "Open the assistant", href: "/assistant" }} />
      ) : (
        <Table head={["Task", "State", "Credits", "Updated"]} numeric={[2]} label="Tasks">
          {r.data.tasks.map((t) => (
            <tr key={t.id}>
              <td className="max-w-[28rem] truncate"><Link href={`/tasks/${t.id}`} className="text-sl-text hover:underline">{t.intent}</Link></td>
              <td><Badge tone={stateTone(t.state)}>{STATE_LABEL[t.state] || t.state}</Badge></td>
              <td className="text-right">{t.quote ? `${usd(t.quote.credit_charge_usd)}` : ""}</td>
              <td><time dateTime={t.updated_at}>{new Date(t.updated_at).toLocaleString()}</time></td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
