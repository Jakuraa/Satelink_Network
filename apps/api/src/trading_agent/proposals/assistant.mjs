// "Talk to Satelink Trading AI" (Phase 6 item 13): the human path through the ONE core.
//   intent (capital, broker, max loss, markets) → orchestrator → evidence + GO / WAIT / REJECT card
//   GO + an order described → a PENDING proposal the human then authorises (step-up) in the queue
//   → OMS acceptance → risk → paper execution → receipt. This service never places an order.
import { ApiError } from '../api/errors.mjs';
import { decisionJson } from '../access/interface.mjs';
import { compareDecimal, mulDecimal } from '../brokers/decimal.mjs';

const DEC = /^(0|[1-9]\d{0,14})(\.\d{1,8})?$/;
const INSTRUMENT = /^([A-Z0-9]{2,15}-[A-Z0-9]{2,15}|[A-Z]{2,10}:[A-Z0-9&._-]{1,30})$/;
const bad = (m) => new ApiError(400, 'INVALID', m);

export function validateIntent(intent) {
  if (!intent || typeof intent !== 'object') throw bad('intent required');
  if (!DEC.test(intent.capital ?? '')) throw bad('capital must be a decimal amount');
  if (!DEC.test(intent.maxLoss ?? '')) throw bad('maxLoss must be a decimal amount');
  if (compareDecimal(intent.maxLoss, intent.capital) > 0) throw bad('maxLoss cannot exceed capital');
  if (!['binance', 'alpaca', 'upstox'].includes(intent.broker)) throw bad('broker must be binance, alpaca or upstox');
  if (!Array.isArray(intent.markets) || intent.markets.length < 1 || intent.markets.length > 5 || !intent.markets.every((m) => INSTRUMENT.test(m))) throw bad('markets: 1–5 instruments');
  return Object.freeze({ capital: intent.capital, maxLoss: intent.maxLoss, broker: intent.broker, markets: Object.freeze([...intent.markets]) });
}

export function createAssistant({ orchestrator, proposals }) {
  if (!orchestrator?.run || !proposals?.create) throw new Error('createAssistant needs orchestrator and proposals');
  return Object.freeze({
    async evaluate(principal, body, requestId) {
      if (principal?.kind !== 'human') throw new ApiError(403, 'HUMAN_REQUIRED', 'the assistant is for signed-in people; agents use /agent/*');
      const intent = validateIntent(body?.intent);
      const o = body?.order ?? null;
      if (o) {
        if (!/^mdt_[A-Za-z0-9_-]{3,64}$/.test(o.mandateId ?? '') || !['buy', 'sell'].includes(o.side) || !DEC.test(o.quantity ?? '') || (o.limitPrice != null && !DEC.test(o.limitPrice))) throw bad('order: mandateId, side, quantity (and optional limitPrice) required');
        if (o.limitPrice && compareDecimal(mulDecimal(o.quantity, o.limitPrice), intent.capital) > 0) throw bad('the order is larger than the capital you entered');
      }
      const instrument = intent.markets[0];
      const r = await orchestrator.run({ kind: 'evaluate_opportunity', principalId: principal.principalId, instrument, mandateId: o?.mandateId ?? null, opportunityId: `asst_${requestId}`.slice(0, 80), intent });
      if (r.status !== 'ok' || !r.decision) throw new ApiError(503, 'EVALUATION_UNAVAILABLE', `evaluation did not complete (${r.status})`);
      const card = decisionJson(r.decision);
      let proposal = null;
      if (o && r.recommendation === 'GO') {
        proposal = await proposals.create({
          principalId: principal.principalId, proposedBy: 'assistant', proposedByKind: 'assistant', kind: 'order', mandateId: o.mandateId, decisionId: r.decision.id,
          payload: { mandateId: o.mandateId, instrument, side: o.side, quantity: o.quantity, ...(o.limitPrice ? { limitPrice: o.limitPrice, type: 'limit' } : { type: 'market' }) },
          rationale: r.decision.explanation,
        });
      }
      const notes = Object.fromEntries(Object.entries(r.agents ?? {}).filter(([, a]) => a.status === 'ok').map(([k, a]) => [k, a.output]));
      return Object.freeze({
        card, recommendation: r.recommendation, intent, instrument, notes, traceId: r.traceId,
        proposal, nextStep: proposal ? 'authorise the pending proposal (step-up) to place a PAPER order' : r.recommendation === 'GO' ? 'describe an order to get a proposal to authorise' : 'no action: the decision is not GO',
      });
    },
  });
}
