# FAQ — Satelink Network

## General

**Q: What is Satelink?**

A decentralized RPC gateway where developers get reliable blockchain infrastructure and node operators earn 50% of revenue in USDT.

**Q: Is this real or a testnet simulation?**

**100% real.** Live on Polygon mainnet. Real USDT earnings. Proven on-chain: [TX proof](https://polygonscan.com/tx/0x814d348d3f6cb4164d2aadf99b574d4ca65221d2155a76b0e99a4e8641a1726b).

**Q: How is this different from Infura/Alchemy?**

They're centralized. We're decentralized. Node operators earn directly. Cheaper pricing ($0.000030 vs $0.000040-$0.000060/call).

---

## For Developers

**Q: Why use Satelink instead of my current RPC provider?**

- **Cheaper:** $30/month for 1M calls (vs $40-60 elsewhere)
- **Decentralized:** Not dependent on one company's uptime
- **Transparent:** All revenue on-chain, no black-box billing

**Q: What chains are supported?**

Currently:
- Polygon PoS (mainnet, chain ID 137)
- Polygon Amoy (testnet, chain ID 80002)
- Ethereum (chain ID 1)
- Arbitrum (chain ID 42161)
- Base (chain ID 8453)

**Q: What if Satelink goes down?**

Nodes are distributed globally. If one goes offline, traffic auto-routes to others. No single point of failure.

**Q: Do I need to trust Satelink with my funds?**

No. You deposit USDT to your own account. We deduct per-call. Balance is withdrawable anytime.

**Q: Can I use this in production?**

Yes. 99.8% uptime currently. We recommend a backup RPC as fallback during beta.

---

## For Node Operators

**Q: How much can I earn?**

Depends on traffic routed through your node:

| Traffic | Revenue | Your 50% Share |
|---------|---------|----------------|
| 100K calls/month | $3 | $1.50 |
| 1M calls/month | $30 | $15 |
| 10M calls/month | $300 | $150 |

**Q: Do I need to stake USDT?**

No. Zero staking. Zero lock-up.

**Q: What if I go offline?**

Traffic routes to other nodes. You earn nothing while offline. **No slashing.** Just lost opportunity.

**Q: How do I get paid?**

Claim USDT on-chain anytime via [app.satelink.network/satelink/os/withdraw](https://app.satelink.network/satelink/os/withdraw). Sign EIP-712 message → TX to ClaimsContract → USDT in wallet.

**Q: Is this sustainable?**

Yes. Revenue = real API usage. No emissions. No fake rewards. If developers stop using Satelink, revenue stops. That's the honest model.

---

## Economics

**Q: Where does the USDT come from?**

Developers deposit USDT to use the API. That USDT is split:
- 50% → Node operators
- 30% → Platform fee
- 20% → Distribution pool

**Q: What's the distribution pool?**

20% of revenue goes to a pool. Distributed to top-performing nodes based on uptime and traffic.

**Q: Can the split change?**

The 50/30/20 split is enforced by smart contracts. Any changes would require a new contract deployment.

**Q: What if ClaimsContract runs out of USDT?**

TreasurySettlementJob monitors balance every 5 minutes. If low → Discord alert + manual top-up from platform fees.

---

## Security

**Q: Are the smart contracts audited?**

Internal audit complete. External audit planned. Contracts are open-source: [GitHub](https://github.com/Jakuraa/Satelink_Network/tree/main/contracts).

**Q: What if there's a bug in ClaimsContract?**

GOVERNOR_ROLE can pause claims. Funds remain safe in contract. Bug fixed → unpause.

**Q: Can Satelink steal my USDT?**

No. ClaimsContract enforces the split. Only node operators with valid signatures can claim their earnings.

**Q: What if a node operator cheats?**

Revenue is recorded in PostgreSQL before splits. No recorded revenue = no earnings. On-chain claims require signature verification.

---

## Technical

**Q: What RPC methods are supported?**

All standard Ethereum JSON-RPC methods:
- `eth_blockNumber`, `eth_getBalance`, `eth_call`
- `eth_getTransactionByHash`, `eth_getTransactionReceipt`
- `eth_getLogs`, `eth_estimateGas`, `eth_sendRawTransaction`
- Full list: [Ethereum JSON-RPC Spec](https://ethereum.org/en/developers/docs/apis/json-rpc/)

**Q: What's the latency?**

Average 85ms. Varies by region and node.

**Q: Is there WebSocket support?**

Yes. Connect to `wss://rpc.satelink.network/rpc/ws/polygon` for real-time subscriptions.

**Q: What's the rate limit?**

- Free tier: 200 requests/day
- Paid tier: Unlimited (pay per call)

---

## Roadmap

**Q: What's next?**

1. Chainlist listing (PR #2721 pending) → traffic growth
2. More node operators (target: 10-20 nodes)
3. Additional chains (Solana, Avalanche)
4. AI inference workload (LLM API proxy)
5. Webhook delivery network

**Q: When mainnet?**

**Already live.** This is mainnet. Polygon PoS. Real USDT.

**Q: When token launch?**

No token planned. USDT is the settlement currency. No need for a platform token.

---

## Support

**Q: I need help. Where do I go?**

- Docs: [docs.satelink.network](https://docs.satelink.network)
- Dashboard: [app.satelink.network](https://app.satelink.network)
- Email: support@satelink.network

**Q: Can I contribute code?**

Yes! Repo: [github.com/Jakuraa/Satelink_Network](https://github.com/Jakuraa/Satelink_Network)

See [CONTRIBUTING.md](https://github.com/Jakuraa/Satelink_Network/blob/main/CONTRIBUTING.md).

**Q: How do I report a security bug?**

Email security@satelink.network for critical bugs. Regular bugs → [GitHub Issues](https://github.com/Jakuraa/Satelink_Network/issues).
