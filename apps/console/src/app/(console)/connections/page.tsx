import type { Metadata } from "next";
import { Badge, ErrorNote, PageHeader } from "@/components/ui";
import { ConnectButton } from "@/components/preview/ConnectButton";
import { RevokeButton } from "@/components/preview/RevokeButton";
import { requirePreview, taskApi } from "@/lib/preview";

export const metadata: Metadata = { title: "Connections · Satelink" };
export const dynamic = "force-dynamic";

type Conn = { connector_id: string; name: string; status: "connected" | "revoked" | "expired" | "not_connected"; scopes: string[]; connected_at: string | null; expires_at: string | null };
const SCOPE: Record<string, string> = { "food.read": "Search restaurants and read menus", "food.order": "Place simulated orders after your approval" };

export default async function ConnectionsPage({ searchParams }: { searchParams: Promise<{ connected?: string; connection_error?: string }> }) {
  requirePreview();
  const sp = await searchParams;
  const r = await taskApi<{ connections: Conn[] }>("/connections");
  return (
    <>
      <PageHeader title="Connections" lede="Services the assistant can use on your behalf. You approve each one, and you can revoke it any time." />
      {sp.connected && <p role="status" className="mb-3 rounded-md border border-sl-accent/40 px-3 py-2 text-[13px]">Connected.</p>}
      {sp.connection_error && <p role="alert" className="mb-3 rounded-md border border-sl-warn/60 px-3 py-2 text-[13px]">The connection was not completed ({sp.connection_error}).</p>}
      {!r.ok ? <ErrorNote what="your connections" /> : (
        <ul className="space-y-3" data-testid="connections-list">
          {r.data.connections.map((c) => (
            <li key={c.connector_id} className="rounded-md border border-sl-border bg-sl-surface p-3" data-testid={`connection-${c.connector_id}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-medium text-sl-text">{c.name}</h2>
                  <p className="text-[12px] text-sl-text-muted">Local mock MCP server — not connected to any real food platform. Orders are simulated.</p>
                </div>
                <Badge tone={c.status === "connected" ? "good" : "neutral"}><span data-testid="connection-status">{c.status.replace("_", " ")}</span></Badge>
              </div>
              {c.status === "connected" ? (
                <div className="mt-2 space-y-2 text-[13px]">
                  <p className="text-sl-text-muted">Permissions:</p>
                  <ul className="list-inside list-disc text-sl-text">{c.scopes.map((s) => <li key={s}>{SCOPE[s] || s}</li>)}</ul>
                  <RevokeButton connectorId={c.connector_id} />
                </div>
              ) : <div className="mt-2"><ConnectButton connectorId={c.connector_id} returnTo="/connections" /></div>}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-[12px] text-sl-text-subtle">Zomato: not available — its terms for automated ordering have not been verified (blocked).</p>
    </>
  );
}
