/**
 * Demo trading mandate — founder-signed, scoped, expiring authorization for the
 * Binance Spot Demo forward test.
 *
 * A mandate is valid only if ALL hold:
 *   - Ed25519 signature over the canonical JSON of every field except `signature`,
 *     by a key in the injected trusted-key set (the founder's public key);
 *   - now ∈ [validFrom, expiresAt) and not revoked;
 *   - venue BINANCE_SPOT_DEMO, spot only;
 *   - its limits are within the hard demo ceiling below (a mandate can only narrow them).
 *
 * The hard ceiling is the founder's demo limits (2026-10-31): BTCUSDT/ETHUSDT, ≤ 100 USDT
 * notional per order, ≤ 3 open positions, ≤ 50 USDT daily loss, spot only.
 */
import { createPublicKey, verify } from 'node:crypto';
import { canonicalJson } from '../backtest/evaluation.js';
export const DEMO_CEILING = Object.freeze({
    venue: 'BINANCE_SPOT_DEMO',
    currency: 'USDT',
    instrumentIds: Object.freeze(['BINANCE:BTCUSDT', 'BINANCE:ETHUSDT']),
    maxOrderNotionalMinor: 10000n, // 100.00 USDT
    maxOpenPositions: 3,
    maxDailyLossMinor: 5000n, // 50.00 USDT
});
/** The exact bytes that are signed: canonical JSON without the signature field. */
export function mandateSigningPayload(m) {
    const { signature: _omit, ...rest } = m;
    return canonicalJson(rest);
}
export function verifyDemoMandate(m, keys, now) {
    if (!m)
        return { ok: false, reason: 'no demo mandate' };
    const key = keys.get(m.keyId);
    if (!key)
        return { ok: false, reason: `mandate key '${m.keyId}' is not trusted` };
    let sigOk = false;
    try {
        const pub = typeof key === 'string' ? createPublicKey(key) : key;
        if (pub.asymmetricKeyType !== 'ed25519')
            return { ok: false, reason: 'trusted mandate key is not Ed25519' };
        sigOk = verify(null, Buffer.from(mandateSigningPayload(m), 'utf8'), pub, Buffer.from(m.signature, 'base64'));
    }
    catch {
        sigOk = false;
    }
    if (!sigOk)
        return { ok: false, reason: 'mandate signature invalid' };
    if (m.revoked)
        return { ok: false, reason: 'mandate revoked' };
    const t = now.getTime();
    if (!(Date.parse(m.validFrom) <= t))
        return { ok: false, reason: `mandate not yet valid (from ${m.validFrom})` };
    if (!(t < Date.parse(m.expiresAt)))
        return { ok: false, reason: `mandate expired ${m.expiresAt}` };
    const s = m.scope;
    if (s.venue !== DEMO_CEILING.venue || s.spotOnly !== true || s.currency !== DEMO_CEILING.currency)
        return { ok: false, reason: 'mandate scope must be Binance Spot Demo, spot only, USDT' };
    if (s.instrumentIds.length === 0 || !s.instrumentIds.every((i) => DEMO_CEILING.instrumentIds.includes(i)))
        return { ok: false, reason: 'mandate instruments outside the demo ceiling' };
    if (s.maxOrderNotionalMinor <= 0n || s.maxOrderNotionalMinor > DEMO_CEILING.maxOrderNotionalMinor)
        return { ok: false, reason: 'mandate per-order notional outside the demo ceiling' };
    if (!Number.isInteger(s.maxOpenPositions) || s.maxOpenPositions < 1 || s.maxOpenPositions > DEMO_CEILING.maxOpenPositions)
        return { ok: false, reason: 'mandate open-position limit outside the demo ceiling' };
    if (s.maxDailyLossMinor <= 0n || s.maxDailyLossMinor > DEMO_CEILING.maxDailyLossMinor)
        return { ok: false, reason: 'mandate daily-loss limit outside the demo ceiling' };
    return { ok: true, reason: `mandate ${m.mandateId} active until ${m.expiresAt}` };
}
//# sourceMappingURL=demo-mandate.js.map