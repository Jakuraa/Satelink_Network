import type { Metadata } from "next";
import { Badge, ErrorNote, PageHeader } from "@/components/ui";
import { DeveloperKeysPanel, type DevKey } from "@/components/preview/DeveloperKeysPanel";
import { SimulationBadge } from "@/components/preview/SimulationBadge";
import { requirePreview, taskApi } from "@/lib/preview";
import { API_BASE } from "@/lib/api";

export const metadata: Metadata = { title: "Developer & Agent Hub · Satelink" };
export const dynamic = "force-dynamic";

// Release A, Slice S4 (local preview only): scoped task-API keys for the same account. Separate from the live
// RPC keys under /keys — those are a different product and are not touched here (ADR-8).
export default async function DeveloperHubPage() {
  requirePreview();
  const r = await taskApi<{ keys: DevKey[] }>("/developer/keys");
  return (
    <>
      <PageHeader title="Developer & Agent Hub" lede="Connect code, AI agents and machines: scoped keys, the task API, MCP and A2A, and pay-per-call (x402 preview)." />
      <div className="mb-4 flex flex-wrap items-center gap-2"><SimulationBadge /><Badge tone="neutral">Fees: PROPOSED — NOT APPROVED</Badge></div>
      {!r.ok ? <ErrorNote what="your developer keys" /> : <DeveloperKeysPanel initial={r.data.keys} />}
      <section className="mt-6 rounded-md border border-sl-border bg-sl-surface p-3 text-[13px]" aria-labelledby="quickstart">
        <h2 id="quickstart" className="mb-2 font-medium text-sl-text">Quickstart</h2>
        <ol className="list-inside list-decimal space-y-1 text-sl-text-muted">
          <li>Create a key with <code>tasks:create</code>, <code>tasks:read</code>, <code>tasks:approve</code>, <code>receipts:read</code> and <code>usage:read</code>.</li>
          <li>Run <code className="break-all">SATELINK_API_KEY=… bash tests/dev/procure.sh</code> from the repository.</li>
          <li>Approvals over the API must send an <code>Idempotency-Key</code> header.</li>
        </ol>
        <p className="mt-2 text-sl-text-muted">Reference: <a className="underline" href="/api/console/tasks/openapi.json">OpenAPI 3.1 (generated)</a>. The provider is <strong>Demo Data API (MOCK)</strong> — a local mock, not a real service.</p>
      </section>
      <section id="agents" className="mt-4 scroll-mt-16 rounded-md border border-sl-border bg-sl-surface p-3 text-[13px]" aria-labelledby="agents-h">
        <h2 id="agents-h" className="mb-2 font-medium text-sl-text">Agents (MCP &amp; A2A)</h2>
        <p className="text-sl-text-muted">Give your agent a key <strong>without</strong> <code>tasks:approve</code>. It can discover capabilities, get quotes and ask you to approve — agent spend is never pre-authorized, so every purchase waits for you here.</p>
        <p className="mt-2 font-medium text-sl-text">MCP (stdio, satelink-mcp 2.2.0 from this repository)</p>
        <pre tabIndex={0} role="region" aria-label="MCP server configuration" className="mt-1 overflow-x-auto rounded bg-sl-bg px-2 py-1.5 text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sl-accent/45" data-testid="mcp-config">{`SATELINK_MCP_TASK_TOOLS=1 \\
SATELINK_API_BASE=${API_BASE} \\
SATELINK_API_KEY=slk_preview_… \\
node apps/mcp-server/index.js`}</pre>
        <p className="mt-1 text-sl-text-muted">Tools: satelink_discover, satelink_quote, satelink_request_approval, satelink_task_status, satelink_receipt.</p>
        <p className="mt-2 font-medium text-sl-text">A2A v1.0</p>
        <p className="text-sl-text-muted">Agent Card: <code className="break-all">{`${API_BASE}/.well-known/agent-card.json`}</code> · JSON-RPC: <code className="break-all">{`${API_BASE}/a2a/v1`}</code> (header <code>A2A-Version: 1.0</code>, Bearer key).</p>
      </section>
      <section id="machines" className="mt-4 scroll-mt-16 rounded-md border border-sl-border bg-sl-surface p-3 text-[13px]" aria-labelledby="machines-h">
        <h2 id="machines-h" className="mb-2 font-medium text-sl-text">Machines (x402 preview)</h2>
        <p className="text-sl-text-muted">Pay per call over HTTP 402: the first request returns <code>PAYMENT-REQUIRED</code>; the retry carries a payment. In the preview the payment is mock-signed and checked by a local mock facilitator on a testnet id — nothing is settled and no money moves.</p>
        <pre tabIndex={0} role="region" aria-label="x402 machine client command" className="mt-1 overflow-x-auto rounded bg-sl-bg px-2 py-1.5 text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sl-accent/45" data-testid="x402-command">{`node scripts/preview/x402-machine-client.mjs \\
  --capability dev.data.extract --q "Extract the emails from: …" \\
  [--key slk_preview_…]   # optional: the receipt then appears in your usage`}</pre>
      </section>
    </>
  );
}
