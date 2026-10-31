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
import { validateLicenceEvidence } from './licensing.js';
export class FileResponseCache {
    dir;
    constructor(dir) {
        this.dir = dir;
    }
    async get(key) {
        if (!/^[a-f0-9]{64}$/.test(key))
            return null;
        try {
            return await readFile(join(this.dir, `${key}.json`), 'utf8');
        }
        catch {
            return null;
        }
    }
    async set(key, body) {
        if (!/^[a-f0-9]{64}$/.test(key))
            return;
        await mkdir(this.dir, { recursive: true });
        const tmp = join(this.dir, `${key}.${process.pid}.tmp`);
        await writeFile(tmp, body, 'utf8');
        await rename(tmp, join(this.dir, `${key}.json`));
    }
}
/** Read and validate a licence evidence JSON file. Throws on any problem (callers fail closed). */
export function loadLicenceEvidence(path, source) {
    return validateLicenceEvidence(JSON.parse(readFileSync(path, 'utf8')), source);
}
//# sourceMappingURL=file-cache.js.map