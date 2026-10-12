/**
 * Test-only cleanup: TRUNCATE … CASCADE without tripping the 029 append-only guard.
 *
 * Migration 029 puts a BEFORE TRUNCATE trigger on the append-only trading tables
 * (audit_events, order_events, fills, …) that refuses every role. Those tables FK
 * principals, so the integration suites' between-test `TRUNCATE principals … CASCADE`
 * reaches them and is refused — which is the guard working, not a bug in it.
 *
 * This helper runs ONE TRUNCATE statement inside its own transaction with
 * `SET LOCAL session_replication_role = replica`, which skips ordinary triggers for
 * that transaction only (superuser test databases; CI's ephemeral Postgres). It refuses
 * anything that is not a TRUNCATE. It is never imported by application code, and the
 * guard itself stays enforced everywhere else — database/__tests__/trading-audit
 * asserts TRUNCATE/UPDATE/DELETE are still refused for every role.
 */
import type { Pool } from 'pg';

export async function truncateForTest(pool: Pool, statement: string): Promise<void> {
  if (!/^\s*TRUNCATE\s/i.test(statement) || statement.includes(';')) {
    throw new Error('truncateForTest runs exactly one TRUNCATE statement');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL session_replication_role = replica');
    await client.query(statement);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
