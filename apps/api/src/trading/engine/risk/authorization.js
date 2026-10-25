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
    LIMIT: 'LIMIT',
});
export const OrderSide = Object.freeze({
    BUY: 'BUY',
    SELL: 'SELL',
});
const GATES = [
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
            if (!i.account.eligible)
                return 'Account is not eligible for trading';
            if (!i.account.eligibleMarkets.includes(i.orderIntent.exchange))
                return `Account not eligible for exchange '${i.orderIntent.exchange}'`;
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
            if (!i.approvedInstruments.has(i.orderIntent.instrumentId))
                return `Instrument '${i.orderIntent.instrumentId}' is not approved`;
            if (i.orderIntent.orderType === OrderType.LIMIT && i.orderIntent.limitPriceMinor == null)
                return 'LIMIT order missing limitPriceMinor';
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
            if (i.currentPositionCount >= i.limits.maxPositionCount)
                return `Position count limit reached (${i.currentPositionCount}/${i.limits.maxPositionCount})`;
            if (i.currentExposureMinor + i.orderValueMinor > i.limits.maxExposureMinor)
                return `Exposure limit would be breached`;
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
export class RiskAuthorizationEngine {
    authorize(input) {
        const evaluatedAt = new Date().toISOString();
        const passed = [];
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
//# sourceMappingURL=authorization.js.map