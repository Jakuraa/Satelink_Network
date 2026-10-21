import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { PageHeader, Panel, Table } from "@/components/ui";
import { ApiState, TradingDisclosure } from "@/components/trading/parts";
import { AssistantPanel } from "@/components/trading/assistant";
import { authorizeProposal, rejectProposal } from "@/app/(console)/trading/assistant-actions";
import { tradingGet } from "@/lib/trading/client";
import { requireAgentIa } from "@/lib/trading/guard";
import type { Proposal } from "@/lib/trading/assistant";

export const metadata: Metadata = { title: "Talk to Satelink Trading AI" };

export default async function AgentPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  requireAgentIa();
  const q = await searchParams;
  const [status, proposals] = await Promise.all([tradingGet<{ mcp: boolean }>("/status"), tradingGet<Proposal[]>("/proposals?status=pending_review")]);
  return (
    <>
      <PageHeader title="Talk to Satelink Trading AI" lede="Tell it your capital, broker, the most you are willing to lose and the markets you care about. It reasons, checks the evidence and answers GO, WAIT or REJECT. It cannot place, change or cancel orders — you authorise every one." />
      {q.error && <p role="alert" className="mb-3 text-sl-down">Could not complete that: {q.error}{q.message ? ` — ${q.message}` : ""}</p>}
      {q.done && <p className="mb-3 text-sl-text-muted">Done: {q.done}.</p>}
      <Panel title="Ask">
        <AssistantPanel />
      </Panel>
      <Panel title="Waiting for your decision" className="mt-4">
        {!proposals.ok ? <ApiState status={proposals.status} code={proposals.code} what="proposals" />
          : proposals.data.length === 0 ? <p className="text-sl-text-muted">Nothing is waiting for you.</p>
          : (
            <Table head={["What", "From", "Expires", "Your decision"]}>
              {proposals.data.map((p) => (
                <tr key={p.id}>
                  <td>{p.kind === "order" ? `${String(p.payload.side)} ${String(p.payload.quantity)} ${String(p.payload.instrument)} (paper)` : p.kind}{p.rationale ? <span className="block text-sm text-sl-text-muted">{p.rationale.slice(0, 160)}</span> : null}</td>
                  <td>{p.proposedByKind}</td>
                  <td>{p.expired ? "expired" : new Date(p.expiresAt).toLocaleString()}</td>
                  <td>
                    <form action={authorizeProposal} className="inline-flex items-end gap-1">
                      <input type="hidden" name="proposalId" value={p.id} />
                      <input type="hidden" name="idempotencyKey" value={randomUUID()} />
                      <input name="code" inputMode="numeric" pattern="\d{6}" required aria-label="Authenticator code" className="w-24 rounded border border-sl-border px-2 py-1" />
                      <button type="submit" className="rounded bg-sl-accent px-2 py-1 text-sl-accent-ink">Authorise</button>
                    </form>
                    <form action={rejectProposal} className="ml-2 inline">
                      <input type="hidden" name="proposalId" value={p.id} />
                      <input type="hidden" name="idempotencyKey" value={randomUUID()} />
                      <button type="submit" className="rounded border border-sl-border px-2 py-1">Decline</button>
                    </form>
                  </td>
                </tr>
              ))}
            </Table>
          )}
      </Panel>
      <Panel title="What the AI is allowed to do" className="mt-4">
        <Table head={["Action", "Allowed?"]}>
          <tr><td>Read markets, positions, orders, limits</td><td>Yes</td></tr>
          <tr><td>Evaluate an opportunity and explain GO / WAIT / REJECT</td><td>Yes</td></tr>
          <tr><td>Suggest an order for you to review</td><td>Yes — it waits for your approval</td></tr>
          <tr><td>Place, change or cancel an order</td><td>No, never</td></tr>
          <tr><td>Move money, see keys or passwords</td><td>No, never</td></tr>
        </Table>
        <p className="mt-2 text-sl-text-muted">Agent tools for other apps (MCP): {status.ok ? (status.data.mcp ? "on" : "off") : "unknown"}.</p>
      </Panel>
      <TradingDisclosure />
    </>
  );
}
