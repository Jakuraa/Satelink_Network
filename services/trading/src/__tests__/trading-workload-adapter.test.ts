/**
 * @satelink/trading — TradingWorkloadAdapter unit tests
 */
import { describe, it, expect } from 'vitest';
import { TradingWorkloadAdapter } from '../workload/trading-workload-adapter.js';
import { RiskAuthorizationEngine } from '../risk/authorization.js';
import { PaperBrokerAdapter } from '../execution/paper-broker.js';
import { FinancialOSMetering } from '../financial/metering.js';

describe('TradingWorkloadAdapter', () => {
  const riskEngine = new RiskAuthorizationEngine();
  const broker = new PaperBrokerAdapter();
  const metering = new FinancialOSMetering();

  const adapter = new TradingWorkloadAdapter(riskEngine, broker, metering);

  it('exposes compliant WorkloadCapabilities matching kernel contracts', () => {
    const caps = adapter.capabilities();
    expect(caps.key).toBe('trading');
    expect(caps.resourceTypes).toContain('crypto');
    expect(caps.resourceTypes).toContain('equity');
    expect(caps.settlementMode).toBe('POST');
    expect(caps.executionSafety).toBe('IDEMPOTENT');
  });

  it('discovers supplier candidates', async () => {
    const candidates = await adapter.discover();
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.some((c) => c.venue === 'PAPER')).toBe(true);
    expect(candidates.some((c) => c.venue === 'BINANCE')).toBe(true);
  });

  it('probes a supplier candidate successfully', async () => {
    const candidate = (await adapter.discover())[0]!;
    const probeRes = await adapter.probe(candidate);
    expect(probeRes.ok).toBe(true);
    expect(probeRes.latencyMs).toBeGreaterThan(0);
  });

  it('quotes fee accurately for trade request', async () => {
    const candidate = (await adapter.discover())[0]!;
    const quote = await adapter.quote(
      {
        instrumentId: 'BINANCE:BTCUSDT',
        side: 'BUY',
        quantity: 2,
        estimatedPriceMinor: 50_000_00n, // $50,000
      },
      candidate,
    );

    // notional = 2 * 50,000,00 = 100,000,00 ($100k)
    // 10 bps fee = 100,00 ($100)
    expect(quote.estimatedNotionalMinor).toBe('10000000');
    expect(quote.estimatedPlatformFeeMinor).toBe('10000');
    expect(quote.supplierId).toBe(candidate.supplierId);
  });

  it('executes a market order via paper execution and returns status', async () => {
    const candidate = (await adapter.discover())[0]!;
    broker.setMarketPrice('BINANCE:BTCUSDT', 65_000_00n);

    const execRes = await adapter.execute(
      {
        payload: {
          idempotencyKey: 'workload-idem-1',
          instrumentId: 'BINANCE:BTCUSDT',
          exchange: 'BINANCE',
          side: 'BUY',
          orderType: 'MARKET',
          quantity: 1,
        },
      },
      candidate,
    );

    expect(execRes.success).toBe(true);
    expect(execRes.status).toBe('FILLED');
    expect(execRes.filledQuantity).toBe(1);
    expect(execRes.filledPriceMinor).toBe('6500000');
  });
});
