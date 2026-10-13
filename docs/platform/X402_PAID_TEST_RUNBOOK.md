# Controlled x402 paid test — runbook (NOT RUN)

Board item 3.2. **Do not run until the founder writes "go" in chat.** It is run by the founder
from a **founder-funded test wallet**. Claude Code never holds, generates or sees the private key,
and never broadcasts anything.

## What it proves

After #522 and #527, one $0.10 x402 payment buys 1,000 calls. The client:
1. receives a session key **once** (`X-Satelink-API-Key`);
2. reuses that key, so later calls are not paid again;
3. the server stores only `sha256(key)`, and the key appears in no log.

## Already verified without paying (2026-10-13)

| claim | evidence |
|---|---|
| only the hash is stored | `billing/x402_session_keys.js` `issueSessionKey` inserts `hashSessionKey(key)` into `x402_api_keys.key_hash`; there is no plaintext column |
| key returned once | settlement response + `/v1/x402/key/recover` only; recover revokes earlier keys (`x402_session_key.test.js` k5) |
| never logged | logs carry `sessionKeyHint` (prefix + 4 hex) only; test k6 "no issued key ever reached a log sink" passed (17/17 locally, with #530) |
| guessed or random keys refused | prod, 2026-10-13: random `x402_<64hex>` → **402**; guessed `x402_<random addr>` → **402**; no key header echoed (the refusal came from the capacity gate, `no_authorization`) |
| prod logs | 500 recent `Satelink-api` lines: **0** full-length keys. Weak evidence: that window had no settle or recover event |
| client reuse | `apps/api/test/mcp_session_key_reuse.test.js` 2/2 |

## Preconditions (founder)

1. A **fresh** wallet that holds only test funds: ≥ $0.20 USDC on Base mainnet (`eip155:8453`).
   It needs no ETH (x402 `exact` is gasless for the payer).
2. Before running, add its address (lowercase) to `apps/api/src/payments/founder_wallets.js` via a
   PR, merged and deployed. The settlement then gets `is_test_data = true` and **never counts as
   external revenue**. If this is skipped, the row must be reclassified as `founder` in
   `revenue_reconciliation.md` afterwards.
3. Health check: `curl -s https://api.satelink.network/health` → `"ok":true`.

## Steps (founder's terminal)

```bash
cd apps/mcp-server && npm install --no-package-lock
# The key stays in the founder's shell; do not paste it into chat.
read -s SATELINK_WALLET_PRIVATE_KEY && export SATELINK_WALLET_PRIVATE_KEY

# 1. One paid call (stops at the first settlement)
node client-example.mjs | tee /tmp/x402_paid_1.txt

# 2. Same process: 1 paid + 5 reuse calls. Prints only booleans and the key HINT.
node --input-type=module -e '
import { buildPayingFetch } from "./src/pay.mjs";
import { createRpcExecutor } from "./src/rpc.mjs";
const { fetch, wallet } = buildPayingFetch({});
const run = createRpcExecutor({ fetch, wallet });
let paid = 0;
for (let i = 1; i <= 6; i++) {
  const r = await run({ method: "eth_blockNumber", params: [] });
  if (r.paid) paid++;
  console.log(i, "ok=" + r.ok, "paid=" + Boolean(r.paid), r.credited ? JSON.stringify(r.credited) : "");
}
console.log("wallet", wallet, "paid_calls", paid);
' | tee /tmp/x402_paid_2.txt
unset SATELINK_WALLET_PRIVATE_KEY
```

Step 1 already spends one bundle. Step 2 runs in a new process, which has no stored key, so it
pays once more. That is expected and is the reason for the $0.20 minimum. The repeat-usage proof
is step 2's `paid_calls 1` over 6 calls.

## Expected evidence (paste into chat)

| # | evidence | pass condition |
|---|---|---|
| E1 | step 1 output: settlement tx hash | the tx exists on Base: USDC `Transfer(test wallet → 0x966E…7Ad4, 100000)` |
| E2 | step 2 output | `paid_calls 1`; calls 2–6 `ok=true paid=false`; `calls_remaining` falls by 1 per call |
| E3 | `SELECT count(*) FROM x402_api_keys WHERE payer_address = '<wallet>'` | ≥ 1 (one per settlement); the table has no plaintext column |
| E4 | `SELECT source, amount_usd, is_test_data FROM payment_sources WHERE lower(payer) = '<wallet>'` | 2 rows, `is_test_data = true` (if precondition 2 was done) |
| E5 | `railway logs --service Satelink-api \| grep -cE 'x402_[0-9a-f]{64}'` over the test window | `0` |
| E6 | health after | `"ok":true` |

Classification: **founder/test**. This is never external revenue.

## Open risk this test should settle (found 2026-10-13, read-only)

- **Observed in prod:** a request carrying an *unrecognised* `x402_<64hex>` key gets a capacity
  402 (`error: no_authorization`) with **no x402 `accepts` and no `PAYMENT-REQUIRED` header**. A
  keyless request gets a proper x402 v2 challenge (`exact`, `eip155:8453`, 100000, payTo
  `0x966E…`). `@x402/fetch` can pay only the second kind.
- **Client:** `apps/mcp-server/src/rpc.mjs` keeps its `sessionKey` after a 402. A client whose key
  is revoked (for example by a recover from another process) therefore keeps getting the
  non-payable 402 until it restarts.
- **Unknown:** whether a *valid but exhausted* key gets the payable or the non-payable 402.
  `x402_rail` t13 asserts the payable one and fails on `main`, but t13 still uses the removed
  `x-payer-address` alias, so it is not evidence about prod.

Optional step E7 (same wallet, no extra spend beyond the bundle already bought): keep calling
until `calls_remaining` reaches 0, then record whether the next 402 carries `accepts`.
Pass = it does. Fail = repeat usage dead-ends after 1,000 calls. Then fix both server (payable 402
for exhausted/unknown keys) and client (drop the key on 402 and retry keyless once).

## Stop conditions

Stop and report (do not retry) on any of these: a second `paid=true` in step 2, a 402 on call 2+,
any full key in logs, a settlement not visible on Base, or (E7) a 402 without `accepts` after
exhaustion.
