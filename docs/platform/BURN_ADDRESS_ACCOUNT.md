# Why an account exists for 0x…dEaD (read-only analysis, 2026-10-13)

Board finding: a recover-challenge probe returned a nonce for
`0x000000000000000000000000000000000000dEaD`. At the time (`main` @ `8ee853cf`), the challenge
endpoint answered **200 + nonce only if an `api_credits` row is bound to the wallet**
(`key_recovery_router.js` `accountForWallet`). So some row has
`lower(wallet_address) = '0x000000000000000000000000000000000000dead'`.

Method: code and docs only. No database access.

## Every code path that can bind a wallet to an `api_credits` row

| path | wallet proof required | can bind `0x…dEaD`? |
|---|---|---|
| `POST /api/keys` (`billing/api_keys_route.mjs:69-98` → `createApiKeyWithCredits`) | **none**: `wallet_address` is taken from the body as-is, with no signature and no format check | **yes**, by anyone, in one request |
| `POST /v1/machine/register` (`routes/machine_onboarding.js:320-352`) | EIP-191 signature must recover to `wallet_address` | no (nobody holds the burn key) |
| x402 settlement (`payments/x402/settlement.js:70-84`) | the payer is the on-chain `from` of a settled USDC transfer | no: the burn address cannot sign an EIP-3009 authorization |
| USDT `DepositListener` (`services/deposit_listener.js`) | credits only existing accounts; never creates one | no |
| console key rotation (`console_accounts/keys.mjs:228`) | copies the old row's wallet | only if the old row already had it |
| Dodo (`routes/internal_dodo.js:267`) | no wallet column written | no |

## Hypotheses (most to least likely)

1. **Someone called `POST /api/keys` with `wallet_address: 0x…dEaD`.** The burn address is a
   common placeholder in docs, SDK examples and scanners. `apps/web/src/app/design/page.tsx:47`
   and `test/vnext_outbound_signer_m7.test.js` use it in this repo. No proof is required, so a
   copy-pasted example or a fuzzing scanner creates exactly this row.
2. **A founder/agent smoke test** against production used the burn address as a "safe" dummy
   wallet through the same route.
3. **A row copied by console key rotation** from an earlier row of type 1 or 2.
4. A data import or manual SQL insert. There is no such script in the repo.

## Why it matters (security blocker, not cosmetic)

The same unsigned binding lets anyone bind **someone else's real wallet**. Three paths then trust
that binding:

- **x402 settlement** credits "the oldest `api_credits` row bound to the payer". A squatter who
  pre-binds a payer's address before that payer's first bundle receives the payer's 1,000-call
  credit on the squatter's `sk_free_…` key.
- The **USDT DepositListener** resolves the deposit sender to an account the same way
  (`resolveAccount({ wallet: from })`).
- **`POST /api/keys/deposit`**'s ownership check (`checkDepositOwnership`) compares the on-chain
  sender with the key's `wallet_address`. A squatter's key passes it, so an unclaimed treasury
  transfer from the victim can be claimed by the squatter. #523 made that claim atomic; it did not
  (and was not meant to) make the binding trustworthy.

Proposed fix (founder decision; it changes a public API): `POST /api/keys` stops accepting
`wallet_address`, or accepts it only with the same signed message `/v1/machine/register`
verifies. Existing unsigned bindings are flagged for review, not deleted.

## What the founder should check (read-only)

```sql
-- 1. The burn-address row(s): when, which tier, any money on it
SELECT id, left(api_key, 8) AS key_prefix, tier, credits_usdt, total_deposited, status,
       demand_source, created_at, (email IS NOT NULL) AS has_email
  FROM api_credits
 WHERE lower(wallet_address) = '0x000000000000000000000000000000000000dead';

-- 2. Any other wallet bound to more than one account (squatting signal)
SELECT lower(wallet_address) AS wallet, COUNT(*) AS accounts, MIN(created_at), MAX(created_at)
  FROM api_credits WHERE wallet_address IS NOT NULL
 GROUP BY 1 HAVING COUNT(*) > 1 ORDER BY 2 DESC;

-- 3. Rows bound to a wallet that never registered via signature nor paid
--    (key prefix sk_free_ + wallet set + no deposit) — candidates for unsigned binding
SELECT left(c.api_key, 8) AS key_prefix, lower(c.wallet_address) AS wallet, c.created_at
  FROM api_credits c
  LEFT JOIN api_deposits d ON d.api_key = c.api_key
 WHERE c.wallet_address IS NOT NULL AND c.api_key LIKE 'sk_free_%' AND d.api_key IS NULL
 ORDER BY c.created_at DESC LIMIT 50;
```

Also check the Railway request logs around row 1's `created_at` for `POST /api/keys`, and the
user agent. Paste the output; the classification goes into `revenue_reconciliation.md`.

The probe that found this wrote one harmless 10-minute nonce row. Since #530, every well-formed
address gets a challenge, so the endpoint no longer reveals whether an account exists.
