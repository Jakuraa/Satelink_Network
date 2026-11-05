// Mock x402 "signature" for the LOCAL preview (Release A, S6). Not cryptographic signing — no keys, no chain.
// Shared by the mock facilitator (verifies) and the scripted machine client (produces).
import crypto from 'node:crypto';

const canonical = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}` : JSON.stringify(v));
export const mockSignature = (authorization) => `0x${crypto.createHash('sha256').update(`satelink-x402-preview-mock|${canonical(authorization)}`).digest('hex')}`;
