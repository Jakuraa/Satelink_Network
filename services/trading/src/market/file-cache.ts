/**
 * Node-only helpers for internal research runs: a filesystem response cache for
 * backtest datasets and a loader for licence evidence files.
 *
 * The cache stores raw provider bodies keyed by a hash of path+query (never the
 * API key). It is for internal R&D only and must not back any customer surface.
 */
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ResponseCache } from './eulerpool-provider.js';
import { validateLicenceEvidence, type LicenceEvidenceRecord } from './licensing.js';

export class FileResponseCache implements ResponseCache {
  constructor(private readonly dir: string) {}

  async get(key: string): Promise<string | null> {
    if (!/^[a-f0-9]{64}$/.test(key)) return null;
    try {
      return await readFile(join(this.dir, `${key}.json`), 'utf8');
    } catch {
      return null;
    }
  }

  async set(key: string, body: string): Promise<void> {
    if (!/^[a-f0-9]{64}$/.test(key)) return;
    await mkdir(this.dir, { recursive: true });
    const tmp = join(this.dir, `${key}.${process.pid}.tmp`);
    await writeFile(tmp, body, 'utf8');
    await rename(tmp, join(this.dir, `${key}.json`));
  }
}

/** Read and validate a licence evidence JSON file. Throws on any problem (callers fail closed). */
export function loadLicenceEvidence(path: string, source: string): LicenceEvidenceRecord {
  return validateLicenceEvidence(JSON.parse(readFileSync(path, 'utf8')) as unknown, source);
}
