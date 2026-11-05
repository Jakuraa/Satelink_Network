import { NextResponse } from "next/server";
import { API_BASE } from "@/lib/api";
import { audit, guard } from "@/lib/guard";
import { authCookieHeader, getSession } from "@/lib/session";
import { previewEnabled } from "@/lib/preview";

// Console → preview task API proxy (Release A, local preview only; 404 unless SATELINK_PREVIEW=1).
// Mutations: same-origin + live session (guard) and the console CSRF header upstream.
// Only allowlisted paths are forwarded; everything else is 404.
const RUN = "run_[0-9a-f]{8,64}";
const POSTS: RegExp[] = [/^tasks$/, /^assistant\/messages$/, /^onboarding$/, new RegExp(`^tasks\\/${RUN}\\/(input|approve|cancel)$`), /^connections\/[a-z0-9_]+\/(start|revoke)$/];
const GETS: RegExp[] = [/^tasks$/, new RegExp(`^tasks\\/${RUN}(\\/events)?$`), /^receipts\/rcpt_[0-9a-f]{8,64}$/, /^usage$/, /^connections$/, /^capabilities$/, /^capabilities\/[a-z0-9_.]+$/];

const notFound = () => NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Not found.", retryable: false } }, { status: 404 });

export async function POST(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (!previewEnabled()) return notFound();
  const g = await guard(req);
  if ("error" in g) return g.error;
  const path = (await params).path.join("/");
  if (!POSTS.some((re) => re.test(path))) return notFound();
  try {
    const res = await fetch(`${API_BASE}/v1/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Cookie: await authCookieHeader(), "X-Satelink-Console": "1" },
      body: (await req.text()) || "{}",
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    const data = await res.json().catch(() => ({ ok: false, error: { code: "BAD_UPSTREAM", message: "Unexpected response.", retryable: true } }));
    audit(g.session, `tasks.${path.split("/").pop()}`, { status: res.status });
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ ok: false, error: { code: "SERVICE_UNAVAILABLE", message: "The preview API is not reachable.", retryable: true } }, { status: 503 });
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (!previewEnabled()) return notFound();
  if (!(await getSession())) return NextResponse.json({ ok: false, error: { code: "UNAUTHENTICATED", message: "Sign in first.", retryable: false } }, { status: 401 });
  const path = (await params).path.join("/");
  if (!GETS.some((re) => re.test(path))) return notFound();
  const search = new URL(req.url).search;
  const upstream = await fetch(`${API_BASE}/v1/${path}${search}`, {
    headers: { Accept: path.endsWith("/events") ? "text/event-stream" : "application/json", Cookie: await authCookieHeader() },
    cache: "no-store",
    signal: req.signal,
  }).catch(() => null);
  if (!upstream) return NextResponse.json({ ok: false, error: { code: "SERVICE_UNAVAILABLE", message: "The preview API is not reachable.", retryable: true } }, { status: 503 });
  // Stream SSE and CSV straight through; JSON is passed as-is.
  const type = upstream.headers.get("content-type") || "application/json";
  const headers: Record<string, string> = { "content-type": type, "cache-control": "no-store" };
  const disp = upstream.headers.get("content-disposition");
  if (disp) headers["content-disposition"] = disp;
  return new Response(upstream.body, { status: upstream.status, headers });
}
