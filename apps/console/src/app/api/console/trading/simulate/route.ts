import { NextResponse } from "next/server";
import { API_BASE } from "@/lib/api";
import { audit, guard } from "@/lib/guard";
import { getActiveKey } from "@/lib/keys";
import { accountsEnabled, meRaw } from "@/lib/account";

/**
 * Executes a metered paper trading simulation from the console UI.
 *
 * Calls POST /v1/trading/paper/simulate on the API.
 * Rates: $0.05 USDT / successful simulation (catalog-backed).
 * Guaranteed:
 *   - Metered via canonical api_credits
 *   - Idempotency key preserved for retries
 *   - Live trading disabled
 *   - SIMULATED_PAPER_EXECUTION disclaimer preserved
 */
export async function POST(req: Request) {
  const g = await guard(req);
  if ("error" in g) return g.error;

  const body = await req.json().catch(() => ({}));
  const { apiKey, keyId, idempotencyKey, instrumentId, strategy, strategyParams, orderQuantity } = body;

  const payload = {
    idempotencyKey,
    instrumentId,
    strategy: strategy || "sma-crossover",
    strategyParams: strategyParams || {},
    orderQuantity: Number(orderQuantity) || 1,
  };

  // If the caller provided a key explicitly (e.g. from key creation / custom input)
  if (typeof apiKey === "string" && apiKey.trim().length > 0) {
    try {
      const res = await fetch(`${API_BASE}/v1/trading/paper/simulate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey.trim(),
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
        signal: AbortSignal.timeout(25_000),
      });

      const data = await res.json().catch(() => ({ ok: false, error: "bad_upstream_response" }));
      audit(g.session, "trading.simulate", { status: res.status, instrument: instrumentId });
      return NextResponse.json(data, { status: res.status });
    } catch (err) {
      return NextResponse.json(
        {
          ok: false,
          error: "service_unavailable",
          message: err instanceof Error ? err.message : "Trading simulation service unreachable",
          disclaimer: "SIMULATED_PAPER_EXECUTION: NOT_ACTUAL_RETURNS",
        },
        { status: 503 },
      );
    }
  }

  // Account-backed keys (CONSOLE_ACCOUNTS_V1)
  if (accountsEnabled()) {
    try {
      const raw = await meRaw("POST", "/trading/paper/simulate", { ...payload, keyId });
      audit(g.session, "me.trading.simulate", { status: raw.status, instrument: instrumentId });
      return NextResponse.json(raw.body, { status: raw.status });
    } catch (err) {
      return NextResponse.json(
        {
          ok: false,
          error: "service_unavailable",
          message: err instanceof Error ? err.message : "Trading simulation service unreachable",
          disclaimer: "SIMULATED_PAPER_EXECUTION: NOT_ACTUAL_RETURNS",
        },
        { status: 503 },
      );
    }
  }

  // Legacy cookie-held keys
  const active = await getActiveKey();
  if (!active) {
    return NextResponse.json(
      {
        ok: false,
        error: "payment_required",
        code: 402,
        message: "No active API key connected. Create an API key and fund it with USDT credits to run simulations ($0.05/run).",
        price_usdt: 0.05,
        disclaimer: "SIMULATED_PAPER_EXECUTION: NOT_ACTUAL_RETURNS",
      },
      { status: 402 },
    );
  }

  try {
    const res = await fetch(`${API_BASE}/v1/trading/paper/simulate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": active.k,
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });

    const data = await res.json().catch(() => ({ ok: false, error: "bad_upstream_response" }));
    audit(g.session, "trading.simulate", { status: res.status, instrument: instrumentId });
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: "service_unavailable",
        message: err instanceof Error ? err.message : "Trading simulation service unreachable",
        disclaimer: "SIMULATED_PAPER_EXECUTION: NOT_ACTUAL_RETURNS",
      },
      { status: 503 },
    );
  }
}
