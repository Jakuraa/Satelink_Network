/**
 * @satelink/trading — exact decimal and lossless JSON helpers.
 */
import { describe, it, expect } from 'vitest';
import { decimalToMinor, minorToDecimal, stepDecimals, DecimalError } from '../market/decimal.js';
import { parseLosslessJson, JsonNumber, LosslessJsonError } from '../market/lossless-json.js';

describe('decimalToMinor', () => {
  it('converts exactly, including values a float path corrupts', () => {
    expect(decimalToMinor('0.1', 2)).toBe(10n);
    expect(decimalToMinor('1.005', 3)).toBe(1005n);
    expect(decimalToMinor('183.0897', 4)).toBe(1830897n);
    expect(decimalToMinor('68123.45000000', 2)).toBe(6812345n);
    expect(decimalToMinor('1.5e2', 2)).toBe(15000n);
    expect(decimalToMinor('-12.21', 2)).toBe(-1221n);
    expect(decimalToMinor('.5', 1)).toBe(5n);
  });
  it('rounds half-even by default, truncates with DOWN, refuses loss with EXACT', () => {
    expect(decimalToMinor('0.125', 2)).toBe(12n);
    expect(decimalToMinor('0.135', 2)).toBe(14n);
    expect(decimalToMinor('-0.135', 2)).toBe(-14n);
    expect(decimalToMinor('0.129', 2, 'DOWN')).toBe(12n);
    expect(() => decimalToMinor('0.129', 2, 'EXACT')).toThrow(DecimalError);
  });
  it('rejects non-decimals', () => {
    for (const bad of ['', 'NaN', '1,0', '0x10', 'Infinity', '1.2.3']) expect(() => decimalToMinor(bad, 2)).toThrow(DecimalError);
  });
  it('formats and reads step sizes', () => {
    expect(minorToDecimal(-1221n, 2)).toBe('-12.21');
    expect(minorToDecimal(5n, 8)).toBe('0.00000005');
    expect(stepDecimals('0.00001000')).toBe(5);
    expect(stepDecimals('1.00000000')).toBe(0);
  });
});

describe('parseLosslessJson', () => {
  it('keeps every number as its source text', () => {
    const v = parseLosslessJson('{"a":0.30000000000000004,"b":[1e-7,12345678901234567890],"c":"x","d":null,"e":true}') as Record<string, unknown>;
    expect((v['a'] as JsonNumber).text).toBe('0.30000000000000004');
    expect((v['b'] as JsonNumber[]).map((n) => n.text)).toEqual(['1e-7', '12345678901234567890']);
    expect(v['c']).toBe('x');
    expect(v['d']).toBeNull();
    expect(v['e']).toBe(true);
  });
  it('handles escapes and rejects malformed or trailing input', () => {
    expect(parseLosslessJson('"a\\"b\\u0041"')).toBe('a"bA');
    for (const bad of ['{"a":1', '[1,]', '{"a" 1}', '1 2', '{"a":01}']) expect(() => parseLosslessJson(bad)).toThrow(LosslessJsonError);
  });
  it('does not allow prototype pollution through keys', () => {
    const v = parseLosslessJson('{"__proto__":{"polluted":true}}') as Record<string, unknown>;
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    expect(Object.getPrototypeOf(v)).toBeNull();
  });
});
