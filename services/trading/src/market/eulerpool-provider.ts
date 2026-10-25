/**
 * EulerpoolResearchProvider — Global financial research & fundamental connector.
 *
 * COMMERCIAL EVALUATION STATUS:
 *   - Provider: Eulerpool Builder
 *   - Purpose: Financial research, fundamental metrics, earnings data, macro aggregates.
 *   - Written commercial rights: NOT YET CONFIRMED.
 *   - commercialLicense: false (must remain false until written agreement confirms
 *     runtime API/MCP retrieval by models, derived Decision API outputs,
 *     commercial use, historical backtesting and permitted caching).
 *   - Redistribution: prohibited.
 *
 * DO NOT represent Eulerpool as commercially approved for Satelink service until
 * founder review and legal agreement are formally executed.
 */
import type { LicensingMetadata } from './market-data.js';

export const EULERPOOL_LICENSING: LicensingMetadata = {
  source: 'eulerpool',
  strategyDerivationPermitted: false, // Pending explicit confirmation in commercial agreement
  displayPermitted: false,            // Pending commercial agreement
  redistributionPermitted: false,     // Explicitly prohibited
  commercialLicense: false,           // UNCONFIRMED — cannot be used for commercial production
  licenseEvidence: null,              // No written quote/contract executed yet
};

export interface FundamentalMetrics {
  readonly symbol: string;
  readonly peRatio?: number | undefined;
  readonly pbRatio?: number | undefined;
  readonly marketCapUsdMinor?: bigint | undefined;
  readonly dividendYieldBps?: bigint | undefined;
  readonly retrievedAt: string;
}

export interface EulerpoolProviderConfig {
  readonly apiKey?: string;
  readonly baseUrl?: string;
  readonly fetch?: (url: string, init?: unknown) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;
}

export class EulerpoolResearchProvider {
  readonly #baseUrl: string;
  readonly #apiKey: string | undefined;
  readonly #fetch: (url: string, init?: unknown) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

  constructor(config: EulerpoolProviderConfig = {}) {
    this.#baseUrl = config.baseUrl ?? 'https://api.eulerpool.com';
    this.#apiKey = config.apiKey;
    this.#fetch = config.fetch ?? ((url, init) => globalThis.fetch(url, init as RequestInit));
  }

  get id(): string {
    return 'eulerpool';
  }

  get licensing(): LicensingMetadata {
    return EULERPOOL_LICENSING;
  }

  /**
   * True only if commercial licensing has been confirmed in writing.
   * Hard-coded to false until commercial approval is granted.
   */
  isCommerciallyApproved(): boolean {
    return this.licensing.commercialLicense && this.licensing.licenseEvidence !== null;
  }

  /**
   * Fetch fundamental research metrics for an equity symbol.
   * Throws if invoked in commercial production mode without approved licensing.
   */
  async getFundamentals(symbol: string, options: { allowResearchEvaluation?: boolean } = {}): Promise<FundamentalMetrics> {
    if (!options.allowResearchEvaluation && !this.isCommerciallyApproved()) {
      throw new Error(
        `COMMERCIAL USE BLOCKED: Eulerpool Builder is unconfirmed for commercial use. ` +
        `Written confirmation of commercial rights, strategy derivation, and caching required.`
      );
    }

    const url = `${this.#baseUrl}/v1/fundamentals?symbol=${encodeURIComponent(symbol)}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.#apiKey) headers['Authorization'] = `Bearer ${this.#apiKey}`;

    const res = await this.#fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`Eulerpool API request failed with status HTTP ${res.status}`);
    }

    const body = (await res.json()) as Record<string, unknown>;
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
