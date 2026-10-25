import { apiFetch } from "./api";

export type TradingDiscovery = {
  ok: boolean;
  service: string;
  mode: string;
  pricing_model: string;
  price_usdt: number;
  currency: string;
  supported_instruments: string[];
  supported_strategies: string[];
  disclaimer: string;
  payment?: {
    how_to_pay: { rail: string; description: string; resource?: string; discovery?: string; initiate?: string }[];
  };
  note?: string;
};

export type SimulationReceipt = {
  revenue_request_id: string;
  amount_usdt: number;
  recorded: boolean;
};

export type SimulationReport = {
  ok: boolean;
  error?: string;
  code?: number;
  message?: string;
  disclaimer: string;
  service?: string;
  billed_usdt?: number;
  price_usdt?: number;
  tier?: string;
  idempotency_key?: string;
  instrument_id?: string;
  strategy?: string;
  revenue_receipt?: SimulationReceipt | null;
  simulation?: {
    workflow_id: string;
    executed_at: string;
    status: string;
    summary: string;
    market_data?: {
      source?: string;
      freshness?: string;
      data_age_sec?: number;
      licensing_valid?: boolean;
    };
    strategy_baseline?: {
      type?: string;
      parameters?: Record<string, unknown>;
    };
    model_proposal?: {
      signal?: string;
      confidence?: number;
      rationale?: string;
      risks?: string[];
    };
    consensus?: Record<string, unknown>;
    risk_authorization?: {
      authorized?: boolean;
      passed_gates?: string[];
      failed_gate?: string | null;
      reason?: string | null;
    };
    order_execution?: {
      order_id?: string;
      status?: string;
      side?: string;
      price?: string;
      quantity?: number;
    };
    financial_settlement?: {
      revenueRequestId?: string;
      platformFeeMinor?: string;
      currency?: string;
    };
  };
};

export const FALLBACK_DISCOVERY: TradingDiscovery = {
  ok: true,
  service: "Satelink Multi-Market Trading AI — Paper Simulation",
  mode: "SIMULATED_PAPER_EXECUTION",
  pricing_model: "pay_per_simulation_credits",
  price_usdt: 0.05,
  currency: "USDT",
  supported_instruments: ["BINANCE:BTCUSDT", "PAPER:BTCUSDT", "NSE:NIFTY50"],
  supported_strategies: ["sma-crossover"],
  disclaimer: "SIMULATED_PAPER_EXECUTION: NOT_ACTUAL_RETURNS",
  payment: {
    how_to_pay: [
      {
        rail: "usdt_deposit",
        description: "Deposit USDT on Polygon to your registered wallet; credits auto-apply.",
      },
      {
        rail: "x402",
        description: "Pay the x402 bundle (USDC on Base). Credits auto-fund paper simulation calls.",
      },
    ],
  },
  note: "Simulated execution for strategy testing and audit. Live trading remains disabled.",
};

/** Load canonical trading simulation discovery from the API. */
export async function loadTradingDiscovery(): Promise<TradingDiscovery> {
  const res = await apiFetch<TradingDiscovery>("/v1/trading/paper/simulate", { revalidate: 30 });
  if (res.ok && res.data) return res.data;
  return FALLBACK_DISCOVERY;
}
