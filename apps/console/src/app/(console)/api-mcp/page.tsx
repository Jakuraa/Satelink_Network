import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Empty, ErrorNote, PageHeader, Panel, Table } from "@/components/ui";
import { API_BASE } from "@/lib/api";
import { loadMcpTools, loadOpenApi, loadRpcPricing, workflowsBetaEnabled } from "@/lib/workflows";

export const metadata: Metadata = { title: "API & MCP" };
export const dynamic = "force-dynamic";

const pre = "overflow-x-auto rounded border border-sl-border bg-sl-bg p-2 font-mono text-[11px] text-sl-text-muted";

export default async function ApiMcpPage() {
  if (!workflowsBetaEnabled()) {
    return (<><PageHeader title="API & MCP" /><Empty title="Not enabled here" body="This environment does not have the workflows beta switched on." /></>);
  }
  const [openapi, mcp, pricing] = await Promise.all([loadOpenApi(), loadMcpTools(), loadRpcPricing()]);
  const ops = openapi.ok
    ? Object.entries(openapi.data.paths).flatMap(([path, methods]) => Object.entries(methods).map(([m, op]) => ({ m: m.toUpperCase(), path, summary: op.summary, auth: Boolean(op.security) })))
    : [];

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <PageHeader
        title="API & MCP"
        lede="Everything in the console is available to your code and your agents through the same services: Polygon RPC, the workflows REST API and MCP tools."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Polygon RPC" action={<Badge tone="good">Live</Badge>}>
          <dl className="grid grid-cols-[8rem_1fr] gap-y-1 text-sm">
            <dt className="text-sl-text-muted">Endpoint</dt><dd className="break-all font-mono text-sl-text">https://rpc.satelink.network/rpc/polygon</dd>
            <dt className="text-sl-text-muted">Price</dt>
            <dd className="tnum text-sl-text">{pricing.ok ? `$${pricing.data.price_per_call_usdt} per call` : "unavailable right now"} · x402 bundle $0.10 = 1,000 calls</dd>
            <dt className="text-sl-text-muted">Auth</dt><dd className="text-sl-text">X-API-Key, or keyless via x402 (USDC on Base)</dd>
          </dl>
          <p className="mt-2 text-xs text-sl-text-muted">Try it without code: <Link href="/marketplace/wallet.balance" className="text-sl-accent hover:underline">wallet balance on Polygon</Link> runs a real <code>eth_getBalance</code> through Satelink RPC. Full method list: <Link href="/rpc" className="text-sl-accent hover:underline">RPC</Link>.</p>
        </Panel>

        <Panel title="Workflows REST API" action={<Badge tone="machine">Beta</Badge>}>
          <p className="text-sm text-sl-text-muted">OpenAPI 3.1: <a href={`${API_BASE}/v1/workflows/openapi.json`} className="break-all font-mono text-xs text-sl-accent hover:underline">{API_BASE}/v1/workflows/openapi.json</a></p>
          <pre tabIndex={0} className={`${pre} mt-2`}>{`curl -X POST ${API_BASE}/v1/workflows/runs \\
  -H "X-API-Key: $SATELINK_KEY" -H "Content-Type: application/json" \\
  -d '{"template":"strategy_lab.backtest.v1",
       "input":{"prompt":"BTC 20/50 moving average crossover"},
       "idempotency_key":"my-first-backtest-1"}'`}</pre>
          <p className="mt-2 text-[11px] text-sl-text-subtle">Same idempotency key + same request returns the same run; a different request with a used key is rejected (409).</p>
        </Panel>
      </div>

      <Panel title="Endpoints">
        {!openapi.ok ? <ErrorNote what="the API contract" /> : (
          <Table head={["Method", "Path", "What it does", "Auth"]} label="Workflow endpoints">
            {ops.map((o) => (
              <tr key={`${o.m} ${o.path}`}>
                <td className="font-mono text-xs text-sl-text">{o.m}</td>
                <td className="font-mono text-xs text-sl-text">{o.path}</td>
                <td className="text-sl-text-muted">{o.summary}</td>
                <td>{o.auth ? <Badge>key or session</Badge> : <Badge tone="good">public</Badge>}</td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>

      <Panel title="MCP tools" action={<Badge tone="warn">Beta · not published</Badge>}>
        {!mcp.ok ? <ErrorNote what="the MCP tool list" /> : (
          <div className="space-y-3">
            <ul className="grid gap-2 md:grid-cols-2">
              {mcp.data.manifest.tools.map((t) => (
                <li key={t.name} className="rounded-md border border-sl-border bg-sl-bg-raised p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <code className="font-mono text-sm text-sl-text">{t.name}</code>
                    {t.mutating ? <Badge tone="warn">creates a run</Badge> : <Badge>read only</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-sl-text-muted">{t.description}</p>
                  {t.inputSchema.properties && (
                    <p className="mt-1 font-mono text-[11px] text-sl-text-subtle">
                      {Object.keys(t.inputSchema.properties).map((k) => (t.inputSchema.required?.includes(k) ? `${k}*` : k)).join(", ")}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-[8rem_1fr]">
              <dt className="text-sl-text-muted">Auth</dt><dd className="text-sl-text">{mcp.data.manifest.auth}</dd>
              <dt className="text-sl-text-muted">Spending</dt><dd className="text-sl-text">{mcp.data.manifest.spending}</dd>
              <dt className="text-sl-text-muted">Idempotency</dt><dd className="text-sl-text">{mcp.data.manifest.idempotency}</dd>
            </dl>
            <div>
              <p className="text-xs font-medium text-sl-text">Claude Desktop / any MCP client (run from a checkout — the package is not on npm yet)</p>
              <pre tabIndex={0} className={`${pre} mt-1`}>{`{
  "mcpServers": {
    "satelink": {
      "command": "node",
      "args": ["<repo>/apps/mcp-server/index.js"],
      "env": {
        "SATELINK_API_KEY": "<your Satelink API key>",
        "SATELINK_MCP_WORKFLOW_TOOLS": "1",
        "SATELINK_MCP_AUTO_APPROVE_MAX_USD": "0"
      }
    }
  }
}`}</pre>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
