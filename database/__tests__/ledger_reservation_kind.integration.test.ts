/**
 * Migration 020 — ledger_txns.kind accepts the reservation postings (S-5).
 * Real Postgres: a testcontainer, or (no Docker) a fresh database on the server in LEDGER_TEST_DB
 * (e.g. postgresql://postgres@127.0.0.1:5432/postgres).
 *
 *   - through 019, a 'hold' / 'capture' / 'release' header FAILS the kind CHECK;
 *   - with 020 all three insert, the six earlier kinds still do, and an unknown kind is still refused;
 *   - LEDGER_KINDS (domain) and the CHECK constraint (DB) list exactly the same set.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import { cpSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { applyMigrationsForTest } from './apply-migrations.js';
import { LEDGER_KINDS } from '../../libs/financial-domain/src/ledger/ledger-kind.js';

const MIGRATIONS_DIR = resolve(import.meta.dirname ?? new URL('.', import.meta.url).pathname, '..', 'migrations');

let container: StartedPostgreSqlContainer | undefined;
let adminUrl = '';
const created: string[] = [];

async function freshDb(name: string): Promise<string> {
  if (!adminUrl) {
    if (process.env.LEDGER_TEST_DB) adminUrl = process.env.LEDGER_TEST_DB;
    else {
      container = await new PostgreSqlContainer('postgres:16-alpine').start();
      adminUrl = container.getConnectionUri();
    }
  }
  const db = `${name}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const c = new Client({ connectionString: adminUrl });
  await c.connect();
  await c.query(`CREATE DATABASE ${db}`);
  await c.end();
  created.push(db);
  const u = new URL(adminUrl);
  u.pathname = `/${db}`;
  return u.toString();
}

/** A migrations dir holding only the files up to and including `last`. */
function migrationsThrough(last: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'mig-'));
  for (const f of readdirSync(MIGRATIONS_DIR)) if (f.endsWith('.sql') && f <= last) cpSync(join(MIGRATIONS_DIR, f), join(dir, f));
  return dir;
}

async function insertKind(url: string, kind: string): Promise<'ok' | string> {
  const c = new Client({ connectionString: url });
  await c.connect();
  try {
    await c.query(
      `INSERT INTO ledger_txns (txn_id, kind, ref_type, ref_id, currency, state, posted_at)
       VALUES ($1, $2, 'reservation', $1, 'USDT', 'posted', now())`,
      [`rsv:test:${kind}:${Math.random()}`, kind],
    );
    return 'ok';
  } catch (e) {
    return (e as { code?: string }).code ?? 'error';
  } finally {
    await c.end();
  }
}

afterAll(async () => {
  if (adminUrl) {
    const c = new Client({ connectionString: adminUrl });
    await c.connect();
    for (const db of created) await c.query(`DROP DATABASE IF EXISTS ${db}`);
    await c.end();
  }
  await container?.stop();
});

describe('migration 020 — reservation ledger kinds', () => {
  it('through 019 the reservation kinds fail the CHECK (the gap 020 closes)', async () => {
    const url = await freshDb('rsv019');
    const dir = migrationsThrough('019_ledger_kind_refund.sql');
    try {
      const r = await applyMigrationsForTest(url, dir);
      expect(r.errors).toHaveLength(0);
      for (const k of ['hold', 'capture', 'release']) expect(await insertKind(url, k), k).toBe('23514'); // check_violation
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }, 120_000);

  it('with 020: hold, capture and release insert; earlier kinds still do; unknown kinds are refused', async () => {
    const url = await freshDb('rsv020');
    const r = await applyMigrationsForTest(url, MIGRATIONS_DIR);
    expect(r.errors).toHaveLength(0);
    for (const k of LEDGER_KINDS) expect(await insertKind(url, k), k).toBe('ok');
    expect(await insertKind(url, 'bogus')).toBe('23514');
  }, 120_000);

  it('the domain LEDGER_KINDS equal the DB CHECK set exactly', async () => {
    const url = await freshDb('rsvset');
    await applyMigrationsForTest(url, MIGRATIONS_DIR);
    const c = new Client({ connectionString: url });
    await c.connect();
    try {
      const { rows } = await c.query<{ def: string }>(`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'ledger_txns_kind_check'`);
      const dbKinds = [...rows[0]!.def.matchAll(/'([a-z_]+)'::text/g)].map((m) => m[1]).sort();
      expect(dbKinds).toEqual([...LEDGER_KINDS].sort());
    } finally { await c.end(); }
  }, 120_000);
});
