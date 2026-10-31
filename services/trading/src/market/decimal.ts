/**
 * Exact decimal-string ↔ integer-minor-unit conversion.
 *
 * Provider payloads carry prices as JSON numbers or strings. They are kept as
 * decimal strings (see lossless-json.ts) and converted here with integer math
 * only. A JS float never touches a price.
 */

export type DecimalRounding = 'HALF_EVEN' | 'DOWN' | 'EXACT';

const DECIMAL_RE = /^([+-]?)(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$|^([+-]?)\.(\d+)(?:[eE]([+-]?\d+))?$/;

export class DecimalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DecimalError';
  }
}

/** Parse a decimal string into { units, scale } so that value = units / 10^scale. */
export function parseDecimalString(raw: string): { units: bigint; scale: number } {
  if (typeof raw !== 'string') throw new DecimalError(`decimal must be a string, got ${typeof raw}`);
  const s = raw.trim();
  const m = DECIMAL_RE.exec(s);
  if (!m) throw new DecimalError(`not a decimal: '${raw.slice(0, 40)}'`);
  const sign = (m[1] ?? m[5]) === '-' ? -1n : 1n;
  const intPart = m[2] ?? '0';
  const fracPart = m[3] ?? m[6] ?? '';
  const exp = Number(m[4] ?? m[7] ?? '0');
  if (!Number.isSafeInteger(exp) || Math.abs(exp) > 400) throw new DecimalError(`exponent out of range: '${raw.slice(0, 40)}'`);
  let units = BigInt(intPart + fracPart) * sign;
  let scale = fracPart.length - exp;
  if (scale < 0) {
    units *= 10n ** BigInt(-scale);
    scale = 0;
  }
  return { units, scale };
}

/**
 * Convert a decimal string to integer minor units at `precision` decimal places.
 * HALF_EVEN (default) rounds banker-style; DOWN truncates toward zero; EXACT throws
 * if any precision would be lost.
 */
export function decimalToMinor(raw: string, precision: number, rounding: DecimalRounding = 'HALF_EVEN'): bigint {
  if (!Number.isInteger(precision) || precision < 0 || precision > 36) throw new DecimalError(`bad precision ${precision}`);
  const { units, scale } = parseDecimalString(raw);
  if (scale <= precision) return units * 10n ** BigInt(precision - scale);
  const div = 10n ** BigInt(scale - precision);
  const q = units / div; // truncates toward zero
  const r = units % div;
  if (r === 0n) return q;
  if (rounding === 'EXACT') throw new DecimalError(`'${raw.slice(0, 40)}' has more than ${precision} decimals`);
  if (rounding === 'DOWN') return q;
  const absR2 = (r < 0n ? -r : r) * 2n;
  const away = units < 0n ? -1n : 1n;
  if (absR2 > div) return q + away;
  if (absR2 < div) return q;
  return q % 2n === 0n ? q : q + away;
}

/** Format integer minor units as a plain decimal string (no exponent). */
export function minorToDecimal(minor: bigint, precision: number): string {
  const neg = minor < 0n;
  const abs = neg ? -minor : minor;
  if (precision === 0) return `${neg ? '-' : ''}${abs}`;
  const f = 10n ** BigInt(precision);
  return `${neg ? '-' : ''}${abs / f}.${(abs % f).toString().padStart(precision, '0')}`;
}

/** Number of decimal places of a canonical step string such as '0.00001000' → 5. */
export function stepDecimals(step: string): number {
  const { units, scale } = parseDecimalString(step);
  if (units <= 0n) throw new DecimalError(`step must be positive: '${step}'`);
  let s = scale;
  let u = units;
  while (s > 0 && u % 10n === 0n) {
    u /= 10n;
    s -= 1;
  }
  return s;
}
