import type { Metadata } from "next";
import { Badge, ErrorNote, PageHeader } from "@/components/ui";
import { DeveloperKeysPanel, type DevKey } from "@/components/preview/DeveloperKeysPanel";
import { SimulationBadge } from "@/components/preview/SimulationBadge";
import { requirePreview, taskApi } from "@/lib/preview";

export const metadata: Metadata = { title: "Developer Hub · Satelink" };
export const dynamic = "force-dynamic";

// Release A, Slice S4 (local preview only): scoped task-API keys for the same account. Separate from the live
// RPC keys under /keys — those are a different product and are not touched here (ADR-8).
export default async function DeveloperHubPage() {
  requirePreview();
  const r = await taskApi<{ keys: DevKey[] }>("/developer/keys");
  return (
    <>
      <PageHeader title="Developer Hub" lede="Call the task API from your own code: create a scoped key, ask for a quote, approve it, read the receipt." />
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
    </>
  );
}
