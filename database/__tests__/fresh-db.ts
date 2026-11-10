// Test-only: a fresh, fully migrated database for one integration file.
// LEDGER_TEST_DB set (a LOCAL admin URL, e.g. postgresql://you@127.0.0.1:5432/postgres) → CREATE DATABASE on that server;
// otherwise a testcontainers Postgres 16 (CI). Same pattern as ledger_reservation_kind.integration.test.ts.
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import { applyMigrationsForTest } from './apply-migrations.js';

export async function freshMigratedDb(name: string, migrationsDir: string): Promise<{ url: string; stop: () => Promise<void> }> {
  let container: StartedPostgreSqlContainer | null = null;
  let url: string;
  const admin = process.env.LEDGER_TEST_DB;
  if (admin) {
    const host = new URL(admin).hostname;
    if (!['127.0.0.1', 'localhost', '::1'].includes(host)) throw new Error('LEDGER_TEST_DB must be a local server');
    const db = `${name}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const c = new Client({ connectionString: admin }); await c.connect(); await c.query(`CREATE DATABASE ${db}`); await c.end();
    const u = new URL(admin); u.pathname = `/${db}`; url = u.toString();
  } else {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    url = container.getConnectionUri();
  }
  const r = await applyMigrationsForTest(url, migrationsDir);
  if (r.errors.length) throw new Error(`migrations failed: ${JSON.stringify(r.errors)}`);
  return { url, stop: async () => { await container?.stop(); } };
}
