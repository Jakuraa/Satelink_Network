// Planner (Release A, P2.4). The model PROPOSES; the server DISPOSES (R7/R8).
//
//   1. candidates = registry.search(text)  — the only capabilities the model is shown (R9: no supplier or
//      capability is named in this file)
//   2. the model proposes { steps: [{ capability_id, inputs }] }  (untrusted JSON)
//   3. every step is validated deterministically: capability ∈ candidates, executable in preview,
//      input schema (unknown fields refused), permission scope held, market served, a routable provider
//   4. a missing required value → AWAITING_INPUT with ONE specific question; values are never invented
//
// Result: { outcome: 'PLANNED' | 'AWAITING_INPUT' | 'REJECTED', plan?, question?, reason?, model }

import { validate, firstMissing } from './schema_lite.js';
import { EXECUTABLE_IN_PREVIEW } from './capability_registry.js';

const MAX_STEPS = 5;
export const DEFAULT_SCOPES = Object.freeze({
  human: ['tasks:purchase', 'tasks:procure', 'assistant:chat'],
  developer: ['tasks:purchase', 'tasks:procure', 'assistant:chat'],
  agent: ['tasks:procure', 'assistant:chat'],
  machine: ['tasks:procure'],
});

function questionFor(entry, field) {
  const s = entry.input_schema?.properties?.[field] || {};
  const what = s.description || field.replace(/_/g, ' ');
  if (/usd_minor$/.test(field)) return `What is the most you want to pay (in US dollars) — ${what.toLowerCase()}?`;
  return `To ${entry.name.toLowerCase()}, I need one more detail: ${what.toLowerCase()}.`;
}

/**
 * @param {object} o
 *  - text, actorType ('human'|'developer'|'agent'|'machine'), scopes (default by actor), market ('GLOBAL'|'IN'|…)
 *  - registry: CapabilityRegistry · router: createModelRouter() result
 *  - isRoutable(entry, provider): whether a connector exists for that provider (service-supplied)
 *  - priorInputs: answers already given (POST /v1/tasks/:id/input), keyed by field
 */
export async function planTask({ text, actorType = 'human', scopes, market = 'GLOBAL', registry, router, isRoutable = () => true, priorInputs = {}, priorPlan = null }) {
  const granted = new Set(scopes || DEFAULT_SCOPES[actorType] || []);
  const candidates = (await registry.search({ q: text, market, limit: 8 })).filter((e) => EXECUTABLE_IN_PREVIEW.includes(e.release_status));
  let proposal; let model;
  if (priorPlan) {
    // Follow-up input: keep the validated plan; only merge the new answers (no new model call).
    proposal = { steps: priorPlan.steps.map((s) => ({ capability_id: s.capability_id, inputs: s.inputs })) };
    model = priorPlan.model;
  } else {
    if (!candidates.length) return { outcome: 'REJECTED', reason: 'No capability in the preview catalogue can do that yet.', model: null };
    const m = await router.complete({
      policy: 'plan',
      messages: [
        { role: 'system', content: 'Propose a plan as JSON {"steps":[{"capability_id":"…","inputs":{…}}]} using ONLY these capabilities. Never invent values; omit unknown inputs.' },
        { role: 'system', content: JSON.stringify(candidates.map((c) => ({ id: c.id, name: c.name, description: c.description, input_schema: c.input_schema }))) },
        { role: 'user', content: String(text).slice(0, 2000) },
      ],
      context: { candidates },
    });
    proposal = m.json; model = { served_by: m.served_by, provider: m.provider, generation_id: m.generation_id, cost_minor: m.cost_minor.toString(), fixture: m.fixture };
  }

  const steps = Array.isArray(proposal?.steps) ? proposal.steps : null;
  if (!steps || steps.length === 0) return { outcome: 'REJECTED', reason: 'I could not turn that into a plan with the preview capabilities.', model };
  if (steps.length > MAX_STEPS) return { outcome: 'REJECTED', reason: `A preview task can have at most ${MAX_STEPS} steps.`, model };

  const allowedIds = new Set(priorPlan ? priorPlan.steps.map((s) => s.capability_id) : candidates.map((c) => c.id));
  const planned = [];
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i] || {};
    const id = typeof s.capability_id === 'string' ? s.capability_id : '';
    // Only capabilities the registry offered for THIS request — a model cannot reach outside them.
    if (!allowedIds.has(id)) return { outcome: 'REJECTED', reason: 'The proposed plan used a capability that was not offered.', model };
    const entry = await registry.get(id);
    if (!entry || !EXECUTABLE_IN_PREVIEW.includes(entry.release_status)) return { outcome: 'REJECTED', reason: `"${id}" is not available in the preview.`, model };
    if (!granted.has(entry.permission_scope)) return { outcome: 'REJECTED', reason: `You do not have permission "${entry.permission_scope}" for this capability.`, model };
    if (!entry.markets.includes('GLOBAL') && !entry.markets.includes(market)) return { outcome: 'REJECTED', reason: `"${entry.name}" is not available in your market.`, model };
    const provider = entry.providers.find((p) => isRoutable(entry, p));
    if (!provider) return { outcome: 'REJECTED', reason: `"${entry.name}" has no available provider right now.`, model };

    const proposed = s.inputs && typeof s.inputs === 'object' && !Array.isArray(s.inputs) ? s.inputs : {};
    // Model-proposed values are kept only where the schema allows them; user answers win.
    const inputs = { ...Object.fromEntries(Object.entries(proposed).filter(([k]) => entry.input_schema.properties?.[k])), ...priorInputs };
    const missing = firstMissing(entry.input_schema, inputs);
    if (missing) {
      return { outcome: 'AWAITING_INPUT', question: questionFor(entry, missing), field: missing, step_no: i + 1, plan: { steps: [...planned, { step_no: i + 1, capability_id: id, inputs }], model }, model };
    }
    const errors = validate(entry.input_schema, inputs);
    if (errors.length) {
      const e = errors[0]; const field = e.path.replace(/^\$\./, '');
      return { outcome: 'AWAITING_INPUT', question: `"${field.replace(/_/g, ' ')}" ${e.message}. Please give a valid value.`, field, step_no: i + 1, plan: { steps: [...planned, { step_no: i + 1, capability_id: id, inputs }], model }, model };
    }
    planned.push({
      step_no: i + 1, capability_id: id, capability_version: entry.version, capability_name: entry.name,
      provider_id: provider.id, provider_name: provider.name, release_status: entry.release_status,
      inputs, permission: entry.permission_scope, fee_policy_id: entry.fee_policy_id,
      success_condition: entry.verification.method, est_cost: 'priced in the quote',
    });
  }
  return { outcome: 'PLANNED', plan: { steps: planned, model }, model, reply: proposal.reply || null };
}
