## HTTP 402 Payment Required

**Cause:** unpaid request without credentials, keyless payment not attached, or your API key's credit balance is zero.

**Fix:** the 402 body contains machine-readable remediation: pay keylessly per-call via x402 (USDC on Base), or fund your API key with a USDT deposit on Polygon ([Billing](/docs/billing)).

## HTTP 429 Too Many Requests

**Cause:** the abuse limiter — very high volume from automated traffic that continues hammering without valid payment or authorization.

**Fix:** honor the `Retry-After` header. If you are a high-volume caller, register a key and deposit credits, or use the x402 payment rail with appropriate concurrency.

## My deposit hasn't appeared

- Deposits credit after **~25 block confirmations (~5 minutes)** on Polygon.
- The deposit history on the [console](/satelink/os/deposit) refreshes every
  30 seconds.
- Verify the transaction reached the vault
  (`0x577D3716d6Ad5b676d230f5409deF9838FABaCEF`) on
  [Polygonscan](https://polygonscan.com/address/0x577D3716d6Ad5b676d230f5409deF9838FABaCEF).
- **Wrong chain?** USDT sent on any network other than Polygon PoS (137)
  cannot be credited. The console blocks this before it happens; raw
  transfers from other chains are unrecoverable by us.
- **Wrong wallet?** Deposits credit the *sending* wallet's account. If you
  deposited from a wallet that isn't bound to your key, the credit went to
  that wallet's account.

## "No usage data yet" on the dashboard

Charts populate after your first metered call with the selected key. The
empty state shows an exact curl command that works as-is.

## Provider or chain looks down

Check `GET /rpc/health` — per-provider success rates, latency, and last
errors, publicly. The gateway routes around unhealthy providers with circuit
breakers; if every provider for a chain is down, calls to that chain fail
fast rather than hang.

## Still stuck?

- [Status page](https://satelink.network/status)
- [GitHub issues](https://github.com/Jakuraa/Satelink_Network/issues)
  (never for security reports — see [Security](/docs/security))
- Email: satelinknetwork@gmail.com
