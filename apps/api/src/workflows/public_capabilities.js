// Public, customer-safe view of the capability registry for the website (Release A · P5). Pure and deterministic: no
// timestamps, stable order, no connectors or internal entries, no prices. Providers are named only on SIMULATED
// capabilities (labelled local mocks and Satelink's own engine): naming a third party elsewhere could imply a relationship.
import { CapabilityRegistry } from './capability_registry.js';

export async function buildPublicCapabilities(registry = new CapabilityRegistry()) {
  await registry.seed();
  const caps = await registry.search({ q: '', limit: 500 });
  return {
    generated_from: 'capability registry',
    environment: 'preview',
    simulated: true,
    simulation_label: 'SIMULATED — NO MONEY MOVED',
    fees_status: 'PROPOSED — NOT APPROVED',
    availability: 'Local preview only; not yet open to the public.',
    capabilities: caps.map((c) => ({
      id: c.id, name: c.name, description: c.description, category: c.category, release_status: c.release_status,
      providers: c.release_status === 'SIMULATED' ? [...new Set(c.providers.map((p) => p.name))] : [],
    })),
  };
}
