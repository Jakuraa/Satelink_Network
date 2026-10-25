export const EULERPOOL_LICENSING = {
    source: 'eulerpool',
    strategyDerivationPermitted: false, // Pending explicit confirmation in commercial agreement
    displayPermitted: false, // Pending commercial agreement
    redistributionPermitted: false, // Explicitly prohibited
    commercialLicense: false, // UNCONFIRMED — cannot be used for commercial production
    licenseEvidence: null, // No written quote/contract executed yet
};
export class EulerpoolResearchProvider {
    #baseUrl;
    #apiKey;
    #fetch;
    constructor(config = {}) {
        this.#baseUrl = config.baseUrl ?? 'https://api.eulerpool.com';
        this.#apiKey = config.apiKey;
        this.#fetch = config.fetch ?? ((url, init) => globalThis.fetch(url, init));
    }
    get id() {
        return 'eulerpool';
    }
    get licensing() {
        return EULERPOOL_LICENSING;
    }
    /**
     * True only if commercial licensing has been confirmed in writing.
     * Hard-coded to false until commercial approval is granted.
     */
    isCommerciallyApproved() {
        return this.licensing.commercialLicense && this.licensing.licenseEvidence !== null;
    }
    /**
     * Fetch fundamental research metrics for an equity symbol.
     * Throws if invoked in commercial production mode without approved licensing.
     */
    async getFundamentals(symbol, options = {}) {
        if (!options.allowResearchEvaluation && !this.isCommerciallyApproved()) {
            throw new Error(`COMMERCIAL USE BLOCKED: Eulerpool Builder is unconfirmed for commercial use. ` +
                `Written confirmation of commercial rights, strategy derivation, and caching required.`);
        }
        const url = `${this.#baseUrl}/v1/fundamentals?symbol=${encodeURIComponent(symbol)}`;
        const headers = { 'Content-Type': 'application/json' };
        if (this.#apiKey)
            headers['Authorization'] = `Bearer ${this.#apiKey}`;
        const res = await this.#fetch(url, { headers });
        if (!res.ok) {
            throw new Error(`Eulerpool API request failed with status HTTP ${res.status}`);
        }
        const body = (await res.json());
        return {
            symbol,
            peRatio: typeof body['peRatio'] === 'number' ? body['peRatio'] : undefined,
            pbRatio: typeof body['pbRatio'] === 'number' ? body['pbRatio'] : undefined,
            marketCapUsdMinor: body['marketCap'] != null ? BigInt(Math.round(Number(body['marketCap']) * 100)) : undefined,
            dividendYieldBps: body['divYieldBps'] != null ? BigInt(Number(body['divYieldBps'])) : undefined,
            retrievedAt: new Date().toISOString(),
        };
    }
}
//# sourceMappingURL=eulerpool-provider.js.map