// apps/api/test/planner.test.js — Release A P2.4: model proposes, server validates (R7/R8/R9).
import { expect } from 'chai';
import { planTask } from '../src/workflows/planner.js';
import { CapabilityRegistry, loadSeedEntries } from '../src/workflows/capability_registry.js';
import { createModelRouter } from '../src/workflows/model_router.js';

const SHOP = 'shop.digital_goods.purchase';
async function reg() { const r = new CapabilityRegistry(); await r.seed(); return r; }
// A model double that returns whatever proposal a test wants (simulates a malicious / confused model).
const scripted = (json) => ({ complete: async () => ({ json, served_by: 'fixture/test', provider: 'fixture', generation_id: null, cost_minor: 0n, fixture: true }) });

describe('planner (P2.4)', () => {
  it('plans a purchase from natural language (fixture model, registry candidates)', async () => {
    const out = await planTask({ text: 'Buy a sci-fi e-book gift code under $12 for me', registry: await reg(), router: createModelRouter({ env: {} }) });
    expect(out.outcome).to.equal('PLANNED');
    const [s] = out.plan.steps;
    expect(s).to.deep.include({ capability_id: SHOP, provider_name: 'Demo Digital Store (MOCK)', permission: 'tasks:purchase', release_status: 'SIMULATED' });
    expect(s.inputs).to.deep.equal({ product_query: 'sci-fi e-book gift code', max_price_usd_minor: 12_000_000 });
    expect(out.model.served_by).to.match(/^fixture\//);
  });

  it('missing value → AWAITING_INPUT with one specific question; never invents it', async () => {
    const out = await planTask({ text: 'Buy a sci-fi e-book gift code', registry: await reg(), router: createModelRouter({ env: {} }) });
    expect(out.outcome).to.equal('AWAITING_INPUT');
    expect(out.field).to.equal('max_price_usd_minor');
    expect(out.question).to.match(/most you want to pay/i);
    expect(out.plan.steps[0].inputs).to.not.have.property('max_price_usd_minor');
    const next = await planTask({ text: 'x', registry: await reg(), router: scripted(null), priorPlan: out.plan, priorInputs: { max_price_usd_minor: 9_000_000 } });
    expect(next.outcome).to.equal('PLANNED');
    expect(next.plan.steps[0].inputs.max_price_usd_minor).to.equal(9_000_000);
  });

  it('a model cannot reach a capability the registry did not offer (incl. internal ones)', async () => {
    for (const id of ['ai.model.inference', 'market_data.candles', 'payments.transfer.anything', '']) {
      const out = await planTask({ text: 'buy a gift card', registry: await reg(), router: scripted({ steps: [{ capability_id: id, inputs: {} }] }) });
      expect(out.outcome, id).to.equal('REJECTED');
    }
  });

  it('COMING_SOON capabilities are never planned', async () => {
    const out = await planTask({ text: 'token risk score for a contract', registry: await reg(), router: scripted({ steps: [{ capability_id: 'token.risk', inputs: {} }] }) });
    expect(out.outcome).to.equal('REJECTED');
  });

  it('unknown or invalid inputs from the model are dropped or questioned, never passed through', async () => {
    const out = await planTask({ text: 'buy a gift card', registry: await reg(), router: scripted({ steps: [{ capability_id: SHOP, inputs: { product_query: 'gift card', max_price_usd_minor: 5_000_000, approve: true, pay_to: '0xabc' } }] }) });
    expect(out.outcome).to.equal('PLANNED');
    expect(Object.keys(out.plan.steps[0].inputs).sort()).to.deep.equal(['max_price_usd_minor', 'product_query']);
    const bad = await planTask({ text: 'buy a gift card', registry: await reg(), router: scripted({ steps: [{ capability_id: SHOP, inputs: { product_query: 'gift card', max_price_usd_minor: -3 } }] }) });
    expect(bad.outcome).to.equal('AWAITING_INPUT');
  });

  it('permission and step limits are enforced deterministically', async () => {
    const machine = await planTask({ text: 'buy a gift card under $5', actorType: 'machine', registry: await reg(), router: createModelRouter({ env: {} }) });
    expect(machine.outcome).to.equal('REJECTED');
    expect(machine.reason).to.match(/permission/);
    const many = await planTask({ text: 'buy a gift card', registry: await reg(), router: scripted({ steps: Array(6).fill({ capability_id: SHOP, inputs: {} }) }) });
    expect(many.outcome).to.equal('REJECTED');
  });

  it('no routable provider → REJECTED (the planner never falls back to an unlisted supplier)', async () => {
    const out = await planTask({ text: 'buy a gift card under $5', registry: await reg(), router: createModelRouter({ env: {} }), isRoutable: () => false });
    expect(out.outcome).to.equal('REJECTED');
  });

  it('R9: a new registry entry is planned without code changes', async () => {
    const r = await reg();
    const e = structuredClone(loadSeedEntries().find((x) => x.id === SHOP));
    Object.assign(e, { id: 'travel.rail_ticket.book', name: 'Book a rail ticket', description: 'Book a train ticket', tags: ['train', 'rail', 'ticket'], intents: ['book'] });
    e.providers = [{ id: 'demo_rail_mock', name: 'Demo Rail (MOCK)', kind: 'mock', connector: 'mock_store' }];
    await r.seed([e]);
    const out = await planTask({ text: 'book a train ticket under $30', registry: r, router: createModelRouter({ env: {} }) });
    expect(out.plan.steps[0].capability_id).to.equal('travel.rail_ticket.book');
  });
});
