// apps/api/test/capability_registry_unified.test.js — Release A P2.2 (unit; in-memory store).
// The Postgres-backed R9 test lives in database/__tests__/task_engine.integration.test.ts.
import { expect } from 'chai';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CapabilityRegistry, loadSeedEntries, validateEntry, customerView, entriesFromSupplierCatalog, EXECUTABLE_IN_PREVIEW,
} from '../src/workflows/capability_registry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'src');

describe('unified capability registry (P2.2)', () => {
  it('every seed entry validates and carries the mandate field set', () => {
    const entries = loadSeedEntries();
    expect(entries.length).to.be.greaterThan(3);
    for (const e of entries) expect(() => validateEntry(e)).not.to.throw();
    const ids = entries.map((e) => e.id);
    expect(ids).to.include('shop.digital_goods.purchase');
    expect(new Set(ids).size).to.equal(ids.length);
  });

  it('mock providers must be named "<name> (MOCK)"', () => {
    const e = structuredClone(loadSeedEntries().find((x) => x.id === 'shop.digital_goods.purchase'));
    e.providers[0].name = 'Demo Digital Store';
    expect(() => validateEntry(e)).to.throw(/\(MOCK\)/);
  });

  it('refuses unsupported schema keywords (never silently ignored)', () => {
    const e = structuredClone(loadSeedEntries()[0]);
    e.input_schema.oneOf = [];
    expect(() => validateEntry(e)).to.throw(/unsupported schema keyword/);
  });

  it('Eulerpool never reaches a customer surface (providers stripped; search/get exclude it)', async () => {
    const reg = new CapabilityRegistry(); await reg.seed();
    const candles = (await reg.all()).find((e) => e.id === 'market_data.candles');
    expect(candles.providers.some((p) => /eulerpool/i.test(p.name))).to.equal(true); // present internally
    const view = customerView(candles);
    expect(JSON.stringify(view)).to.not.match(/eulerpool/i);
    for (const e of await reg.search({ q: '' })) expect(JSON.stringify(e)).to.not.match(/eulerpool/i);
    expect(JSON.stringify(await reg.get('market_data.candles'))).to.not.match(/eulerpool/i);
  });

  it('internal entries are hidden from customers but available internally', async () => {
    const reg = new CapabilityRegistry(); await reg.seed();
    expect(await reg.get('ai.model.inference')).to.equal(null);
    expect((await reg.search({ q: 'model' })).map((e) => e.id)).to.not.include('ai.model.inference');
    expect((await reg.getInternal('ai.model.inference')).id).to.equal('ai.model.inference');
  });

  it('search ranks by query, filters by status/intent, and shows COMING_SOON honestly', async () => {
    const reg = new CapabilityRegistry(); await reg.seed();
    const hits = await reg.search({ q: 'buy a gift card' });
    expect(hits[0].id).to.equal('shop.digital_goods.purchase');
    expect((await reg.search({ status: 'SIMULATED' })).every((e) => e.release_status === 'SIMULATED')).to.equal(true);
    expect((await reg.search({ intent: 'buy' })).map((e) => e.id)).to.include('shop.digital_goods.purchase');
    const risk = await reg.get('token.risk');
    expect(risk.release_status).to.equal('COMING_SOON'); // only evaluation offers → never executable
    expect(EXECUTABLE_IN_PREVIEW).to.not.include('COMING_SOON');
  });

  it('R9 (unit): a new entry is offered by search without any code change', async () => {
    const reg = new CapabilityRegistry(); await reg.seed();
    const e = structuredClone(loadSeedEntries().find((x) => x.id === 'shop.digital_goods.purchase'));
    Object.assign(e, { id: 'travel.rail_ticket.book', name: 'Book a rail ticket', description: 'Book a train ticket', tags: ['train', 'rail', 'ticket'], intents: ['book'] });
    e.providers = [{ id: 'demo_rail_mock', name: 'Demo Rail (MOCK)', kind: 'mock', connector: 'mock_store' }];
    await reg.seed([e]);
    expect((await reg.search({ q: 'train ticket' }))[0].id).to.equal('travel.rail_ticket.book');
  });

  it('R9 (static): no supplier or provider id is hardcoded in assistant/planner/task code', () => {
    const providerIds = loadSeedEntries().flatMap((e) => e.providers.map((p) => p.id));
    for (const f of ['workflows/planner.js', 'workflows/task_service.js', 'workflows/model_router.js']) {
      const file = path.join(SRC, f);
      if (!fs.existsSync(file)) continue; // asserted again once the file exists (P2.3/P2.4)
      const src = fs.readFileSync(file, 'utf8');
      for (const id of providerIds) expect(src.includes(id), `${f} names ${id}`).to.equal(false);
    }
  });

  it('derives supplier-catalog entries with honest release status', () => {
    const cat = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'supplier_catalog.v1.json'), 'utf8'));
    const d = entriesFromSupplierCatalog(cat);
    expect(d.find((e) => e.id === 'wallet.balance').release_status).to.equal('PREVIEW');
    expect(d.find((e) => e.id === 'token.verdict').release_status).to.equal('COMING_SOON');
  });
});
