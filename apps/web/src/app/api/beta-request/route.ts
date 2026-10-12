// POST /api/beta-request — Satelink Trading AI beta waitlist capture (Phase 7
// amendment, #511). Same-origin proxy pattern as dodo-checkout/dodo-claim:
// this route validates and rate-limits the real client IP (the browser only
// ever talks to apps/web), then forwards server-to-server to apps/api, which
// owns the beta_requests table and the Resend wiring (console_accounts/
// alerts.mjs) and does the actual insert + founder/auto-reply emails.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_BASE =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  (process.env.NODE_ENV === "production" ? "https://api.satelink.network" : "http://localhost:8080");

const ROLES = ["human", "ai_agent", "machine"] as const;

const Schema = z.object({
  email: z.string().email().max(200),
  name: z.string().min(1).max(120),
  role: z.enum(ROLES),
  useCase: z.string().min(1).max(2000),
  capitalBand: z.string().max(80).optional().default(""),
  broker: z.string().max(80).optional().default(""),
  website: z.string().max(0).optional().default(""), // honeypot
});

export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers);
  const rl = rateLimit(`beta-request:${ip}`, 5, 5 / 60);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429, headers: { "retry-after": String(rl.retryAfterSec) } });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  // Honeypot: silently accept so bots get no signal.
  if (typeof (body as { website?: unknown })?.website === "string" && (body as { website: string }).website.length > 0) {
    return NextResponse.json({ ok: true });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "validation_failed", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { email, name, role, useCase, capitalBand, broker } = parsed.data;
  try {
    const upstream = await fetch(`${API_BASE}/beta/request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, name, role, useCase, capitalBand: capitalBand || undefined, broker: broker || undefined, source: "web" }),
    });
    const data = await upstream.json().catch(() => ({ ok: false, error: "upstream_invalid_response" }));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    console.error("[beta-request] upstream call failed:", (err as Error).message);
    return NextResponse.json({ ok: false, error: "upstream_unreachable" }, { status: 502 });
  }
}
