// apps/api/test/task_state_machine.test.js — Release A P2.1: full transition matrix + safety properties.
import { expect } from 'chai';
import {
  STATES, TRANSITIONS, TERMINAL, canTransition, assertTransition, legacyStatus, isTerminal,
} from '../src/workflows/task_state_machine.js';

function reachable(from, without = new Set()) {
  const seen = new Set([from]); const q = [from];
  while (q.length) for (const n of TRANSITIONS[q.shift()]) if (!without.has(n) && !seen.has(n)) { seen.add(n); q.push(n); }
  return seen;
}

describe('task state machine (P2.1)', () => {
  it('has exactly the 18 mandated states and a table row for each', () => {
    expect(STATES).to.have.length(18);
    expect(Object.keys(TRANSITIONS).sort()).to.deep.equal([...STATES].sort());
    for (const s of STATES) for (const t of TRANSITIONS[s]) expect(STATES, `${s}→${t}`).to.include(t);
  });

  it('full 18×18 matrix: canTransition/assertTransition agree with the table for every pair', () => {
    let legal = 0;
    for (const from of STATES) for (const to of STATES) {
      const want = TRANSITIONS[from].includes(to);
      expect(canTransition(from, to), `${from}→${to}`).to.equal(want);
      if (want) { legal++; expect(() => assertTransition(from, to)).not.to.throw(); }
      else expect(() => assertTransition(from, to), `${from}→${to}`).to.throw().with.property('code', 'ILLEGAL_TRANSITION');
    }
    expect(legal).to.be.greaterThan(30);
  });

  it('rejects unknown states with ILLEGAL_TRANSITION', () => {
    expect(() => assertTransition('CREATED', 'DONE')).to.throw().with.property('code', 'ILLEGAL_TRANSITION');
    expect(() => assertTransition('NOPE', 'CREATED')).to.throw().with.property('status', 409);
  });

  it('every state is reachable from CREATED', () => {
    expect([...reachable('CREATED')].sort()).to.deep.equal([...STATES].sort());
  });

  it('EXECUTING is unreachable without AWAITING_APPROVAL, AUTHORIZED and RESERVED (no effect before approval)', () => {
    for (const gate of ['AWAITING_APPROVAL', 'AUTHORIZED', 'RESERVED']) {
      expect(reachable('CREATED', new Set([gate])).has('EXECUTING'), `without ${gate}`).to.equal(false);
    }
  });

  it('SUCCEEDED / PARTIALLY_SUCCEEDED only via VERIFYING (reconciliation re-verifies, never declares success)', () => {
    for (const s of STATES) if (TRANSITIONS[s].includes('SUCCEEDED') || TRANSITIONS[s].includes('PARTIALLY_SUCCEEDED')) expect(s).to.equal('VERIFYING');
    expect(reachable('CREATED', new Set(['VERIFYING'])).has('PARTIALLY_SUCCEEDED')).to.equal(false);
    expect(reachable('CREATED', new Set(['VERIFYING'])).has('SUCCEEDED')).to.equal(false);
  });

  it('REJECTED, CANCELLED and EXPIRED are final; other terminal states may only move to reconciliation', () => {
    for (const s of ['REJECTED', 'CANCELLED', 'EXPIRED']) expect(TRANSITIONS[s]).to.deep.equal([]);
    for (const s of TERMINAL) for (const t of TRANSITIONS[s]) expect(t).to.equal('REQUIRES_RECONCILIATION');
    expect(isTerminal('SUCCEEDED')).to.equal(true);
    expect(isTerminal('EXECUTING')).to.equal(false);
  });

  it('legacy status: pre-approval states are never "running" (#609 recovery must not pick them up)', () => {
    for (const s of ['CREATED', 'UNDERSTANDING', 'PLANNING', 'AWAITING_INPUT', 'QUOTED', 'AWAITING_APPROVAL']) {
      expect(legacyStatus(s), s).to.not.equal('running');
    }
    const allowed = ['running', 'awaiting_approval', 'completed', 'failed', 'blocked', 'cancelled'];
    for (const s of STATES) expect(allowed).to.include(legacyStatus(s));
    expect(legacyStatus('EXECUTING')).to.equal('running');
    expect(legacyStatus('SUCCEEDED')).to.equal('completed');
  });
});
