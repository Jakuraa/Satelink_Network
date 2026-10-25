# Node auth blast radius (#570 heartbeat signatures, #571 DNS rebinding, #572 signed registration) — 2026-10-21

Evidence for the merge gate in the 2026-10-21 session. Public endpoints only; no database access.

## Active nodes (GET https://api.satelink.network/api/nodes, unauthenticated, 2026-10-21 ~16:10 IST)

| node_id | status | region | Owner |
|---|---|---|---|
| `NODE-ap-south-1-a09becbb` | active | ap-south-1 | **Satelink** — `SELF_NODE_ID` in `apps/api/server.js` (self-heartbeat writes the DB directly, not over HTTP) |
| `NODE-us-east-1-709f443d` | suspended | us-east-1 | external (registered wallet) |
| `NODE-us-east-1-375ef9c8` | suspended | us-east-1 | external |
| `NODE-eu-west-1-5459a34a` | pending | eu-west-1 | external |

**External operator nodes currently active: 0.** No active node would lose the ability to heartbeat.
The 2 suspended nodes stay suspended under #570 until staff reactivate them (founder answer B1).

## Callers of node registration / heartbeat

| Caller | Route used | State today | After #570/#572 |
|---|---|---|---|
| `apps/api/server.js` self-heartbeat | direct DB write | works | unaffected |
| `agents/node-agent/src/index.ts:72,126` | `/nodes/register`, `/nodes/heartbeat` (no `/api` prefix; sends `wallet`/`node_id`, not `wallet_address`/`endpoint_url`) | **already broken** | still broken until it signs (Step 4.1) |
| `docs/NODE_OPERATOR_QUICKSTART.md:74` | `/nodes/register`, unsigned | already wrong path | fixed by #572 (signed message + snippet) |
| `scripts/manual_e2e.sh`, `scripts/simulate_nodes.js`, `scripts/node_lifecycle_test.js` | legacy `/heartbeat`, `/v1/node/heartbeat` | routes not mounted (404) | unaffected |
| `agent/memory/*` notes | mentions only | — | — |
| apps/web, apps/console, apps/mcp-server, packages/sdk | none | — | — |

## Migration plan for future external operators

Operators sign with the payout wallet (EIP-191) using the formats documented in #570 (heartbeat) and #572
(registration); `agents/node-agent` gets the signer in Step 4.1. No operator migration is needed today.
