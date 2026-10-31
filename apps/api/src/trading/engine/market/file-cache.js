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
/**
 * Quota counter persisted to a JSON file, so separate research runs share one monthly
 * count. Increments are serialised within the process; use one runner at a time.
 */
export class FileQuotaStore {
    path;
    #chain = Promise.resolve();
    constructor(path) {
        this.path = path;
    }
    #read() {
        return readFile(this.path, 'utf8').then((t) => JSON.parse(t), () => ({}));
    }
    async #write(d) {
        await mkdir(join(this.path, '..'), { recursive: true });
        const tmp = `${this.path}.${process.pid}.tmp`;
        await writeFile(tmp, JSON.stringify(d), 'utf8');
        await rename(tmp, this.path);
    }
    #serial(fn) {
        const next = this.#chain.then(fn, fn);
        this.#chain = next.catch(() => undefined);
        return next;
    }
    used(p) { return this.#serial(async () => (await this.#read())[p] ?? 0); }
    increment(p) { return this.#serial(async () => { const d = await this.#read(); d[p] = (d[p] ?? 0) + 1; await this.#write(d); return d[p]; }); }
    raiseTo(p, used) { return this.#serial(async () => { const d = await this.#read(); if (used > (d[p] ?? 0)) {
        d[p] = used;
        await this.#write(d);
    } }); }
}
//# sourceMappingURL=file-cache.js.map