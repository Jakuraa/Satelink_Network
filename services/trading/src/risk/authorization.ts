/**
 * RiskAuthorizationEngine — deterministic pre-trade authorization.
 *
 * ALL checks are deterministic. No LLM. No I/O during checks (all data
 * is passed in; no network calls).
 *
 * Policy: every single gate must pass before authorization is granted.
 * ANY failure → rejected immediately with the first failing reason.
 *
 * MANDATORY CONTROLS (hard-coded, not configurable):
 *   G1  authenticated principal
 *   G2  explicit trading authorization
 *   G3  eligible account + market
 *   G4  fresh, validated data
 *   G5  approved instrument and order type
 *   G6  valid funds (sufficient balance)
 *   G7  position limit not exceeded
 *   G8  daily loss limit not hit
 *   G9  duplicate prevention (idempotency)
 *   G10 kill switch not engaged
 *
 * No gate can be disabled by configuration. Removing one requires a code
 * change with explicit founder review.
 */

export const POLICY_VERSION = '1.0.0';

export const OrderType = Object.freeze({
  MARKET: 'MARKET',
  LIMIT:  'LIMIT',
} as const);
export type OrderType = typeof OrderType[keyof typeof OrderType];

export const OrderSide = Object.freeze({
  BUY:  'BUY',
  SELL: 'SELL',
} as const);
export type OrderSide = typeof OrderSide[keyof typeof OrderSide];

export interface Principal {
  readonly id: string;
  readonly authenticated: boolean;
  readonly tradingAuthorized: boolean;
}

export interface TradingAccount {
  readonly id: string;
  /** Integer minor-units of account currency */
  readonly balanceMinor: bigint;
  readonly currency: string;
  readonly eligible: boolean;
  readonly eligibleMarkets: readonly string[]; // exchange names
}

export interface RiskLimits {
  /** Maximum number of open positions (per instrument). */
  readonly maxPositionCount: number;
  /** Maximum exposure in minor-units (total across all positions). */
  readonly maxExposureMinor: bigint;
  /** Maximum daily loss in minor-units. Positive number (loss is subtracted from baseline). */
  readonly maxDailyLossMinor: bigint;
  /** Optional per-order notional cap in minor-units (checked in G7). */
  readonly maxOrderNotionalMinor?: bigint | undefined;
}

export interface OrderIntent {
  /** Client-generated idempotency key. Must be unique per order attempt. */
  readonly idempotencyKey: string;
  readonly instrumentId: string;
  readonly exchange: string;
  readonly side: OrderSide;
  readonly orderType: OrderType;
  /** Quantity in instrument lots/shares (positive integer). 0 when the size is carried in quantityAtoms. */
  readonly quantity: number;
  /** Fractional (crypto) size in 10^-8 base-asset units, when lots do not apply. */
  readonly quantityAtoms?: bigint | undefined;
  /** Limit price in minor-units. Required for LIMIT orders. */
  readonly limitPriceMinor?: bigint | undefined;
}

export interface AuthorizationInput {
  readonly principal: Principal;
  readonly account: TradingAccount;
  readonly orderIntent: OrderIntent;
  readonly limits: RiskLimits;
  /** Data age in seconds. Must be within freshness threshold. */
  readonly dataAgeSeconds: number;
  readonly maxDataAgeSeconds: number;
  /** Approved instrument IDs. */
  readonly approvedInstruments: ReadonlySet<string>;
  /** Current open position count for this instrument. */
  readonly currentPositionCount: number;
  /** Current total exposure in minor-units. */
  readonly currentExposureMinor: bigint;
  /** Today's realized + unrealized loss in minor-units (positive = loss). */
  readonly todaysLossMinor: bigint;
  /** Has this idempotencyKey been seen before? */
  readonly isDuplicate: boolean;
  /** Is the kill switch engaged? */
  readonly killSwitchEngaged: boolean;
  /** Order value in minor-units (quantity × price). */
  readonly orderValueMinor: bigint;
}

export type AuthorizationGate = 'G1_PRINCIPAL' | 'G2_TRADING_AUTH' | 'G3_ACCOUNT_ELIGIBLE' | 'G4_DATA_FRESH' | 'G5_INSTRUMENT_APPROVED' | 'G6_FUNDS' | 'G7_POSITION_LIMIT' | 'G8_DAILY_LOSS' | 'G9_DUPLICATE' | 'G10_KILL_SWITCH';

export interface AuthorizationResult {
  readonly authorized: boolean;
  readonly policyVersion: string;
  readonly evaluatedAt: string;
  /** Gates that passed (in order). */
  readonly passed: readonly AuthorizationGate[];
  /** The gate that failed, or null if authorized. */
  readonly failedGate: AuthorizationGate | null;
  readonly reason: string | null;
}

type Gate = { gate: AuthorizationGate; check: (input: AuthorizationInput) => string | null };

const GATES: readonly Gate[] = [
  {
    gate: 'G1_PRINCIPAL',
    check: (i) => i.principal.authenticated ? null : 'No authenticated principal',
  },
  {
    gate: 'G2_TRADING_AUTH',
    check: (i) => i.principal.tradingAuthorized ? null : 'Principal has no explicit trading authorization',
  },
  {
    gate: 'G3_ACCOUNT_ELIGIBLE',
    check: (i) => {
      if (!i.account.eligible) return 'Account is not eligible for trading';
      if (!i.account.eligibleMarkets.includes(i.orderIntent.exchange)) return `Account not eligible for exchange '${i.orderIntent.exchange}'`;
      return null;
    },
  },
  {
    gate: 'G4_DATA_FRESH',
    check: (i) => i.dataAgeSeconds <= i.maxDataAgeSeconds ? null : `Market data is stale (${i.dataAgeSeconds}s > ${i.maxDataAgeSeconds}s)`,
  },
  {
    gate: 'G5_INSTRUMENT_APPROVED',
    check: (i) => {
      if (!i.approvedInstruments.has(i.orderIntent.instrumentId)) return `Instrument '${i.orderIntent.instrumentId}' is not approved`;
      if (i.orderIntent.orderType === OrderType.LIMIT && i.orderIntent.limitPriceMinor == null) return 'LIMIT order missing limitPriceMinor';
      return null;
    },
  },
  {
    gate: 'G6_FUNDS',
    check: (i) => i.account.balanceMinor >= i.orderValueMinor ? null : `Insufficient funds: need ${i.orderValueMinor}, have ${i.account.balanceMinor}`,
  },
  {
    gate: 'G7_POSITION_LIMIT',
    check: (i) => {
      if (i.currentPositionCount >= i.limits.maxPositionCount) return `Position count limit reached (${i.currentPositionCount}/${i.limits.maxPositionCount})`;
      if (i.limits.maxOrderNotionalMinor !== undefined && i.orderValueMinor > i.limits.maxOrderNotionalMinor) return `Order notional ${i.orderValueMinor} exceeds per-order limit ${i.limits.maxOrderNotionalMinor}`;
      if (i.currentExposureMinor + i.orderValueMinor > i.limits.maxExposureMinor) return `Exposure limit would be breached`;
      return null;
    },
  },
  {
    gate: 'G8_DAILY_LOSS',
    check: (i) => i.todaysLossMinor < i.limits.maxDailyLossMinor ? null : `Daily loss limit reached (${i.todaysLossMinor} >= ${i.limits.maxDailyLossMinor})`,
  },
  {
    gate: 'G9_DUPLICATE',
    check: (i) => i.isDuplicate ? `Duplicate order (idempotency key '${i.orderIntent.idempotencyKey}' already seen)` : null,
  },
  {
    gate: 'G10_KILL_SWITCH',
    check: (i) => i.killSwitchEngaged ? 'Kill switch is engaged — all trading halted' : null,
  },
];

export interface GateResult {
  readonly gate: AuthorizationGate;
  readonly passed: boolean;
  readonly reason: string | null;
}

export class RiskAuthorizationEngine {
  /**
   * Evaluate every gate (no short-circuit) for audit records. Authorization is
   * still all-or-nothing: authorized only when every gate passed.
   */
  evaluateAll(input: AuthorizationInput): { readonly authorized: boolean; readonly policyVersion: string; readonly gates: readonly GateResult[] } {
    const gates = GATES.map(({ gate, check }) => {
      const reason = check(input);
      return Object.freeze({ gate, passed: reason === null, reason });
    });
    return { authorized: gates.every((g) => g.passed), policyVersion: POLICY_VERSION, gates };
  }

  authorize(input: AuthorizationInput): AuthorizationResult {
    const evaluatedAt = new Date().toISOString();
    const passed: AuthorizationGate[] = [];

    for (const { gate, check } of GATES) {
      const reason = check(input);
      if (reason !== null) {
        return { authorized: false, policyVersion: POLICY_VERSION, evaluatedAt, passed, failedGate: gate, reason };
      }
      passed.push(gate);
    }

    return { authorized: true, policyVersion: POLICY_VERSION, evaluatedAt, passed, failedGate: null, reason: null };
  }
}
