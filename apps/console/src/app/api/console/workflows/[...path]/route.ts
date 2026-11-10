import { NextResponse } from "next/server";
import { API_BASE } from "@/lib/api";
import { audit, guard } from "@/lib/guard";
import { workflowIdentity } from "@/lib/workflows";

// Console → API proxy for the workflows beta. Same-origin + live session
// (guard), then forwards with the user's identity (session or connected key).
// Only these paths are forwarded; anything else is 404.
const ALLOWED: { re: RegExp; auth: boolean }[] = [
  { re: /^strategy-lab\/compile$/, auth: false },
  { re: /^marketplace\/quote$/, auth: false },
  { re: /^workflows\/runs$/, auth: true },
  { re: /^workflows\/runs\/run_[0-9a-f]{8,64}\/(approve|cancel)$/, auth: true },
];

export async function POST(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const g = await guard(req);
  if ("error" in g) return g.error;
  const path = (await params).path.join("/");
  const rule = ALLOWED.find((a) => a.re.test(path));
  if (!rule) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (rule.auth) {
    const id = await workflowIdentity();
    if (!id) {
      return NextResponse.json({ ok: false, error: "api_key_required", message: "Connect or create an API key to run workflows." }, { status: 401 });
    }
    Object.assign(headers, id);
  }
  const body = await req.text();
  try {
    const res = await fetch(`${API_BASE}/v1/${path}`, {
      method: "POST",
      headers,
      body: body || "{}",
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });
    const data = await res.json().catch(() => ({ ok: false, error: "bad_upstream_response" }));
    if (rule.auth) audit(g.session, `workflows.${path.split("/").pop()}`, { status: res.status });
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ ok: false, error: "service_unavailable", message: err instanceof Error ? err.name : "unreachable" }, { status: 503 });
  }
}
