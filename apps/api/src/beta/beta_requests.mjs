// Trading AI beta waitlist capture (Phase 7 amendment, #511).
// Additive-only table (migrations/043_beta_requests.sql), applied idempotently
// on first use (same boot-DDL pattern as console_accounts/schema.mjs). A
// resubmission with the same email is a no-op insert — one row per requester,
// ever. Email delivery reuses the Resend wiring from console_accounts/alerts.mjs
// (same RESEND_API_KEY, same dynamic import, same fail-open-on-send behavior:
// the row is stored whether or not the email goes out).
import crypto from 'node:crypto';

export const ROLES = ['human', 'ai_agent', 'machine'];

const DDL = `
CREATE TABLE IF NOT EXISTS beta_requests (
  id           BIGSERIAL PRIMARY KEY,
  email        TEXT        NOT NULL CHECK (char_length(email) BETWEEN 3 AND 200),
  name         TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  role         TEXT        NOT NULL CHECK (role IN ('human', 'ai_agent', 'machine')),
  use_case     TEXT        NOT NULL CHECK (char_length(use_case) BETWEEN 1 AND 2000),
  capital_band TEXT        CHECK (capital_band IS NULL OR char_length(capital_band) <= 80),
  broker       TEXT        CHECK (broker IS NULL OR char_length(broker) <= 80),
  source       TEXT,
  ip_hash      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS beta_requests_email_unique ON beta_requests (lower(email));
CREATE INDEX IF NOT EXISTS beta_requests_created_at ON beta_requests (created_at DESC);
`;

let ensured = null;

/** Apply the schema once per process. Safe to call on every request. */
export function ensureBetaRequestsSchema(pool) {
  if (!ensured) {
    ensured = pool.query(DDL).catch((err) => {
      ensured = null;
      throw err;
    });
  }
  return ensured;
}

// Test seam.
export function __resetBetaRequestsSchemaCache() { ensured = null; }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Hand-rolled validation (no zod dependency in apps/api) — mirrors the
 * shape/limits enforced by the CHECK constraints above so a bad request fails
 * the same way before and after a cold DB. */
export function validateBetaRequest(body) {
  const errors = {};
  const b = body && typeof body === 'object' ? body : {};

  const email = typeof b.email === 'string' ? b.email.trim() : '';
  if (!email || email.length > 200 || !EMAIL_RE.test(email)) errors.email = 'A valid work email is required';

  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (!name || name.length > 120) errors.name = 'Name is required (max 120 chars)';

  const role = typeof b.role === 'string' ? b.role.trim() : '';
  if (!ROLES.includes(role)) errors.role = `role must be one of: ${ROLES.join(', ')}`;

  const useCase = typeof b.useCase === 'string' ? b.useCase.trim() : (typeof b.use_case === 'string' ? b.use_case.trim() : '');
  if (!useCase || useCase.length > 2000) errors.useCase = 'use case is required (max 2000 chars)';

  const capitalBand = typeof b.capitalBand === 'string' ? b.capitalBand.trim() : (typeof b.capital_band === 'string' ? b.capital_band.trim() : '');
  if (capitalBand.length > 80) errors.capitalBand = 'capital band is too long';

  const broker = typeof b.broker === 'string' ? b.broker.trim() : '';
  if (broker.length > 80) errors.broker = 'broker is too long';

  const source = typeof b.source === 'string' ? b.source.trim().slice(0, 80) : '';

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    data: {
      email: email.toLowerCase(),
      name,
      role,
      useCase,
      capitalBand: capitalBand || null,
      broker: broker || null,
      source: source || null,
    },
  };
}

/** Salted so a leaked table doesn't hand out raw IPs; same purpose as the
 * ip-hashing other founder-facing intake surfaces use, not reversible. */
export function hashIp(ip, salt = process.env.IP_HASH_SALT || 'satelink-beta-requests') {
  if (!ip) return null;
  return crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}

/** INSERT ... ON CONFLICT DO NOTHING, then read back the row (new or
 * pre-existing) so the caller — and the email step — always has one. */
export async function insertBetaRequest(pool, data, { ip = null } = {}) {
  const ipHash = hashIp(ip);
  await pool.query(
    `INSERT INTO beta_requests (email, name, role, use_case, capital_band, broker, source, ip_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (lower(email)) DO NOTHING`,
    [data.email, data.name, data.role, data.useCase, data.capitalBand, data.broker, data.source, ipHash]
  );
  const r = await pool.query(`SELECT * FROM beta_requests WHERE lower(email) = lower($1)`, [data.email]);
  return { row: r.rows[0], created: r.rows[0]?.created_at != null };
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

export function senderConfigured(env = process.env) {
  return Boolean(env.RESEND_API_KEY);
}

/** Founder-notification recipient state. `dedicated` is false when
 * BETA_REQUESTS_FOUNDER_EMAIL is unset (founder action) — FOUNDER_EMAIL may
 * still cover it as a fallback; `effective` says whether anyone is notified. */
export function betaFounderEmailStatus(env = process.env) {
  return {
    dedicated: Boolean(env.BETA_REQUESTS_FOUNDER_EMAIL),
    effective: Boolean(env.BETA_REQUESTS_FOUNDER_EMAIL || env.FOUNDER_EMAIL),
  };
}

/** Resend delivery, same pattern as console_accounts/alerts.mjs: returns
 * 'sent' | 'skipped_no_sender', throws on a provider error — callers decide
 * whether that's fatal. Never blocks the row being stored. */
async function sendViaResend({ to, subject, text, html }, env) {
  if (!senderConfigured(env)) return 'skipped_no_sender';
  const { Resend } = await import('resend');
  const resend = new Resend(env.RESEND_API_KEY);
  const r = await resend.emails.send({ from: env.BETA_REQUESTS_EMAIL_FROM || env.ALERTS_EMAIL_FROM || 'Satelink <automation@satelink.network>', to, subject, text, html });
  if (r?.error) throw new Error(r.error.message || 'resend_error');
  return 'sent';
}

/**
 * Founder notification + requester auto-reply. Each send is independent —
 * one failing never blocks the other, and neither blocks the stored row
 * (the caller inserts first, emails second). Returns a per-recipient outcome
 * so callers can log without throwing.
 */
export async function sendBetaRequestEmails(data, { env = process.env, send = sendViaResend } = {}) {
  const founderTo = env.BETA_REQUESTS_FOUNDER_EMAIL || env.FOUNDER_EMAIL;
  const results = { founder: 'skipped_no_recipient', requester: 'skipped_no_sender' };

  if (founderTo) {
    try {
      results.founder = await send({
        to: founderTo,
        subject: `New beta request — ${data.role}: ${data.name}`,
        text: [
          `New Satelink Trading AI beta request.`,
          `Name: ${data.name}`,
          `Email: ${data.email}`,
          `Role: ${data.role}`,
          `Use case: ${data.useCase}`,
          data.capitalBand ? `Capital band: ${data.capitalBand}` : null,
          data.broker ? `Broker: ${data.broker}` : null,
          data.source ? `Source: ${data.source}` : null,
        ].filter(Boolean).join('\n'),
        html: `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.6">
          <p><strong>New Satelink Trading AI beta request</strong></p>
          <p>Name: ${esc(data.name)}<br/>Email: ${esc(data.email)}<br/>Role: ${esc(data.role)}</p>
          <p>Use case: ${esc(data.useCase)}</p>
          ${data.capitalBand ? `<p>Capital band: ${esc(data.capitalBand)}</p>` : ''}
          ${data.broker ? `<p>Broker: ${esc(data.broker)}</p>` : ''}
        </div>`,
      }, env);
    } catch (err) {
      results.founder = `failed: ${err.message}`;
    }
  }

  try {
    results.requester = await send({
      to: data.email,
      subject: `You're on the Satelink Trading AI beta waitlist`,
      text: [
        `Hi ${data.name},`,
        ``,
        `Thanks for requesting beta access to Satelink Trading AI. We've got your request and will follow up at this address.`,
        ``,
        `— Satelink`,
      ].join('\n'),
      html: `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.6">
        <p>Hi ${esc(data.name)},</p>
        <p>Thanks for requesting beta access to Satelink Trading AI. We've got your request and will follow up at this address.</p>
        <p>— Satelink</p>
      </div>`,
    }, env);
  } catch (err) {
    results.requester = `failed: ${err.message}`;
  }

  return results;
}
