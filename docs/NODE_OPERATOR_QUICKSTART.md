> ⚠️ **STALE (marked 2026-07-16):** references contract `0x6987…1CC9`, which was never the production contract (purged from the site in PR #237). Current deposit vault: RevenueVaultV2 `0x577D3716d6Ad5b676d230f5409deF9838FABaCEF`. Verify against CLAUDE.md before trusting anything below.

# Run a Satelink Node — Quick Start

Earn USDT by routing RPC traffic through your server.

## What You Need

| Requirement | Minimum |
|-------------|---------|
| CPU | 2 cores |
| RAM | 2 GB |
| Storage | 20 GB SSD |
| OS | Ubuntu 20.04+ or Debian 11+ |
| Network | Port 8080 open, static IP recommended |
| Wallet | Polygon address (to receive USDT) |

## Earning Potential

- **Revenue split**: Node operators receive 50% of all RPC revenue
- **Current rate**: ~$0.000030 per RPC call
- **Example**: A node handling 1M calls/day earns ~$15/day
- **Payment**: USDT on Polygon, claimed on-chain

## Verified Payment

The Satelink smart contracts are open source:
- [SplitEngine.sol](https://polygonscan.com/address/0x8a9CefBD801574806a634aF179f538ABB5926F5a) — Revenue distribution
- [ClaimsContract.sol](https://polygonscan.com/address/0x6987921e2453f360e314e4424F6c2789F10a1CC9) — Withdrawal claims

Revenue distribution is enforced on-chain — no trust required.

---

## Setup (5 minutes)

### Option A: CLI from source (Recommended)

The agent signs registration and every heartbeat with your **payout wallet** (EIP-191). The key
is read from the `SATELINK_NODE_PRIVATE_KEY` environment variable only — never pass it as a
command-line argument, and keep it off shared machines. (`@satelink/node-agent` is not published to
npm yet; build it from the repository.)

```bash
# 1. Node.js 20+
# 2. Build the agent
git clone https://github.com/Jakuraa/Satelink_Network.git && cd Satelink_Network
npm install --workspace agents/node-agent && cd agents/node-agent && npx tsc -p .

# 3. Register your node (your endpoint must be public http(s) and answer GET /health with 200)
export SATELINK_NODE_PRIVATE_KEY=...   # payout wallet key, used only to sign
node dist/index.js register --endpoint https://YOUR_HOST:8080 --region us-east-1 --type rpc --chains 137

# 4. Start the node (signed heartbeat every 2 minutes). Keep the host clock in sync (NTP):
#    heartbeats more than 5 s ahead or 60 s behind server time are refused.
node dist/index.js start
```

### Option B: Docker

Not available yet: no official image is published.

### Option C: Manual Registration

If you're running your own RPC proxy, registration must be signed by the payout wallet
(EIP-191 `personal_sign`) — this proves you control it. Sign this exact message (7 lines,
`\n`-separated; the wallet in lowercase; `timestamp` is unix milliseconds, valid for 5 minutes):

```
Satelink node registration
wallet: <lowercase wallet_address>
node_type: <node_type>
endpoint: <endpoint_url>
region: <region>
chain_ids: <chain_ids joined by ",">
timestamp: <timestamp>
```

Save as `register.mjs` (it is an ES module: `import` + top-level `await`) and run `node register.mjs`.

```js
// register.mjs — node >= 18, `npm i ethers`
import { Wallet } from 'ethers';
const wallet = new Wallet(process.env.PAYOUT_WALLET_PRIVATE_KEY); // never share or upload this key
const body = { wallet_address: wallet.address, node_type: 'rpc', endpoint_url: 'https://YOUR_HOST:8080',
               region: 'us-east-1', chain_ids: [137, 1, 42161], timestamp: Date.now() };
const message = ['Satelink node registration', `wallet: ${body.wallet_address.toLowerCase()}`,
  `node_type: ${body.node_type}`, `endpoint: ${body.endpoint_url}`, `region: ${body.region}`,
  `chain_ids: ${body.chain_ids.join(',')}`, `timestamp: ${body.timestamp}`].join('\n');
body.signature = await wallet.signMessage(message);
const res = await fetch('https://rpc.satelink.network/api/nodes/register', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
console.log(res.status, await res.json());
```

Heartbeats are signed the same way (message `Satelink node heartbeat` / `node: <nodeId>` /
`timestamp: <ms>` / `endpoint: <endpoint_url or ->`; send `timestamp` and `signature`).

The endpoint must be a public `http(s)` address (no private, loopback or metadata addresses,
no redirects). Your endpoint must respond to `/health` with HTTP 200.

---

## Verify Registration

```bash
node dist/index.js status
```

Expected output (values are examples):
```
Satelink Node Status
--------------------
Node ID:    NODE-us-east-1-a1b2c3d4
Wallet:     0x1234...5678
Region:     us-east-1
Endpoint:   https://YOUR_HOST:8080
Chains:     137
Registered: 2026-10-21T10:00:00.000Z
API:        https://rpc.satelink.network

Network Status: active
Last Heartbeat: 2026-10-21T10:02:00.000Z
Reputation:     0
```

Or check via API:
```bash
curl https://rpc.satelink.network/api/nodes/NODE-us-east-1-YOUR_ID
```

---

## Region Codes

| Region | Code |
|--------|------|
| US East | `us-east-1` |
| EU West | `eu-west-1` |
| Asia Pacific (Mumbai) | `ap-south-1` |
| Asia Pacific (Singapore) | `ap-southeast-1` |

---

## Track Your Earnings

1. Go to [satelink.network/dashboard](https://satelink.network/dashboard)
2. Select "Node Operator"
3. Enter your node ID
4. View earnings, reputation score, and claim history

---

## Heartbeat & Uptime

Your node must send heartbeats every 2 minutes to remain active:
- The CLI agent handles this automatically
- If heartbeats stop for 5+ minutes, status changes to `offline`
- Offline nodes don't receive workloads or earn revenue

---

## Reputation System

| Tier | Score | Benefit |
|------|-------|---------|
| Bronze | 0-250 | Base rate |
| Silver | 251-500 | +10% earnings |
| Gold | 501-750 | +20% earnings |
| Platinum | 751-1000 | +30% earnings, priority routing |

Reputation increases with:
- Consistent uptime
- Low latency responses
- High RPC call volume

Reputation decreases with:
- Missed heartbeats
- Downtime events
- SLA violations

---

## Troubleshooting

### "Endpoint unreachable"
- Ensure your server is accessible from the internet
- Check that port 8080 is open in your firewall
- Verify `/health` endpoint returns HTTP 200

### "Node not found"
- Check your node ID is correct
- Run `node dist/index.js status` to get your node ID

### Node shows "offline"
- Ensure the agent is running: `node dist/index.js start`
- Check logs: `journalctl -u satelink-node` (if using systemd)

---

## Support

- **Discord**: [discord.gg/satelink](https://discord.gg/satelink)
- **Docs**: [docs.satelink.network](https://docs.satelink.network)
- **GitHub**: [github.com/Jakuraa](https://github.com/Jakuraa)

---

## Hardware Recommendations (Optional)

For high-volume operators:

| Tier | Specs | Expected Volume |
|------|-------|-----------------|
| Basic | 2 CPU / 2GB RAM | ~100K calls/day |
| Standard | 4 CPU / 4GB RAM | ~500K calls/day |
| Pro | 8 CPU / 8GB RAM | ~2M calls/day |

---

*Last updated: May 2026*