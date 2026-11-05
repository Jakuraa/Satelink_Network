// Typed task errors (R11): every API error is { code, message, retryable, correlation_id }.
// Never carries internals; `status` is the HTTP status the route maps it to.

import { randomUUID } from 'node:crypto';

export class TaskError extends Error {
  constructor(code, message, { status = 400, retryable = false, extra = {} } = {}) {
    super(message);
    this.name = 'TaskError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.extra = extra;
  }

  toJSON(correlationId = randomUUID()) {
    return { code: this.code, message: this.message, retryable: this.retryable, correlation_id: correlationId, ...this.extra };
  }
}

export const ERR = Object.freeze({
  ILLEGAL_TRANSITION: 'ILLEGAL_TRANSITION',
  VERSION_CONFLICT: 'VERSION_CONFLICT',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION: 'VALIDATION_FAILED',
  QUOTE_EXPIRED: 'QUOTE_EXPIRED',
  QUOTE_MISMATCH: 'QUOTE_MISMATCH',
  INSUFFICIENT_CREDIT: 'INSUFFICIENT_CREDIT',
  MODEL_UNAVAILABLE: 'MODEL_UNAVAILABLE',
  MODEL_NOT_ALLOWLISTED: 'MODEL_NOT_ALLOWLISTED',
  BUDGET_EXCEEDED: 'BUDGET_EXCEEDED',
  UPSTREAM_TIMEOUT: 'UPSTREAM_TIMEOUT',
  CAPABILITY_NOT_ALLOWED: 'CAPABILITY_NOT_ALLOWED',
});
