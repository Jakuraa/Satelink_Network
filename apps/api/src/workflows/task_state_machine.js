// Task lifecycle state machine (Release A, P2.1). The transition table is DATA; every state change goes
// through `transition()` in the run store (one UPDATE guarded by state AND version — optimistic locking).
//
//   CREATED → UNDERSTANDING → PLANNING → (AWAITING_INPUT ↺) → QUOTED → AWAITING_APPROVAL → AUTHORIZED →
//   RESERVED → EXECUTING → VERIFYING → SUCCEEDED
//
// plus REJECTED, FAILED, CANCELLED, EXPIRED, PARTIALLY_SUCCEEDED, REQUIRES_RECONCILIATION and
// UNKNOWN_EXECUTION_OUTCOME (an in-flight step whose effect could not be verified after a crash: it is
// verified before anything else happens and never blindly re-executed).

import { TaskError, ERR } from './errors.js';

export const STATES = Object.freeze([
  'CREATED', 'UNDERSTANDING', 'PLANNING', 'AWAITING_INPUT', 'QUOTED', 'AWAITING_APPROVAL', 'AUTHORIZED',
  'RESERVED', 'EXECUTING', 'VERIFYING', 'SUCCEEDED', 'REJECTED', 'FAILED', 'CANCELLED', 'EXPIRED',
  'PARTIALLY_SUCCEEDED', 'REQUIRES_RECONCILIATION', 'UNKNOWN_EXECUTION_OUTCOME',
]);

export const TRANSITIONS = Object.freeze({
  CREATED: ['UNDERSTANDING', 'FAILED', 'CANCELLED'],
  UNDERSTANDING: ['PLANNING', 'AWAITING_INPUT', 'REJECTED', 'FAILED', 'CANCELLED'],
  PLANNING: ['QUOTED', 'AWAITING_INPUT', 'REJECTED', 'FAILED', 'CANCELLED'],
  AWAITING_INPUT: ['UNDERSTANDING', 'PLANNING', 'CANCELLED', 'EXPIRED'],
  QUOTED: ['AWAITING_APPROVAL', 'REJECTED', 'CANCELLED', 'EXPIRED'],
  AWAITING_APPROVAL: ['AUTHORIZED', 'REJECTED', 'CANCELLED', 'EXPIRED'],
  // AUTHORIZED → FAILED: the reservation was refused (e.g. insufficient credit); nothing was held.
  AUTHORIZED: ['RESERVED', 'FAILED', 'CANCELLED', 'EXPIRED'],
  // Leaving RESERVED other than to EXECUTING releases the hold.
  RESERVED: ['EXECUTING', 'FAILED', 'CANCELLED', 'EXPIRED'],
  EXECUTING: ['VERIFYING', 'FAILED', 'UNKNOWN_EXECUTION_OUTCOME'],
  VERIFYING: ['SUCCEEDED', 'PARTIALLY_SUCCEEDED', 'FAILED', 'REQUIRES_RECONCILIATION'],
  UNKNOWN_EXECUTION_OUTCOME: ['VERIFYING', 'FAILED', 'REQUIRES_RECONCILIATION'],
  SUCCEEDED: ['REQUIRES_RECONCILIATION'],
  PARTIALLY_SUCCEEDED: ['REQUIRES_RECONCILIATION'],
  FAILED: ['REQUIRES_RECONCILIATION'],
  // Reconciliation never declares success by itself: it re-runs verification (with evidence) or fails.
  REQUIRES_RECONCILIATION: ['VERIFYING', 'FAILED'],
  REJECTED: [],
  CANCELLED: [],
  EXPIRED: [],
});

/** States a customer sees as finished (only reconciliation may still move them). */
export const TERMINAL = Object.freeze(['SUCCEEDED', 'PARTIALLY_SUCCEEDED', 'FAILED', 'REJECTED', 'CANCELLED', 'EXPIRED']);

/** States in which an external/simulated effect may be in flight — recovery owns them after a crash. */
export const IN_FLIGHT = Object.freeze(['RESERVED', 'EXECUTING', 'VERIFYING', 'UNKNOWN_EXECUTION_OUTCOME']);

/** States that hold a reservation that must be released if the task does not succeed. */
export const HOLDS_RESERVATION = Object.freeze(['RESERVED', 'EXECUTING', 'VERIFYING', 'UNKNOWN_EXECUTION_OUTCOME']);

export function isState(s) { return STATES.includes(s); }
export function canTransition(from, to) { return Boolean(TRANSITIONS[from]?.includes(to)); }
export function isTerminal(s) { return TERMINAL.includes(s); }

export function assertTransition(from, to) {
  if (!isState(from) || !isState(to) || !canTransition(from, to)) {
    throw new TaskError(ERR.ILLEGAL_TRANSITION, `Illegal transition ${from} → ${to}.`, { status: 409 });
  }
}

/**
 * #609's coarse `status` column (CHECK: running | awaiting_approval | completed | failed | blocked | cancelled).
 * Pre-approval states are never 'running': #609's recovery re-drives 'running' runs, and nothing may execute
 * before approval.
 */
export function legacyStatus(state) {
  switch (state) {
    case 'CREATED': case 'UNDERSTANDING': case 'PLANNING': case 'AWAITING_INPUT': return 'blocked';
    case 'QUOTED': case 'AWAITING_APPROVAL': return 'awaiting_approval';
    case 'AUTHORIZED': case 'RESERVED': case 'EXECUTING': case 'VERIFYING': case 'UNKNOWN_EXECUTION_OUTCOME': return 'running';
    case 'SUCCEEDED': case 'PARTIALLY_SUCCEEDED': return 'completed';
    case 'FAILED': case 'REQUIRES_RECONCILIATION': return 'failed';
    case 'REJECTED': case 'CANCELLED': case 'EXPIRED': return 'cancelled';
    default: throw new TaskError(ERR.ILLEGAL_TRANSITION, `Unknown state ${state}.`, { status: 500 });
  }
}
