/**
 * @satelink/trading — parseDecimalToMinor tests
 * Verifies no float is used; all arithmetic is integer.
 */
import { describe, it, expect } from 'vitest';
import { parseDecimalToMinor } from '../market/binance-data-provider.js';

describe('parseDecimalToMinor', () => {
  it('parses integer price with precision 2', () => {
    expect(parseDecimalToMinor('42000', 2)).toBe(4200000n);
  });

  it('parses decimal price with precision 2', () => {
    expect(parseDecimalToMinor('42000.53', 2)).toBe(4200053n);
  });

  it('parses price with fewer decimals than precision', () => {
    // '42000.5' with precision 2 → '42000.50' → 4200050
    expect(parseDecimalToMinor('42000.5', 2)).toBe(4200050n);
  });

  it('parses price with more decimals than precision (truncates)', () => {
    // '42000.539' with precision 2 → truncates frac to '53' → 4200053
    expect(parseDecimalToMinor('42000.539', 2)).toBe(4200053n);
  });

  it('parses zero', () => {
    expect(parseDecimalToMinor('0', 2)).toBe(0n);
  });

  it('parses zero with decimal', () => {
    expect(parseDecimalToMinor('0.00', 2)).toBe(0n);
  });

  it('handles precision 8 (BTC-style)', () => {
    expect(parseDecimalToMinor('1.00000001', 8)).toBe(100000001n);
  });

  it('throws on empty string', () => {
    expect(() => parseDecimalToMinor('', 2)).toThrow();
  });

  it('throws on non-string input', () => {
    expect(() => parseDecimalToMinor(42 as unknown as string, 2)).toThrow();
  });
});
