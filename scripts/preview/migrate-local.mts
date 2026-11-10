// Apply database/migrations to a LOCAL preview database (localhost only). Uses the same helper as the
// integration suite (seeds the minimal api-schema prerequisites 014/015/018 amend, then the real runner).
// Usage: npx tsx scripts/preview/migrate-local.mts "$DATABASE_URL_LOCAL"
import { resolve } from 'node:path';
import { applyMigrationsForTest } from '../../database/__tests__/apply-migrations.js';

const url = process.argv[2] || process.env.DATABASE_URL_LOCAL || '';
const host = (() => { try { return new URL(url).hostname; } catch { return ''; } })();
if (!['127.0.0.1', 'localhost', '::1'].includes(host)) { console.error(`refusing non-local database host '${host}'`); process.exit(1); }
const r = await applyMigrationsForTest(url, resolve(import.meta.dirname, '..', '..', 'database', 'migrations'));
console.log(`applied ${r.applied.length} migration(s); errors ${r.errors.length}`);
if (r.errors.length) { console.error(r.errors); process.exit(1); }
