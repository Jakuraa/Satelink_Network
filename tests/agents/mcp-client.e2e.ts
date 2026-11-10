/**
 * Release A · Slice S5 — an AI agent using the official MCP SDK client against the real `satelink-mcp` stdio server
 * (apps/mcp-server/index.js) with the registry-generated task tools enabled. Driven by tests/e2e/s5-agent.spec.ts,
 * where Playwright plays the human who approves in the console. Local preview only (loopback API).
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..", "..");
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export type Agent = {
  client: Client;
  tools: () => Promise<string[]>;
  call: (name: string, args: Json) => Promise<{ isError: boolean; data: Json }>;
  close: () => Promise<void>;
};

/** initialize: spawn satelink-mcp over stdio and complete the MCP handshake with the official client. */
export async function connectAgent({ apiBase, apiKey, consoleUrl = "http://localhost:3400" }: { apiBase: string; apiKey: string; consoleUrl?: string }): Promise<Agent> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(ROOT, "apps", "mcp-server", "index.js")],
    env: { PATH: process.env.PATH ?? "", SATELINK_MCP_TASK_TOOLS: "1", SATELINK_API_BASE: apiBase, SATELINK_API_KEY: apiKey, SATELINK_CONSOLE_URL: consoleUrl },
    stderr: "ignore",
  });
  const client = new Client({ name: "release-a-s5-agent", version: "1.0.0" });
  await client.connect(transport);
  return {
    client,
    tools: async () => (await client.listTools()).tools.map((t) => t.name),
    call: async (name, args) => {
      const r = await client.callTool({ name, arguments: args });
      const text = String((r.content as Array<{ text?: string }>)[0]?.text ?? "{}").split("\n\nNext:")[0];
      return { isError: Boolean(r.isError), data: JSON.parse(text) };
    },
    close: () => client.close(),
  };
}
