# Runbook — Claims signer rotation (F21)

> **Status: PREPARED, NOT EXECUTED.** Every step is a founder action. No agent generates keys,
> signs, broadcasts, or changes Railway variables. Evidence: `docs/build/evidence/SIGNER_AND_FOUNDER_ANSWERS_2026-10-20.md`.

## Why

`ClaimsContract` `0x6987921e2453f360e314e4424F6c2789F10a1CC9` (Polygon 137) accepts EIP-712 claim
signatures from `platformSigner` = `0x966E1Ae22996545015b1414B35234b10719d7Ad4`. That value has not
changed since deployment (block 86,985,310, 2026-05-16). The same address is the treasury and the x402
payTo. Until #549 (merged 2026-10-20, `7581f207`), the backend's claim-signing route was reachable
without staff auth (SEC-1). Treat the old signer key as possibly exposed.

Contract facts (from `contracts/ClaimsContract.sol`):
- `claim()` checks `ECDSA.recover(digest, sig) == platformSigner`.
- `setPlatformSigner(address)` is `onlyRole(DEFAULT_ADMIN_ROLE)` and emits `PlatformSignerUpdated(old, new)`.
- `DEFAULT_ADMIN_ROLE` today: **EOA** `0x3b324B334E1e8ec926310e6716C97A9aF43b667A` (true). Not a Safe.
- Holdings today: 4.281768 USDT, 0 POL.

## 0. Preconditions (stop if any fails)

- `SETTLEMENT_DRY_RUN=1` on Satelink-api (it stays 1 throughout; this runbook never changes it).
- #549 is deployed: `POST https://api.satelink.network/api/nodes/<id>/claim` without staff auth → 401.
- Do **not** send USDT to `0x6987…` until step 4 passes.
- Decide whether `0x966E…` (treasury / x402 payTo) also needs rotating. If its key was ever in Railway,
  Paperclip or CI, plan a treasury migration separately. This runbook covers the claims signer only.

## 1. Offline key generation (founder, air-gapped or hardware wallet)

1. Prefer a hardware-wallet account, or a dedicated signer service under KMS (F4), as the new signer.
   A hot key in a Railway env var is the pattern that made SEC-1 dangerous.
2. If you must use a software key, generate it offline (`cast wallet new` on a machine with no network),
   store it in your password manager, and record **only the address**.
3. The new signer address must differ from `0x966E…`, `0x988f…` and `0x3b32…`. It holds no funds and
   needs no gas: it only signs typed data.

## 2. Move contract admin to a Safe (recommended before step 3)

The admin is an EOA today. Moving it to a Safe means a single leaked key can no longer re-point the signer.
1. Create a Safe on Polygon (app.safe.global), threshold ≥ 2 of N, owners on separate devices.
2. From the admin EOA `0x3b32…`: `grantRole(0x00…00, <SAFE>)`.
3. Verify with `cast call 0x6987… "hasRole(bytes32,address)(bool)" 0x0000000000000000000000000000000000000000000000000000000000000000 <SAFE> --rpc-url https://polygon-bor-rpc.publicnode.com` → `true`.
4. After step 3 succeeds through the Safe, remove the EOA: the Safe calls `revokeRole(0x00…00, 0x3b32…)`
   (or `0x3b32…` itself calls `renounceRole(0x00…00, 0x3b32…)`). Doing step 3 first means admin is never lost.

## 3. Update the contract signer (through the Safe)

1. Safe → New transaction → Contract interaction → `0x6987…`, ABI from `contracts/ClaimsContract.sol`.
2. Call `setPlatformSigner(<NEW_SIGNER_ADDRESS>)`. Collect the threshold signatures and execute.
3. Keep the tx hash for the ledger.

## 4. On-chain verification (anyone can run these, read-only)

```
R=https://polygon-bor-rpc.publicnode.com; C=0x6987921e2453f360e314e4424F6c2789F10a1CC9
cast call $C "platformSigner()(address)" --rpc-url $R              # → NEW_SIGNER_ADDRESS
cast call $C "hasRole(bytes32,address)(bool)" 0x00…00 <SAFE> --rpc-url $R          # → true
cast call $C "hasRole(bytes32,address)(bool)" 0x00…00 0x3b324B334E1e8ec926310e6716C97A9aF43b667A --rpc-url $R  # → false (after renounce)
cast receipt <TX_HASH> --rpc-url $R                                # → status 1, PlatformSignerUpdated log
```
Record the address results and the tx hash in `docs/build/BUILD_LEDGER.md` (F21). Never record keys.

## 5. Point the backend at the new signer (founder; Railway)

1. Replace `SETTLEMENT_EVM_SIGNER_PRIVATE_KEY` on Satelink-api with the new key, or better, remove it
   and wire a KMS signer (F4). Update `POLYGON_SIGNER_ADDRESS` if it names the claims signer.
2. Confirm `SETTLEMENT_DRY_RUN=1` is still set. Claim signing stays refused (503) while it is.

## 6. Revoke the old key

1. `0x966E…` can no longer authorize claims once step 4 passes. Delete the old key from Railway,
   CI secrets, Paperclip remnants, local `.env` files and any password-manager entry labelled as the claims signer.
2. If `0x966E…` is also rotated as treasury: move its funds to the new treasury, update the x402
   `payTo` (Railway `TREASURY_ADDRESS` / x402 config) and the founder-wallet list in `apps/api/src/payments/founder_wallets.js`,
   in a separate reviewed PR.
3. Note the rotation date and the old address in the ledger as retired.

## 7. Optional clean-up of the legacy contract

`0xE475c53B88190FD2130dB1E37504991EFe283fb0` (push model) holds 4.930838 USDT with no withdraw path
(`scripts/deploy-new-claims.md`). Treat it as lost unless a role holder can move the funds. Do not fund it.

## Rollback

If step 3 sets a wrong address, the Safe calls `setPlatformSigner(<correct address>)` again. Nothing
pays out while `SETTLEMENT_DRY_RUN=1`, and the backend refuses to sign (#549).
