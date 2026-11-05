// MCP client driver for the connector gateway (Release A S2; ADR-7). Uses the OFFICIAL MCP SDK client
// (@modelcontextprotocol/sdk, Streamable HTTP), loaded lazily from the workspace install — only the local preview
// server constructs it; production never imports it.
//
// Every tool result is UNTRUSTED DATA (R7): it is returned as parsed JSON for the caller to shape-check; nothing in it
// can approve, pay, change permissions or alter a plan.

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

export class McpToolError extends Error {
  constructor(tool, message) { super(`${tool}: ${message}`); this.name = 'McpToolError'; this.tool = tool; this.toolMessage = message; }
}

/**
 * @param {object} o — url (MCP endpoint; loopback in the preview), token (bearer), timeoutMs
 */
export async function openMcpSession({ url, token, timeoutMs = 10_000 }) {
  const u = new URL(url);
  if (!LOOPBACK.has(u.hostname)) throw new Error('MCP server must be a loopback URL in the preview');
  const [{ Client }, { StreamableHTTPClientTransport }] = await Promise.all([
    import('@modelcontextprotocol/sdk/client/index.js'),
    import('@modelcontextprotocol/sdk/client/streamableHttp.js'),
  ]);
  const client = new Client({ name: 'satelink-connector-gateway', version: '0.1.0' });
  const transport = new StreamableHTTPClientTransport(u, { requestInit: { headers: { authorization: `Bearer ${token}` } } });
  await client.connect(transport, { timeout: timeoutMs });
  let tools = null;
  return {
    /** tools/list discovery (cached per session). */
    async tools() { if (!tools) tools = (await client.listTools(undefined, { timeout: timeoutMs })).tools.map((t) => t.name); return tools; },
    async call(name, args) {
      if (!(await this.tools()).includes(name)) throw new McpToolError(name, 'tool not offered by this server');
      const r = await client.callTool({ name, arguments: args }, undefined, { timeout: timeoutMs });
      const text = r.content?.find((c) => c.type === 'text')?.text;
      if (r.isError) throw new McpToolError(name, String(text || 'tool error').slice(0, 200));
      if (r.structuredContent && typeof r.structuredContent === 'object') return r.structuredContent;
      try { return JSON.parse(text || 'null'); } catch { throw new McpToolError(name, 'non-JSON result'); }
    },
    async close() { await client.close().catch(() => {}); },
  };
}
