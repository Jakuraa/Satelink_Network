export const FAIL_CLOSED_LICENSING = (source) => ({
    source,
    strategyDerivationPermitted: false,
    displayPermitted: false,
    redistributionPermitted: false,
    commercialLicense: false,
    licenseEvidence: null,
});
export class LicenceEvidenceError extends Error {
    constructor(message) {
        super(message);
        this.name = 'LicenceEvidenceError';
    }
}
/** Strictly validate an untrusted evidence object. Throws on any deviation. */
export function validateLicenceEvidence(raw, expectedSource) {
    const bad = (m) => {
        throw new LicenceEvidenceError(`licence evidence for '${expectedSource}': ${m}`);
    };
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        bad('not an object');
    const r = raw;
    if (r['source'] !== expectedSource)
        bad(`source must be '${expectedSource}'`);
    if (typeof r['plan'] !== 'string' || r['plan'] === '')
        bad('plan missing');
    if (typeof r['verifiedAt'] !== 'string' || Number.isNaN(Date.parse(r['verifiedAt'])))
        bad('verifiedAt must be an ISO date');
    const strArr = (k) => {
        const v = r[k];
        if (!Array.isArray(v) || !v.every((x) => typeof x === 'string'))
            bad(`${k} must be a string array`);
        return v;
    };
    const sources = strArr('sources');
    if (sources.length === 0)
        bad('at least one source is required');
    const writtenConfirmations = strArr('writtenConfirmations');
    const p = r['permissions'];
    if (!p || typeof p !== 'object')
        bad('permissions missing');
    const pr = p;
    const sd = pr['strategyDerivation'];
    if (sd !== 'INTERNAL_RD_ONLY' && sd !== 'COMMERCIAL' && sd !== 'NONE')
        bad('permissions.strategyDerivation invalid');
    for (const k of ['display', 'redistribution', 'commercialUse'])
        if (typeof pr[k] !== 'boolean')
            bad(`permissions.${k} must be boolean`);
    // Commercial rights are only credible with a written confirmation.
    if ((pr['commercialUse'] === true || sd === 'COMMERCIAL') && writtenConfirmations.length === 0) {
        bad('commercial rights require at least one written confirmation');
    }
    const attribution = r['attribution'];
    if (attribution !== null && typeof attribution !== 'string')
        bad('attribution must be string or null');
    return Object.freeze({
        source: expectedSource,
        plan: r['plan'],
        verifiedAt: r['verifiedAt'],
        sources: Object.freeze([...sources]),
        writtenConfirmations: Object.freeze([...writtenConfirmations]),
        permissions: Object.freeze({
            strategyDerivation: sd,
            display: pr['display'],
            redistribution: pr['redistribution'],
            commercialUse: pr['commercialUse'],
        }),
        attribution: (attribution ?? null),
    });
}
/**
 * LicensingMetadata for a given use. Internal R&D may derive strategies under an
 * INTERNAL_RD_ONLY plan; customer-facing use needs commercial rights.
 */
export function licensingFromEvidence(evidence, source, use) {
    if (!evidence)
        return FAIL_CLOSED_LICENSING(source);
    const p = evidence.permissions;
    const derivation = p.strategyDerivation === 'COMMERCIAL' ||
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
    sources;
    constructor(sources) {
        super(`LICENCE_BLOCKED: data from [${sources.join(', ')}] may not be shown to customers`);
        this.sources = sources;
        this.name = 'LicenceViolationError';
    }
}
/**
 * Fail-closed gate for any customer-facing response. Pass the licensing of every
 * data source that contributed to the response; throws if any of them lacks
 * display rights.
 */
export function assertCustomerDisplayable(licences) {
    const blocked = licences.filter((l) => l.displayPermitted !== true).map((l) => l.source);
    if (blocked.length > 0)
        throw new LicenceViolationError([...new Set(blocked)]);
}
//# sourceMappingURL=licensing.js.map