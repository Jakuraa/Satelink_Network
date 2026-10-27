import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../src/app/api/console/payments/[...path]/route";
import * as sessionModule from "@/lib/session";
import * as paymentsModule from "@/lib/payments";

describe("Console Payments Methods Proxy — GET /api/console/payments/[...path]", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects unauthenticated requests with 401", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue(null);

    const req = new Request("http://localhost/api/console/payments/checkout/methods");
    const ctx = { params: Promise.resolve({ path: ["checkout", "methods"] }) };
    const res = await GET(req, ctx);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toEqual({ ok: false, error: "unauthenticated" });
  });

  it("rejects paths not in the allowlist with 404 not_allowed", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue({ id: "user_1" } as any);

    const req = new Request("http://localhost/api/console/payments/checkout/forbidden");
    const ctx = { params: Promise.resolve({ path: ["checkout", "forbidden"] }) };
    const res = await GET(req, ctx);

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json).toEqual({ ok: false, error: "not_allowed" });
  });

  it("calls loadMethods() rather than loadIntent('methods') for GET /checkout/methods", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue({ id: "user_1" } as any);
    const loadMethodsSpy = vi.spyOn(paymentsModule, "loadMethods").mockResolvedValue({
      ok: true,
      data: {
        testMode: true,
        methods: [
          { id: "payram_usdt", adapter: "payram", currency: "USD", network: "tron" },
          { id: "usdt_polygon", adapter: "onchain-native", currency: "USDT", network: "polygon" },
        ],
      },
    });
    const loadIntentSpy = vi.spyOn(paymentsModule, "loadIntent");

    const req = new Request("http://localhost/api/console/payments/checkout/methods");
    const ctx = { params: Promise.resolve({ path: ["checkout", "methods"] }) };
    const res = await GET(req, ctx);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.testMode).toBe(true);
    expect(json.data.methods).toHaveLength(2);

    expect(loadMethodsSpy).toHaveBeenCalledTimes(1);
    expect(loadIntentSpy).not.toHaveBeenCalled();
  });

  it("forwards loadMethods() failure with appropriate error status", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue({ id: "user_1" } as any);
    vi.spyOn(paymentsModule, "loadMethods").mockResolvedValue({
      ok: false,
      status: 503,
      error: "service_unavailable",
    } as any);

    const req = new Request("http://localhost/api/console/payments/checkout/methods");
    const ctx = { params: Promise.resolve({ path: ["checkout", "methods"] }) };
    const res = await GET(req, ctx);

    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json).toEqual({ ok: false, error: "service_unavailable" });
  });

  it("routes intent references to loadIntent(ref)", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue({ id: "user_1" } as any);
    const loadMethodsSpy = vi.spyOn(paymentsModule, "loadMethods");
    const loadIntentSpy = vi.spyOn(paymentsModule, "loadIntent").mockResolvedValue({
      ok: true,
      data: {
        canonicalRef: "inv_abcdef12345678",
        planId: "trading_ai_pro",
        status: "pending",
        amount: { amountMinor: "1900", currency: "USD", display: "19.00" },
        network: null,
        expiresAt: null,
        updatedAt: new Date().toISOString(),
        entitlement: { planId: "trading_ai_pro", periodEnd: null, inGrace: false },
        receiptReady: false,
        merchant: {} as any,
        refundPolicy: {} as any,
      },
    });

    const req = new Request("http://localhost/api/console/payments/checkout/intents/inv_abcdef12345678");
    const ctx = { params: Promise.resolve({ path: ["checkout", "intents", "inv_abcdef12345678"] }) };
    const res = await GET(req, ctx);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.canonicalRef).toBe("inv_abcdef12345678");

    expect(loadIntentSpy).toHaveBeenCalledWith("inv_abcdef12345678");
    expect(loadMethodsSpy).not.toHaveBeenCalled();
  });
});
