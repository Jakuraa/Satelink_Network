// Provider-reported cost → integer micro-USD (1 USD = 1_000_000 micro). Money is bigint in integer
// minor units, never a float (libs invariant #2). The provider's decimal is converted digit by digit
// from the shortest round-trip text of the parsed number (or from a decimal string as given), with
// integer arithmetic only. A JSON number has already been parsed to a double, so digits beyond ~17
// significant figures are not recoverable; for provider costs that is far below one micro-USD.
//
// Rounding: UP to the next whole micro-USD. This records what Satelink paid, and the conservative
// direction for a cost is never to under-record it (a 0.0000004 USD call costs 1 micro, not 0).

export const MICRO_PER_USD = 1_000_000n;
const MICRO_DIGITS = 6;

const DECIMAL_RE = /^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i;

/**
 * @returns the cost in micro-USD, or null when the provider did not report a usable cost
 *          (absent, negative, non-finite, or not a number/decimal string). Never estimated.
 */
export function usdToMicroUsd(value: unknown): bigint | null {
  let text: string;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return null;
    text = String(value); // shortest round-trip form, e.g. "0.000123" or "1.5e-7"
  } else if (typeof value === 'string') {
    text = value.trim();
  } else {
    return null;
  }
  const m = DECIMAL_RE.exec(text);
  if (!m) return null;
  const intPart = m[1] ?? '0';
  const fracPart = m[2] ?? '';
  const exp = Number.parseInt(m[3] ?? '0', 10);
  if (!Number.isSafeInteger(exp) || Math.abs(exp) > 400) return null;

  // value = digits × 10^(exp − fracPart.length); in micro: digits × 10^(exp − fracPart.length + 6)
  const digits = BigInt(intPart + fracPart);
  const shift = exp - fracPart.length + MICRO_DIGITS;
  if (shift >= 0) return digits * 10n ** BigInt(shift);
  const div = 10n ** BigInt(-shift);
  const q = digits / div;
  return digits % div === 0n ? q : q + 1n; // ceil for non-negative values
}
