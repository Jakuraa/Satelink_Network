# Revenue reconciliation — fill-in template

Companion to `REVENUE_RECONCILIATION_2026-10-12.md` (queries) and
`revenue_reconciliation_2026-10-12.sql` (Q1–Q8, C1). This file holds the **results**.

## Rules

- Claude Code does not read the production database. Every figure here comes from output the
  founder pastes into chat. Until a row has a pasted result, its status is **UNVERIFIED** and it
  may not be quoted anywhere (site, deck, grant, admin UI).
- Each pasted result records: query id, UTC timestamp of the run, source (DB host label, never the
  URL or credentials), and the person who ran it.
- Each figure gets exactly one classification:
  - **external**: paid by a party the founder does not control, on a mainnet rail.
  - **founder**: paid from a founder-controlled wallet, card, or email (see the attribution
    section below), even on mainnet.
  - **test**: testnet, `is_test_data = true`, or a staged/fixture row.
  - **simulated**: produced internally with no money moving (e.g. settlement batches while
    `SETTLEMENT_DRY_RUN=1`). Never revenue.
- Admin metrics change only when a pasted result supports the change. On-chain attribution below
  is evidence for the founder to confirm, not a basis to change metrics by itself.

## How to run (founder)

```bash
PGOPTIONS='-c default_transaction_read_only=on' \
  psql "$DATABASE_PUBLIC_URL" -f docs/platform/revenue_reconciliation_2026-10-12.sql
```

Paste the complete output into chat. Do not paste the connection string.

## Results

Run metadata (fill on paste):

| field | value |
|---|---|
| query run at (UTC) | — |
| source | — (e.g. "Railway Postgres-iQeW, read-only session") |
| run by | — |
| SQL file commit | — |

| # | figure | query | pasted result | classification | status |
|---|---|---|---|---|---|
| R1 | external funds collected, all rails | Q1 | — | — | UNVERIFIED |
| R2 | card deposits ($19.98 reported) | Q2, Q8 | — | — | UNVERIFIED |
| R3 | x402 settlements ($0.20 reported) | Q3, Q7 | — | — | UNVERIFIED |
| R4 | credit liabilities (unconsumed prepaid) | Q4 | — | — | UNVERIFIED |
| R5 | metered usage | Q5 | — | — | UNVERIFIED |
| R6 | settlement batches ($294.29 reported) | Q6 | — | simulated (by definition while `SETTLEMENT_DRY_RUN=1`) | UNVERIFIED |
| C1 | payments without a credit row | C1 | — | — | UNVERIFIED |

Identities to check once filled: Q1 = Σ Q2; Q3 ≤ Q1; C1 empty; Q6 never added to Q1–Q5.

## R2: card provider of record (resolves the "Stripe" contradiction)

- The code has **no Stripe integration**: zero Stripe payment code in `apps/api/src` (the only
  matches are comments in `monitoring/nodeops_waterfall.js`, `ops-agent/nodeops_waterfall.js`, and
  `queue/adapters/webhook_adapter.js`).
- The only card rail that writes `payment_sources` is **Dodo** (`source = 'dodo'`,
  `routes/internal_dodo.js`, `pricing_v2/webhooks.mjs`; allowed values in
  `db/dodo_rail_schema.js:30` are `polygon_usdt_vault, x402, dodo, marketplace, other`).
- `docs/execution/FOUNDER_GATES.md` records a $19.98 Dodo credit on key 132 (`sk_dodo_…46a5`)
  as **founder email**.
- **Decision rule:** the provider for $19.98 is whatever `source` value Q2/Q8 return. The
  "Stripe" label is not used again unless Q8 returns a non-Dodo card source. If Q8 shows
  `dodo` for a founder-email account, R2 is classified **founder**, not external.

## R3: x402 payer attribution from public Base chain data

Method: `eth_getLogs` for `Transfer(from, to = payTo)` on Base mainnet (USDC and every other
ERC-20), from block 46,000,000 (≈ late June 2026) to block 52,562,767 (2026-10-13 18:15 UTC).
Base Sepolia USDC was scanned from genesis. Polygon inflows to RevenueVault V1/V2 and the treasury
were scanned for the last 9,000,000 blocks. payTo `0x966E1Ae22996545015b1414B35234b10719d7Ad4`
is confirmed live at `https://api.satelink.network/.well-known/x402` (network `eip155:8453`).
`settlement.js` records `payment_sources.payer` as the authorization's `from`, which is the
on-chain sender of the USDC transfer.

### The two named payers, 0x1d5f… and 0x83c1…

**UNDETERMINED.** Neither prefix appears as a sender to payTo on Base mainnet (any token), Base
Sepolia (USDC), or to the vaults/treasury on Polygon. Possible explanations, in order of
likelihood:
1. The prefixes are not payer addresses (e.g. a key prefix, tx-hash prefix, or `client_id`).
2. The DB rows were written by a path other than `settlement.js` (e.g. a staged/fixture row or a
   `vnext` verifier path) and never settled on-chain. Such rows must be classified **test**.
3. The payment went to a different payTo (env override at the time). This would show in Q7's
   `network` and `tx_hash` columns.

Resolution: Q7 returns the full payer and tx hash for every x402 row. Each tx hash either
exists on Base with `to = payTo`, or the row is not real money.

### Every x402 sender actually observed on-chain (Base mainnet → payTo)

| block | sender | USDC | tx | classification | evidence |
|---|---|---|---|---|---|
| 48,425,154 | `0x175727…0dfd` | 0.001 | `0x93c886…` | founder | in `FOUNDER_WALLETS` (mainnet validation machine) |
| 48,426,058 | `0x175727…0dfd` | 0.001 | `0x6a466e…` | founder | same |
| 48,467,412 | `0x175727…0dfd` | 0.10 | `0x1f08e1…` | founder | same |
| 48,468,033 | `0x175727…0dfd` | 0.10 | `0x0e0a72…` | founder | same |
| 49,153,285 | `0xa41e58…c61a` | 0.10 | `0x485035…` | **founder (probable, needs confirmation)** | sent 1.0 USDC to founder wallet `0x175727…` at block 48,424,170, 984 blocks (~33 min) before that wallet's first x402 payment (tx `0x65df31…`); EIP-7702-delegated EOA (code `0xef0100 63c0c19a…`); also the **only** USDC funder of `0x9cca…` |
| 49,415,183 | `0x9ccafb…95d4` | 0.10 | `0x7bc612…` | **founder (probable, needs confirmation)** | sole USDC inflow is 1.2 USDC from `0xa41e…` (block 49,415,092, 91 blocks before paying); nonce 0; Satelink is its only USDC recipient |
| 51,418,220 | `0x7dd813…17d2` | 0.10 | `0x9ea2d8…` | **external** | pays 664 distinct USDC recipients (x402 crawler/agent pattern); funded by unrelated wallets (incl. a high-nonce hot wallet `0xf9a316…`, nonce 172,315); no flow to or from any founder wallet |

Total observed on-chain into payTo since block 46M (USDC, x402-sized): $0.502, of which
founder-listed $0.202, founder-probable $0.20, external $0.10. **UNVERIFIED against the DB**
until Q7 is pasted. The only other inflows in the window are four transfers of unrelated,
non-USDC token contracts (`0x1b039f12…`, `0xf98eabd6…`, `0x0137bed2…`, `0x33c62b56…`; blocks
46.12M–47.31M, before the bundle rail). This is the airdrop/address-poisoning spam pattern, not
revenue.

Funding-source checks of the four `FOUNDER_WALLETS` on Base (USDC, from block 40M): the only
inbound transfer to any founder wallet is the 1.0 USDC from `0xa41e…` above.

### Founder actions

1. Confirm whether `0xa41e581e9713c5bd42936b3dbca92af95e8bc61a` (MetaMask smart account) and
   `0x9ccafb98e6f130884b139b1f944da814fcd395d4` are yours. If yes, they go into
   `apps/api/src/payments/founder_wallets.js` in a separate PR, and their rows become founder.
2. Run the SQL file and paste the output, including Q7 and Q8.
