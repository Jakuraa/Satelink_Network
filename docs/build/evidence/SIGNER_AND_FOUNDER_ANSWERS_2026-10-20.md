# Signer, claims contract and founder answers A1–A3 — evidence (2026-10-20)

Addresses and balances only. No key material was read. Railway: variable **names** only, plus the
username part of `DATABASE_URL`. On-chain: read-only `eth_call` / `eth_getBalance` on Polygon PoS
(chainId 137, head ≈ block 95,857,944) via public RPCs (publicnode for latest state, dRPC for history).

## Founder answers vs evidence

| Q | Founder answer | Evidence | Result |
|---|---|---|---|
| A1 | settlement signer key in F1 rotation? (bracket not filled → NOT SURE) | On-chain `platformSigner` is unchanged since deploy (below). Rotating an env var does not change what the contract accepts. | **On-chain signer NOT rotated** |
| A2 | API `DATABASE_URL` uses `satelink_app`? (NOT SURE) | Username part of Satelink-api `DATABASE_URL` = `postgres` | **NO** — F1 follow-up still open |
| A3 | `ADMIN_API_KEY` set on Satelink-api? (NOT SURE) | Variable name absent from the 104 Satelink-api variables | **NO (absent)** — after #553, `POST /rpc/keys` and node reputation update return 503 (intended fail-closed) |

Related variable names present (values not read): `SETTLEMENT_EVM_SIGNER_PRIVATE_KEY`, `POLYGON_SIGNER_KEY`,
`POLYGON_SIGNER_ADDRESS`, `FLASHBOTS_SIGNER_KEY`, `CLAIMS_CONTRACT_ADDRESS`, `JWT_SECRET`, `ADMIN_SECRET_TOKEN`,
`SETTLEMENT_DRY_RUN`, `FEATURE_REAL_SETTLEMENT`.

## How the claims contract authorizes the signer (from the repo)

- Backend: `apps/api/src/services/claims/claim_processor.js` signs an EIP-712 `Claim` (domain
  `SatelinkClaims` v1, `verifyingContract = CLAIMS_CONTRACT_ADDRESS`) with `SETTLEMENT_EVM_SIGNER_PRIVATE_KEY`.
  The operator submits it to `claim()` and pays gas (pull model).
- Contract: `contracts/ClaimsContract.sol` — `claim()` does `ECDSA.recover(digest, sig) == platformSigner`.
  `setPlatformSigner(address)` is `onlyRole(DEFAULT_ADMIN_ROLE)`.

## On-chain state

| Contract | Model | `platformSigner` | Admin (`DEFAULT_ADMIN_ROLE`) | POL | USDT |
|---|---|---|---|---|---|
| `0x6987921e2453f360e314e4424F6c2789F10a1CC9` | EIP-712 pull (matches repo source; `usdt()` = Polygon USDT) | `0x966E1Ae22996545015b1414B35234b10719d7Ad4` | `0x3b324B334E1e8ec926310e6716C97A9aF43b667A` (EOA, true); `0x966E…` false; `0x988f…` false | 0 | **4.281768** |
| `0xE475c53B88190FD2130dB1E37504991EFe283fb0` | legacy push model (`platformSigner()` reverts) | n/a | not checked | 0 | **4.930838** (stuck; no withdraw path per `scripts/deploy-new-claims.md`) |

History of `0x6987…`:
- Deployed at block **86,985,310** (2026-05-16 20:40 UTC) — found by archive bisection on `eth_getCode`.
- `platformSigner` sampled at blocks 86,985,311 / 88.0M / 90.0M / 92.0M / 94.0M / 95,857,000 / latest:
  **always `0x966E…7Ad4`** → `setPlatformSigner` has never changed it. This is the pre-rotation signer.
- USDT balance 4,281,768 (6 dp) at every sample from 88.0M onward → no claim has ever paid out.
- A full `PlatformSignerUpdated` log scan was not possible (free RPC limits ranges to 10k blocks); the
  state samples above are the evidence.

EOAs: `0x988fb0ef…0cf91` (CLAUDE.md "signer") 1.4128 POL, nonce 875; `0x3b324B33…667A` (deployer/admin) 2.6976 POL, nonce 6.

Which contract production uses: `CLAIMS_CONTRACT_ADDRESS` is set, but its value was not read (session rule).
`0x6987…` is the only deployed contract whose ABI matches the backend's EIP-712 signer path.

Which address the backend signing key controls: **unknown** (answering needs the secret; founder check below).

## F21 status: **OPEN-CRITICAL**

The contract still accepts signatures from the unrotated, pre-rotation signer `0x966E…`. This holds whatever
A1 says. Funds at risk today: 4.281768 USDT in `0x6987…`, plus anything sent to it later. The signer
address is also the treasury and x402 payTo, so its key protects more than the claims contract.
Runbook: `docs/build/runbooks/SIGNER_ROTATION.md` (prepared, not executed).

Founder checks (no agent can do these):
1. Offline, confirm which address the backend signing key derives to.
2. Do not fund `0x6987…` until the signer is rotated through the runbook.

Backend side: claim signing is staff-only and refused while `SETTLEMENT_DRY_RUN` ≠ `0` since #549 (`7581f207`).
