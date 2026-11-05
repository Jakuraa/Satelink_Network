// Alpaca PAPER adapter (Release A, Slice S3). Constructed ONLY when ALPACA_PAPER_KEY_ID and ALPACA_PAPER_SECRET_KEY
// exist (founder action; never in tests). Every request URL is pinned to https://paper-api.alpaca.markets — any other
// host, including the LIVE host api.alpaca.markets, throws LIVE_HOST_FORBIDDEN before a socket is opened.
// The default preview broker is InternalPaperBroker (trading_connector.js); this adapter is optional.

import { TaskError } from '../errors.js';

export const ALPACA_PAPER_ORIGIN = 'https://paper-api.alpaca.markets';

export function assertPaperHost(url) {
  let u;
  try { u = new URL(url); } catch { throw new TaskError('LIVE_HOST_FORBIDDEN', 'Invalid broker URL.', { status: 400 }); }
  if (u.origin !== ALPACA_PAPER_ORIGIN) throw new TaskError('LIVE_HOST_FORBIDDEN', `Only ${ALPACA_PAPER_ORIGIN} is allowed; refused ${u.host}.`, { status: 400 });
  return u;
}

export function alpacaPaperConfigured(env = process.env) {
  return Boolean(env.ALPACA_PAPER_KEY_ID && env.ALPACA_PAPER_SECRET_KEY);
}

export class AlpacaPaperAdapter {
  constructor({ env = process.env, baseUrl = ALPACA_PAPER_ORIGIN, fetchImpl = globalThis.fetch } = {}) {
    assertPaperHost(baseUrl);
    if (!alpacaPaperConfigured(env)) throw new TaskError('NOT_CONFIGURED', 'Alpaca paper keys are not configured.', { status: 503 });
    this.keyId = env.ALPACA_PAPER_KEY_ID; this.secret = env.ALPACA_PAPER_SECRET_KEY; this.fetch = fetchImpl; this.base = baseUrl;
  }

  async request(path, init = {}) {
    const url = assertPaperHost(new URL(path, this.base).toString());
    return this.fetch(url.toString(), { ...init, headers: { ...(init.headers || {}), 'APCA-API-KEY-ID': this.keyId, 'APCA-API-SECRET-KEY': this.secret } });
  }

  async account() { return (await this.request('/v2/account')).json(); }
}
