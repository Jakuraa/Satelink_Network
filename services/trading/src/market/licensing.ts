/**
 * Licensing metadata built from an evidence record, never from code constants.
 *
 * The evidence record (e.g. docs/build/evidence/licences/eulerpool.json) states
 * the plan, the date it was verified, the sources consulted and any written
 * confirmations. LicensingMetadata is derived from it here. Anything missing or
 * malformed fails closed: every permission false.
 */
import type { LicensingMetadata } from './market-data.js';

export type LicenceUse = 'INTERNAL_RESEARCH' | 'CUSTOMER_FACING';

export interface LicenceEvidenceRecord {
  readonly source: string;
  readonly plan: string;
  /** ISO date the terms were read. */
  readonly verifiedAt: string;
  /** Public terms / pricing pages consulted. */
  readonly sources: readonly string[];
  /** Written confirmations from the provider (email ids, contract refs). Empty for public-terms-only plans. */
  readonly writtenConfirmations: readonly string[];
  readonly permissions: {
    readonly strategyDerivation: 'INTERNAL_RD_ONLY' | 'COMMERCIAL' | 'NONE';
    readonly display: boolean;
    readonly redistribution: boolean;
    readonly commercialUse: boolean;
  };
  readonly attribution: string | null;
}

export const FAIL_CLOSED_LICENSING = (source: string): LicensingMetadata => ({
  source,
  strategyDerivationPermitted: false,
  displayPermitted: false,
  redistributionPermitted: false,
  commercialLicense: false,
  licenseEvidence: null,
});

export class LicenceEvidenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LicenceEvidenceError';
  }
}

/** Strictly validate an untrusted evidence object. Throws on any deviation. */
export function validateLicenceEvidence(raw: unknown, expectedSource: string): LicenceEvidenceRecord {
  const bad = (m: string): never => {
    throw new LicenceEvidenceError(`licence evidence for '${expectedSource}': ${m}`);
  };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) bad('not an object');
  const r = raw as Record<string, unknown>;
  if (r['source'] !== expectedSource) bad(`source must be '${expectedSource}'`);
  if (typeof r['plan'] !== 'string' || r['plan'] === '') bad('plan missing');
  if (typeof r['verifiedAt'] !== 'string' || Number.isNaN(Date.parse(r['verifiedAt']))) bad('verifiedAt must be an ISO date');
  const strArr = (k: string) => {
    const v = r[k];
    if (!Array.isArray(v) || !v.every((x) => typeof x === 'string')) bad(`${k} must be a string array`);
    return v as string[];
  };
  const sources = strArr('sources');
  if (sources.length === 0) bad('at least one source is required');
  const writtenConfirmations = strArr('writtenConfirmations');
  const p = r['permissions'];
  if (!p || typeof p !== 'object') bad('permissions missing');
  const pr = p as Record<string, unknown>;
  const sd = pr['strategyDerivation'];
  if (sd !== 'INTERNAL_RD_ONLY' && sd !== 'COMMERCIAL' && sd !== 'NONE') bad('permissions.strategyDerivation invalid');
  for (const k of ['display', 'redistribution', 'commercialUse']) if (typeof pr[k] !== 'boolean') bad(`permissions.${k} must be boolean`);
  // Commercial rights are only credible with a written confirmation.
  if ((pr['commercialUse'] === true || sd === 'COMMERCIAL') && writtenConfirmations.length === 0) {
    bad('commercial rights require at least one written confirmation');
  }
  const attribution = r['attribution'];
  if (attribution !== null && typeof attribution !== 'string') bad('attribution must be string or null');
  return Object.freeze({
    source: expectedSource,
    plan: r['plan'] as string,
    verifiedAt: r['verifiedAt'] as string,
    sources: Object.freeze([...sources]),
    writtenConfirmations: Object.freeze([...writtenConfirmations]),
    permissions: Object.freeze({
      strategyDerivation: sd as LicenceEvidenceRecord['permissions']['strategyDerivation'],
      display: pr['display'] as boolean,
      redistribution: pr['redistribution'] as boolean,
      commercialUse: pr['commercialUse'] as boolean,
    }),
    attribution: (attribution ?? null) as string | null,
  });
}

/**
 * LicensingMetadata for a given use. Internal R&D may derive strategies under an
 * INTERNAL_RD_ONLY plan; customer-facing use needs commercial rights.
 */
export function licensingFromEvidence(evidence: LicenceEvidenceRecord | null, source: string, use: LicenceUse): LicensingMetadata {
  if (!evidence) return FAIL_CLOSED_LICENSING(source);
  const p = evidence.permissions;
  const derivation =
    p.strategyDerivation === 'COMMERCIAL' ||
    (p.strategyDerivation === 'INTERNAL_RD_ONLY' && use === 'INTERNAL_RESEARCH');
  return Object.freeze({
    source,
    strategyDerivationPermitted: derivation,
    displayPermitted: p.display && p.commercialUse,
    redistributionPermitted: p.redistribution,
    commercialLicense: p.commercialUse,
    licenseEvidence: `${evidence.plan} plan, verified ${evidence.verifiedAt}; ${evidence.writtenConfirmations.length} written confirmation(s)`,
  });
}

export class LicenceViolationError extends Error {
  constructor(readonly sources: readonly string[]) {
    super(`LICENCE_BLOCKED: data from [${sources.join(', ')}] may not be shown to customers`);
    this.name = 'LicenceViolationError';
  }
}

/**
 * Fail-closed gate for any customer-facing response. Pass the licensing of every
 * data source that contributed to the response; throws if any of them lacks
 * display rights.
 */
export function assertCustomerDisplayable(licences: readonly Pick<LicensingMetadata, 'source' | 'displayPermitted'>[]): void {
  const blocked = licences.filter((l) => l.displayPermitted !== true).map((l) => l.source);
  if (blocked.length > 0) throw new LicenceViolationError([...new Set(blocked)]);
}
