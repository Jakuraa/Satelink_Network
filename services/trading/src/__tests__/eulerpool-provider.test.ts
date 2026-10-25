/**
 * @satelink/trading — EulerpoolResearchProvider tests
 * Verifies commercial licensing gates and research interface typing.
 */
import { describe, it, expect } from 'vitest';
import { EulerpoolResearchProvider } from '../market/eulerpool-provider.js';

describe('EulerpoolResearchProvider', () => {
  it('declares unconfirmed commercial licensing status by default', () => {
    const provider = new EulerpoolResearchProvider();
    expect(provider.isCommerciallyApproved()).toBe(false);
    expect(provider.licensing.commercialLicense).toBe(false);
    expect(provider.licensing.licenseEvidence).toBeNull();
    expect(provider.licensing.redistributionPermitted).toBe(false);
  });

  it('strictly blocks commercial production queries without confirmed license', async () => {
    const provider = new EulerpoolResearchProvider();
    await expect(provider.getFundamentals('AAPL')).rejects.toThrow(
      /COMMERCIAL USE BLOCKED: Eulerpool Builder is unconfirmed for commercial use/
    );
  });

  it('allows research evaluation mode with mocked fetch', async () => {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        peRatio: 28.5,
        pbRatio: 8.2,
        marketCap: 3000000000000, // $3T
        divYieldBps: 55, // 0.55%
      }),
    });

    const provider = new EulerpoolResearchProvider({ fetch: mockFetch });
    const metrics = await provider.getFundamentals('AAPL', { allowResearchEvaluation: true });

    expect(metrics.symbol).toBe('AAPL');
    expect(metrics.peRatio).toBe(28.5);
    expect(metrics.pbRatio).toBe(8.2);
    expect(metrics.marketCapUsdMinor).toBe(300000000000000n);
    expect(metrics.dividendYieldBps).toBe(55n);
    expect(metrics.retrievedAt).toBeDefined();
  });
});
