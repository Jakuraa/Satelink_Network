// Same-origin proxy from the checkout client to the API's /v1/payments/*.
// The console guard (Origin + live session) runs first; only these exact shapes are
// forwarded; the API applies its own CSRF + session check again.
import { NextResponse } from "next/server";
import { audit, guard } from "@/lib/guard";
import { getSession } from "@/lib/session";
import { loadIntent, loadMethods, paymentsPost } from "@/lib/payments";

const REF = "inv_[A-Za-z0-9-]{8,64}";
const POSTS: RegExp[] = [
  /^\/checkout\/quote$/,
  /^\/checkout\/intents$/,
  new RegExp(`^/checkout/intents/${REF}/onchain-tx$`),
  new RegExp(`^/checkout/intents/${REF}/transacty-utr$`),
  new RegExp(`^/checkout/intents/${REF}/refresh$`),
];
const GETS: RegExp[] = [
  /^\/checkout\/methods$/,
  new RegExp(`^/checkout/intents/${REF}$`),
];

async function pathOf(ctx: { params: Promise<{ path: string[] }> }) {
  return "/" + (await ctx.params).path.join("/");
}

export async function POST(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const g = await guard(req);
  if ("error" in g) return g.error;
  const path = await pathOf(ctx);
  if (!POSTS.some((re) => re.test(path))) return NextResponse.json({ ok: false, error: "not_allowed" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const r = await paymentsPost(path, body);
  audit(g.session, "payments" + path.replace(/inv_[A-Za-z0-9-]+/, ":ref"), { status: r.status });
  return NextResponse.json(r.body, { status: r.status, headers: { "Cache-Control": "no-store" } });
}

// Reads (status poll, methods) need a live session, like the console's other GET routes.
export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  if (!(await getSession())) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  const path = await pathOf(ctx);
  if (!GETS.some((re) => re.test(path))) return NextResponse.json({ ok: false, error: "not_allowed" }, { status: 404 });
  if (path === "/checkout/methods") {
    const r = await loadMethods();
    return NextResponse.json(r.ok ? { ok: true, data: r.data } : { ok: false, error: r.error }, { status: r.ok ? 200 : r.status || 502, headers: { "Cache-Control": "no-store" } });
  }
  const ref = path.split("/").pop() as string;
  const r = await loadIntent(ref);
  return NextResponse.json(r.ok ? { ok: true, data: r.data } : { ok: false, error: r.error }, { status: r.ok ? 200 : r.status || 502, headers: { "Cache-Control": "no-store" } });
}
