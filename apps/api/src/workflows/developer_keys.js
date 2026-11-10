// Developer API keys for the task API (Release A, S4; ADR-8). One identity (the Better Auth principal), scoped keys.
// The plaintext key is shown ONCE at creation; only sha256(key) is stored. Verification is a constant-time hash
// lookup by the (unique) hash. Per-key rate limit: fixed 60 s window, in-process. Usage: durable per-key per-day counter.

import crypto from 'node:crypto';
import { TaskError } from './errors.js';

export const SCOPES = Object.freeze(['tasks:create', 'tasks:read', 'tasks:approve', 'receipts:read', 'usage:read']);
const KEY_RE = /^slk_preview_[A-Za-z0-9_-]{40,64}$/;
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

export class DeveloperKeys {
  constructor({ pool, clock = () => Date.now() }) { this.pool = pool; this.clock = clock; this.windows = new Map(); }

  async create(principal, { name, scopes }) {
    const n = String(name || '').trim();
    if (!n || n.length > 60) throw new TaskError('VALIDATION_FAILED', 'Give the key a name (1–60 characters).');
    const sc = Array.isArray(scopes) && scopes.length ? [...new Set(scopes)] : ['tasks:create', 'tasks:read', 'receipts:read'];
    if (!sc.every((s) => SCOPES.includes(s))) throw new TaskError('VALIDATION_FAILED', `Scopes must be from: ${SCOPES.join(', ')}.`);
    const secret = `slk_preview_${crypto.randomBytes(36).toString('base64url')}`;
    const keyId = `key_${crypto.randomBytes(10).toString('hex')}`;
    await this.pool.query(
      `INSERT INTO developer_api_keys (key_id, principal, name, prefix, key_hash, scopes) VALUES ($1,$2,$3,$4,$5,$6)`,
      [keyId, principal, n, secret.slice(0, 16), sha(secret), sc],
    );
    return { key_id: keyId, name: n, scopes: sc, prefix: secret.slice(0, 16), secret, secret_notice: 'Shown once. Store it now; Satelink keeps only a hash.' };
  }

  async list(principal) {
    const { rows } = await this.pool.query(
      `SELECT k.key_id, k.name, k.prefix, k.scopes, k.rate_limit_per_min, k.agent_spend_preauth_minor::text AS agent_spend_preauth_minor, k.created_at, k.last_used_at, k.revoked_at,
              COALESCE((SELECT SUM(u.requests) FROM developer_api_key_usage u WHERE u.key_id = k.key_id), 0)::text AS requests_total,
              COALESCE((SELECT u.requests FROM developer_api_key_usage u WHERE u.key_id = k.key_id AND u.day = CURRENT_DATE), 0)::text AS requests_today
         FROM developer_api_keys k WHERE k.principal = $1 ORDER BY k.created_at DESC`,
      [principal],
    );
    return rows.map((r) => ({ ...r, status: r.revoked_at ? 'revoked' : 'active' }));
  }

  async revoke(principal, keyId) {
    const { rowCount } = await this.pool.query(`UPDATE developer_api_keys SET revoked_at = now() WHERE key_id = $1 AND principal = $2 AND revoked_at IS NULL`, [String(keyId), principal]);
    if (!rowCount) throw new TaskError('NOT_FOUND', 'Key not found.', { status: 404 });
    return { key_id: keyId, status: 'revoked' };
  }

  /** Resolve a presented key → { principal, scopes, key_id } or null. Counts usage and enforces the per-key rate limit. */
  async authenticate(presented) {
    if (typeof presented !== 'string' || !KEY_RE.test(presented)) return null;
    const { rows: [k] } = await this.pool.query(`SELECT * FROM developer_api_keys WHERE key_hash = $1 AND revoked_at IS NULL`, [sha(presented)]);
    if (!k) return null;
    const now = this.clock(); const win = Math.floor(now / 60_000);
    const w = this.windows.get(k.key_id);
    const count = w && w.win === win ? w.count + 1 : 1;
    this.windows.set(k.key_id, { win, count });
    if (count > k.rate_limit_per_min) throw new TaskError('RATE_LIMITED', 'Too many requests for this key. Try again in a minute.', { status: 429, retryable: true });
    await this.pool.query(
      `WITH t AS (UPDATE developer_api_keys SET last_used_at = now() WHERE key_id = $1)
       INSERT INTO developer_api_key_usage (key_id, day, requests) VALUES ($1, CURRENT_DATE, 1)
       ON CONFLICT (key_id, day) DO UPDATE SET requests = developer_api_key_usage.requests + 1`,
      [k.key_id],
    );
    return { principal: k.principal, scopes: k.scopes, key_id: k.key_id, agent_spend_preauth_minor: BigInt(k.agent_spend_preauth_minor ?? 0) };
  }
}
