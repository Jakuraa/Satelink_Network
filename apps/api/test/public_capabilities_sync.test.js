// apps/api/test/public_capabilities_sync.test.js — Release A P5. The website's capability list must equal what the
// registry produces now (regenerate: node scripts/preview/generate-public-capabilities.mjs), and must stay customer-safe.
import { expect } from 'chai';
import { readFileSync } from 'node:fs';
import { buildPublicCapabilities } from '../src/workflows/public_capabilities.js';

const file = new URL('../../web/src/content/preview-capabilities.generated.json', import.meta.url);

describe('public capability list (website) is generated from the registry', () => {
  it('the committed file matches the registry', async () => {
    expect(JSON.parse(readFileSync(file, 'utf8'))).to.deep.equal(await buildPublicCapabilities());
  });
  it('is labelled and leaks nothing internal', async () => {
    const doc = await buildPublicCapabilities();
    expect(doc).to.include({ simulated: true, simulation_label: 'SIMULATED — NO MONEY MOVED', fees_status: 'PROPOSED — NOT APPROVED' });
    expect(doc.capabilities.map((c) => c.id)).to.include.members(['shop.digital_goods.purchase', 'food.order.place', 'trading.strategy.evaluate', 'dev.data.extract']);
    const text = JSON.stringify(doc);
    expect(text).not.to.match(/eulerpool|ai\.model\.inference|connector|rest_openapi|mcp_food|internal_only|binance|space command|freetier/i);
    for (const c of doc.capabilities) expect(c.release_status, c.id).to.match(/^(SIMULATED|PREVIEW|COMING_SOON)$/);
  });
});
