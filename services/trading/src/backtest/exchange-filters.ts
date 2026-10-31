/**
 * Binance spot symbol filters (PRICE_FILTER, LOT_SIZE, MIN_NOTIONAL/NOTIONAL) in bigint.
 *
 * Prices are integer minor units at the instrument's pricePrecision. Quantities are
 * integer "atoms" at QTY_DECIMALS (8, Binance's base-asset precision for BTC/ETH).
 * Ported from the #492 exchange_info mapping (trading-agent/integration) onto the
 * main-branch types; no float anywhere.
 */
import { decimalToMinor } from '../market/decimal.js';

export const QTY_DECIMALS = 8;
export const QTY_SCALE = 10n ** BigInt(QTY_DECIMALS);

/** Filter values as published by exchangeInfo (decimal strings). */
export interface SymbolFilterSpec {
  readonly symbol: string;
  readonly tickSize: string;
  readonly stepSize: string;
  readonly minQty: string;
  readonly maxQty?: string;
  readonly minNotional: string;
}

export interface SymbolFilters {
  readonly symbol: string;
  readonly pricePrecision: number;
  readonly tickMinor: bigint;
  readonly stepAtoms: bigint;
  readonly minQtyAtoms: bigint;
  readonly maxQtyAtoms: bigint | null;
  readonly minNotionalMinor: bigint;
}

export class FilterError extends Error {
  constructor(readonly filter: 'PRICE_FILTER' | 'LOT_SIZE' | 'MIN_NOTIONAL', message: string) {
    super(`${filter}: ${message}`);
    this.name = 'FilterError';
  }
}

export function compileFilters(spec: SymbolFilterSpec, pricePrecision: number): SymbolFilters {
  // A tick finer than the instrument precision collapses to 1 minor unit.
  const tick = decimalToMinor(spec.tickSize, pricePrecision, 'DOWN');
  const f: SymbolFilters = {
    symbol: spec.symbol,
    pricePrecision,
    tickMinor: tick > 0n ? tick : 1n,
    stepAtoms: decimalToMinor(spec.stepSize, QTY_DECIMALS, 'EXACT'),
    minQtyAtoms: decimalToMinor(spec.minQty, QTY_DECIMALS, 'EXACT'),
    maxQtyAtoms: spec.maxQty ? decimalToMinor(spec.maxQty, QTY_DECIMALS, 'EXACT') : null,
    minNotionalMinor: decimalToMinor(spec.minNotional, pricePrecision, 'HALF_EVEN'),
  };
  if (f.stepAtoms <= 0n) throw new FilterError('LOT_SIZE', 'stepSize must be positive');
  return Object.freeze(f);
}

/** Round a price to the tick grid: up for buys (worse), down for sells (worse). */
export function roundPriceToTick(priceMinor: bigint, f: SymbolFilters, side: 'BUY' | 'SELL'): bigint {
  const r = priceMinor % f.tickMinor;
  if (r === 0n) return priceMinor;
  return side === 'BUY' ? priceMinor - r + f.tickMinor : priceMinor - r;
}

/** Round a quantity down to the LOT_SIZE step. */
export function roundQtyDown(qtyAtoms: bigint, f: SymbolFilters): bigint {
  return qtyAtoms - (qtyAtoms % f.stepAtoms);
}

/** Quote-currency notional in minor units (floor). */
export function notionalMinor(qtyAtoms: bigint, priceMinor: bigint): bigint {
  return (qtyAtoms * priceMinor) / QTY_SCALE;
}

/** Throws FilterError if the order would be rejected by the exchange. */
export function validateOrder(qtyAtoms: bigint, priceMinor: bigint, f: SymbolFilters): void {
  if (priceMinor <= 0n || priceMinor % f.tickMinor !== 0n) throw new FilterError('PRICE_FILTER', `price ${priceMinor} not on tick ${f.tickMinor}`);
  if (qtyAtoms < f.minQtyAtoms) throw new FilterError('LOT_SIZE', `qty ${qtyAtoms} < minQty ${f.minQtyAtoms}`);
  if (f.maxQtyAtoms !== null && qtyAtoms > f.maxQtyAtoms) throw new FilterError('LOT_SIZE', `qty ${qtyAtoms} > maxQty ${f.maxQtyAtoms}`);
  if (qtyAtoms % f.stepAtoms !== 0n) throw new FilterError('LOT_SIZE', `qty ${qtyAtoms} not on step ${f.stepAtoms}`);
  const n = notionalMinor(qtyAtoms, priceMinor);
  if (n < f.minNotionalMinor) throw new FilterError('MIN_NOTIONAL', `notional ${n} < ${f.minNotionalMinor}`);
}

/** Binance spot filters for the demo symbols (exchangeInfo values; re-fetched before live use). */
export const DEFAULT_SPOT_FILTERS: Readonly<Record<string, SymbolFilterSpec>> = Object.freeze({
  BTCUSDT: { symbol: 'BTCUSDT', tickSize: '0.01', stepSize: '0.00001', minQty: '0.00001', maxQty: '9000', minNotional: '5' },
  ETHUSDT: { symbol: 'ETHUSDT', tickSize: '0.01', stepSize: '0.0001', minQty: '0.0001', maxQty: '9000', minNotional: '5' },
});
