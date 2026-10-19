**Agent procurement** — the automated workflow (discover → evaluate →
authorize → access → meter → pay → settle) by which software agents and
autonomous callers procure supported digital services programmatically.

**Credit** — prepaid USDT balance attached to an API key, deducted
$0.00003 per metered call. Credits never expire.

**Deposit listener** — the service watching Polygon PoS for USDT transfers
to the RevenueVault; credits the sending wallet's account after ~25
confirmations.

**Distribution pool** — (operator program paused; not paid out) the 20% revenue share designed for top-performing
nodes based on uptime and traffic.

**Epoch** — an aggregation window (~10 minutes) that rolls individual
revenue events into a settlement batch, so settlement doesn't pay per-call
gas.

**HTTP 402 flow** — Satelink's machine onboarding: unfunded or unauthenticated
calls receive `402 Payment Required` with a self-contained, machine-readable
body (x402 payment requirements, registration endpoint, deposit calldata, real minimum, working
examples).

**Machine customer** — a non-human API consumer (agent, bot, service) that
onboards and pays autonomously through the 402 flow or keyless x402 rail.

**Metered rate** — the flat price per billed call: **$0.00003 USDT**
($30 per million calls).

**Node operator** — (program paused; onboarding and payouts not active) a
participant designated to serve routed RPC capacity.

**x402** — HTTP-native keyless payment protocol settling in USDC on Base
(`eip155:8453`), where payment travels directly in the request.

**Revenue event** — the immutable per-call billing record; the canonical
source for every revenue figure. Test/phantom rows are flagged and excluded.

**RevenueVault (V2)** — the production vault contract on Polygon PoS
(`0x577D3716d6Ad5b676d230f5409deF9838FABaCEF`) that receives permissionless
USDT deposits.

**Settlement batch** — a payable rollup of one epoch's revenue with the
50/30/20 split applied; broadcast on-chain when settlement is enabled and
funded.

**Settlement dry-run** — the current safety mode: batches aggregate and are
fully accounted, but on-chain broadcasting is disabled until the signer is
funded, real external revenue crosses the threshold, and a human enables it.

**Wallet-bound key** — an API key created by signing a message with MetaMask
(no gas); deposits from the bound wallet credit the key automatically.
