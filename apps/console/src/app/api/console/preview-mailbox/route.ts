import { NextResponse } from "next/server";
import { API_BASE } from "@/lib/api";
import { previewEnabled } from "@/lib/preview";

// Local preview only (404 unless SATELINK_PREVIEW=1): reads the latest sign-in link for an address from the
// preview API's dev mail sink. There is no mailbox — and no route — in any deployed environment.
export async function GET(req: Request) {
  if (!previewEnabled()) return NextResponse.json({ ok: false }, { status: 404 });
  const to = new URL(req.url).searchParams.get("to") || "";
  if (!/^[^@\s]{1,64}@[^@\s]{1,190}$/.test(to)) return NextResponse.json({ ok: false }, { status: 400 });
  const r = await fetch(`${API_BASE}/preview/mailbox?to=${encodeURIComponent(to)}`, { cache: "no-store" }).catch(() => null);
  const j = r?.ok ? await r.json().catch(() => null) : null;
  return NextResponse.json({ ok: Boolean(j?.mail?.url), url: j?.mail?.url || null });
}
