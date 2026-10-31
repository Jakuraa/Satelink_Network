/**
 * Opt-in live Eulerpool contract check. Excluded from CI: runs only with
 * EULERPOOL_LIVE=1 and EULERPOOL_API_KEY set. Uses 1 request. Prints status and
 * latency only — never the key, the URL with credentials, or the data.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { EulerpoolResearchProvider, EulerpoolError, eulerpoolEquityInstrument } from '../market/eulerpool-provider.js';
import { validateLicenceEvidence } from '../market/licensing.js';

const LIVE = process.env['EULERPOOL_LIVE'] === '1' && !!process.env['EULERPOOL_API_KEY'];

describe.skipIf(!LIVE)('Eulerpool live (opt-in)', () => {
  it('daily bars for AAPL parse under the recorded contract', async () => {
    const evidence = validateLicenceEvidence(
      JSON.parse(readFileSync(fileURLToPath(new URL('../../../../docs/build/evidence/licences/eulerpool.json', import.meta.url)), 'utf8')),
      'eulerpool',
    );
    const p = new EulerpoolResearchProvider({ apiKey: process.env['EULERPOOL_API_KEY'], licenceEvidence: evidence, maxRetries: 0 });
    const t0 = Date.now();
    let status = 'OK';
    let bars = 0;
    try {
      const to = new Date();
      bars = (await p.dailyBars(eulerpoolEquityInstrument('AAPL'), { from: new Date(to.getTime() - 14 * 86_400_000), to }, { use: 'INTERNAL_RESEARCH' })).length;
    } catch (e) {
      status = e instanceof EulerpoolError ? `${e.code}${e.details.status ? ` HTTP ${e.details.status}` : ''}` : 'ERROR';
    }
    console.log(JSON.stringify({ eulerpoolLive: { status, latencyMs: Date.now() - t0, bars } }));
    expect(status).toBe('OK');
    expect(bars).toBeGreaterThan(0);
  }, 30_000);
});
