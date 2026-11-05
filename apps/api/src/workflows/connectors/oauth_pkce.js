// OAuth 2.1 authorization-code + PKCE (S256) client for connectors (Release A S2), server-side:
// the verifier never leaves the API; state is single-use and expires; tokens are stored encrypted (AES-256-GCM)
// with a key that is NOT in the database (CONNECTOR_TOKEN_KEY, 32 bytes hex). Authorization servers must be loopback
// in the preview (SSRF guard); a production deployment would allowlist real issuers.

import crypto from 'node:crypto';
import { TaskError, ERR } from '../errors.js';

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function pkcePair() {
  const verifier = b64url(crypto.randomBytes(48));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge, method: 'S256' };
}

function keyFrom(hex) {
  if (!/^[0-9a-f]{64}$/i.test(hex || '')) throw new Error('CONNECTOR_TOKEN_KEY must be 32 bytes hex');
  return Buffer.from(hex, 'hex');
}
export function sealToken(token, keyHex) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', keyFrom(keyHex), iv);
  const ct = Buffer.concat([c.update(token, 'utf8'), c.final()]);
  return { ciphertext: ct.toString('base64'), iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64') };
}
export function openToken({ ciphertext, iv, tag }, keyHex) {
  const d = crypto.createDecipheriv('aes-256-gcm', keyFrom(keyHex), Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(ciphertext, 'base64')), d.final()]).toString('utf8');
}

function assertLoopback(u, what) {
  const x = new URL(u);
  if (!LOOPBACK.has(x.hostname) || !['http:', 'https:'].includes(x.protocol)) throw new Error(`${what} must be a loopback URL in the preview`);
}

/**
 * @param {object} o — pool, keyHex, connectors: { [connectorId]: { issuer, clientId, scopes, redirectUri } }, fetchImpl, clock
 */
export class ConnectionStore {
  constructor({ pool, keyHex, connectors, fetchImpl = globalThis.fetch, clock = () => Date.now() }) {
    keyFrom(keyHex);
    for (const [id, c] of Object.entries(connectors)) { assertLoopback(c.issuer, `${id} issuer`); assertLoopback(c.redirectUri, `${id} redirectUri`); }
    Object.assign(this, { pool, keyHex, connectors, fetch: fetchImpl, clock });
  }

  _cfg(id) {
    const c = this.connectors[id];
    if (!c) throw new TaskError(ERR.NOT_FOUND, 'Unknown connector.', { status: 404 });
    return c;
  }

  /** Begin authorization: returns the URL to send the user's browser to. */
  async start(principal, connectorId, { returnTo = null } = {}) {
    const c = this._cfg(connectorId);
    const { verifier, challenge } = pkcePair();
    const state = b64url(crypto.randomBytes(32));
    await this.pool.query(
      `INSERT INTO connector_oauth_states (state, principal, connector_id, code_verifier, redirect_uri, return_to, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [state, principal, connectorId, verifier, c.redirectUri, returnTo && /^\/[A-Za-z0-9/_?=&.-]*$/.test(returnTo) ? returnTo : null, new Date(this.clock() + 10 * 60_000)],
    );
    const u = new URL(`${c.issuer}/oauth/authorize`);
    for (const [k, v] of Object.entries({ response_type: 'code', client_id: c.clientId, redirect_uri: c.redirectUri, state, code_challenge: challenge, code_challenge_method: 'S256', scope: c.scopes })) u.searchParams.set(k, v);
    return { authorize_url: u.toString() };
  }

  /** Finish authorization: single-use state → code exchange with the stored verifier → encrypted token row. */
  async finish({ state, code, error }) {
    const { rows } = await this.pool.query(
      `UPDATE connector_oauth_states SET used_at = now() WHERE state = $1 AND used_at IS NULL AND expires_at > $2 RETURNING *`,
      [String(state || ''), new Date(this.clock())],
    );
    const s = rows[0];
    if (!s) throw new TaskError('OAUTH_STATE_INVALID', 'This connection link is invalid or expired. Start again.', { status: 400 });
    if (error) throw new TaskError('OAUTH_DENIED', 'The connection was not approved.', { status: 400, extra: { return_to: s.return_to } });
    const c = this._cfg(s.connector_id);
    const res = await this.fetch(`${c.issuer}/oauth/token`, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code: String(code || ''), code_verifier: s.code_verifier, redirect_uri: s.redirect_uri, client_id: c.clientId }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || typeof j.access_token !== 'string' || j.token_type?.toLowerCase() !== 'bearer') throw new TaskError('OAUTH_EXCHANGE_FAILED', 'Could not complete the connection.', { status: 502 });
    const sealed = sealToken(j.access_token, this.keyHex);
    await this.pool.query(
      `INSERT INTO connector_connections (principal, connector_id, scopes, token_ciphertext, token_iv, token_tag, expires_at, created_at, revoked_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,now(),NULL)
       ON CONFLICT (principal, connector_id) DO UPDATE SET scopes = EXCLUDED.scopes, token_ciphertext = EXCLUDED.token_ciphertext,
         token_iv = EXCLUDED.token_iv, token_tag = EXCLUDED.token_tag, expires_at = EXCLUDED.expires_at, created_at = now(), revoked_at = NULL`,
      [s.principal, s.connector_id, String(j.scope || c.scopes), sealed.ciphertext, sealed.iv, sealed.tag, j.expires_in ? new Date(this.clock() + j.expires_in * 1000) : null],
    );
    return { principal: s.principal, connector_id: s.connector_id, return_to: s.return_to };
  }

  async tokenFor(principal, connectorId) {
    const { rows } = await this.pool.query(
      `SELECT * FROM connector_connections WHERE principal = $1 AND connector_id = $2 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > $3)`,
      [principal, connectorId, new Date(this.clock())],
    );
    return rows[0] ? openToken({ ciphertext: rows[0].token_ciphertext, iv: rows[0].token_iv, tag: rows[0].token_tag }, this.keyHex) : null;
  }

  async list(principal) {
    const { rows } = await this.pool.query(`SELECT connector_id, scopes, created_at, expires_at, revoked_at FROM connector_connections WHERE principal = $1`, [principal]);
    return Object.keys(this.connectors).map((id) => {
      const r = rows.find((x) => x.connector_id === id);
      const active = r && !r.revoked_at && (!r.expires_at || new Date(r.expires_at).getTime() > this.clock());
      return { connector_id: id, name: this.connectors[id].name, status: active ? 'connected' : r?.revoked_at ? 'revoked' : r ? 'expired' : 'not_connected',
        scopes: active ? r.scopes.split(/\s+/) : [], connected_at: active ? r.created_at : null, expires_at: active ? r.expires_at : null };
    });
  }

  async revoke(principal, connectorId) {
    this._cfg(connectorId);
    await this.pool.query(`UPDATE connector_connections SET revoked_at = now(), token_ciphertext = '', token_iv = '', token_tag = '' WHERE principal = $1 AND connector_id = $2`, [principal, connectorId]);
    return { connector_id: connectorId, status: 'revoked' };
  }
}
