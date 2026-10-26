# PayRam Deployment Plan (founder-executed, after the first paying customer)

Status: **PLAN ONLY.** Nothing in this repo installs or runs PayRam. The adapter (`apps/api/src/payments/adapters/payram.mjs`) stays OFF until the founder sets `PAYMENT_PAYRAM=true`.

**Why PayRam:** it adds USDT-TRC20 (Tron), plus Ethereum and other chains, behind the same `PaymentAdapter` contract. It is self-hosted and non-custodial, so Satelink operates it.

Supported networks, from docs.payram.com/support/supported-networks-and-coins (read 2026-10-12):

| Network | Coins |
|---|---|
| Ethereum | ETH, USDC, USDT, PYUSD, cbBTC |
| Base | ETH, USDC, cbBTC |
| Polygon | POL, USDC, USDT |
| Tron | TRX, USDT |
| Bitcoin | BTC |

Satelink's ingestion accepts **USDT and USDC only**. Any other currency is refused by `CURRENCY_DECIMALS`.

## 1. Host

- **Server:** a dedicated VPS. It must **never** be the Railway API host, and nothing else runs on it.
- **Recommended size:** 4 vCPU / 8 GB / 160 GB SSD, in a region near the operator.
- **OS:** Ubuntu LTS with automatic security updates, SSH keys only (no passwords), and `ufw` allowing only 22 (from the operator IP), 80, and 443.
- **DNS:** `pay.satelink.network` as an A record to the VPS. The DNS change is a founder action.
- **TLS:** Let's Encrypt through the PayRam setup or a reverse proxy.

## 2. Install (pinned, reviewed — never `curl | bash` unread)

1. Download the setup script for a **specific tagged version**. Do not take `latest`.
2. Record the version and the script's SHA-256 in `docs/platform/PAYRAM_VERSION.md`.
3. Read the script end to end before running it. Note every package it installs and every port it opens.
4. Prefer the Docker path, with the image pinned **by digest** (`image@sha256:…`), not by tag.
5. Run it as a non-root user with `sudo` only where the script requires it.
6. After install, confirm the open ports with `ss -tlnp` and close anything not needed.

## 3. Wallets and keys

- **Hot wallet:** follow the docs' Hot Wallet Setup. Keep the minimum balance needed for gas on sweeps.
- **Cold wallet sweep:**
  - The destination is the treasury `0x966E1Ae22996545015b1414B35234b10719d7Ad4` on EVM chains.
  - For Tron, create a dedicated Tron treasury address and record it here.
  - The sweep schedule is daily, or whenever the balance exceeds a threshold, whichever comes first.
- **Deposit keys:** the vendor claims "deposit keys never touch the server" (PROVIDER CLAIM). Verify this against the running install before taking real money.
- **API key:** create a project API key in the PayRam dashboard.
  - It is **both** the REST `API-Key` and the webhook HMAC key.
  - Store it only in the Railway secret store or KMS (B-08).
  - It is never committed and never logged.

## 4. Wire to Satelink (behind the flag)

1. Set the PayRam project webhook URL to `https://api.satelink.network/webhooks/payram`.
2. On Railway `Satelink-api`, add `PAYRAM_BASE_URL=https://pay.satelink.network` and the API-key secret (founder action, Railway env).
3. Register the PayRam adapter in the `/webhooks/:provider` router mount. This is a code PR, reviewed.
4. Run one **test** payment and confirm:
   - **Signature:** the webhook carries an `X-Payram-Signature` that verifies.
   - **Events:** `payment_events` gets one row per state.
   - **Ledger:** a balanced `payment`/`subscription` txn is posted on FILLED.
   - **Refusals:** a replayed webhook is a no-op, and a tampered body gets a 401.
5. Only then set `PAYMENT_PAYRAM=true` in production.

## 5. Backups and monitoring

**Backups:**
- PayRam's database: nightly encrypted dump to off-host storage, with 30-day retention.
- Restore test: monthly.
- Wallet seed and recovery material: offline, in two separate locations, with two-person access.

**Monitoring:**
- **Uptime:** checks on `pay.satelink.network`.
- **Disk:** an alert at 80%.
- **Chains:** node and RPC sync lag per chain.
- **Hot wallet:** the balance, so gas is never starved.
- **Webhooks:** the delivery failure rate. Satelink's reconciliation job (Wave 1.9) flags mismatches daily.

**Patching:** subscribe to PayRam releases. Upgrade by pinned version after reading the changelog, with a snapshot taken first.

## 6. Compliance

- **KYC/AML:** these obligations stay with the merchant, Jakuraa Commercial Private Limited (per PayRam's own page). Keep the customer identity checks the console already performs.
- **Professional review:** have a professional review TRC20/USDT receipts for tax and GST treatment before going live.
- **Disclosure:** describe the product exactly as Part A says: "non-custodial AI trading software subscription; Satelink never holds customer funds or executes on its own account."
