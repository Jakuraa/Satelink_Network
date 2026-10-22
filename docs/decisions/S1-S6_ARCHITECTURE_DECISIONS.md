# S-1…S-6 — Architecture decisions (APPROVED 2026-10-22)

Status: **BINDING**. Approved by the founder on 2026-10-22, in the Session A founder decisions. The proposals are
in [`../build/ARCHITECTURE.md`](../build/ARCHITECTURE.md) §6–§7 and [`../build/REVENUE_MODEL.md`](../build/REVENUE_MODEL.md) §3.
Evidence that contradicts any of these goes in [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md). The decision stands until the
founder changes it.

| ID | Decision | Consequences for the build |
|---|---|---|
| **S-1** (approved, **amended**) | There is **one** shared model-provider interface, promoted from `trading-agent/integration`. It lives in **`services/sie`, not `libs/sie`**, so `libs/` stays free of network calls. Trading AI and the Response/Decision API must both use it. There is no second abstraction. | #581 is moved to `services/sie`. `trading-agent/integration` (#579) rebases onto it. Nothing calls it "integrated" until a real OpenRouter request has verified the returned model id, `usage.cost`, timeout and error behaviour (the key arrives in Railway later). Credentials never appear in code or logs. |
| **S-2** | The `ai` package (Vercel AI SDK) is not allowed in `apps/api` or `services/sie`. A UI-only exception for console chat streaming needs its own decision. | Provider adapters are fetch-based with an injected transport. |
| **S-3** | Jev and Laya are **typed classifiers** (`choice` / `score` / `noul`) behind the Decision API and SIE routing. They **never authorize a trade or a payment**. | The SystemOne adapter is **not built** until its contract has been verified against the official TypeSafe/Runware docs and recorded in `docs/build/evidence/`. |
| **S-4** | Money is integer **micro-units (scale 6)** with an explicit currency. Nothing is summed across currencies without an FX entry that records the rate's source. Financial-invariant tests are required. | `bigint` minor units in libs and services. A lint/test forbids float arithmetic in money modules. REAL columns migrate additively (B-07). |
| **S-5** | **Reserve → capture/release is the only charging path** for new capabilities. Refunds are reversals. It must be idempotent, survive a crash, post balanced ledger entries and be covered by reconciliation tests. | The Reservation aggregate and service (#583) get ledger postings plus tests for reserve, capture, release, partial capture, duplicates, a crash mid-capture and recovery. #565 is rebuilt on this path. |
| **S-6** | There is **one authoritative capability/pricing registry**. Every surface derives pricing and availability from it. | Capability Registry v3 (#582), with `pricing` in the REVENUE_MODEL §3 shape. |
| **S-6a** `pricing.quantity` (approved) | `quantity` is the number of `unit`s that `amount_micro` buys (default 1). Unit and meaning are explicit. | Validation rejects amount/quantity combinations that don't match. No price changes. Trading Intelligence stays withheld. |
