## How metering works

Billed operations deduct directly from your credit balance and write one immutable revenue event — the canonical record that every dashboard number and receipt traces back to. There are no subscriptions, no seats, and no overage tiers:

- **JSON-RPC Calls**: $0.00003 (USDT) per call
- **Trading Intelligence**: $0.01 (USDT) per call
- **Paper Trading Simulation**: $0.05 (USDT) per simulation run

## Credits

Your API key carries a USDT credit balance:

- **Deposited** — total USDT you've sent to the vault.
- **Spent** — metered usage across API calls.
- **Remaining** — spendable balance. Credits never expire.

Check any time:

```bash
curl https://rpc.satelink.network/api/keys/usage -H "X-API-Key: YOUR_KEY"
```

## Depositing

Deposits are **permissionless** — any wallet can fund any registered account
by sending USDT to the RevenueVault contract on Polygon PoS (chain 137).

1. Get the exact calldata:

   ```bash
   curl "https://rpc.satelink.network/credits/initiate?amount=10"
   ```

   The response includes the vault address
   (`0x577D3716d6Ad5b676d230f5409deF9838FABaCEF`), the USDT contract
   (`0xc2132D05D31c914a87C6611C10748AEb04B58e8F`), and ready-to-send
   `approve` + `deposit` calldata.

2. Send the two transactions from your wallet (approve, then deposit).

3. The deposit listener credits your account after **~25 block
   confirmations (about 5 minutes)**. The
   [Credits & Deposits console](/satelink/os/deposit) shows a live deposit
   history that refreshes every 30 seconds.

### Which account gets credited?

The **sending wallet's** account. If you created your key with the MetaMask
sign-to-create flow, deposits from that wallet credit that key automatically.
The console blocks the flow if you're connected with an unregistered wallet
or on the wrong network — USDT sent on any chain other than Polygon PoS 137
cannot be credited.

## Capacity math

| Deposit | Calls |
|---|---|
| $1 | ≈ 33,333 |
| $10 | ≈ 333,330 |
| $30 | ≈ 1,000,000 |

## Where the money goes

Your spend enters the epoch ledger and settles on-chain to RevenueVaultV2.
The node operator program is paused. Operator payouts are not active —
see [Revenue Model](/docs/revenue-model).
