# Executive Verdict: Satelink Master Audit

**Date:** 2026-10-15 · **Repo:** `Jakuraa/Satelink_Network` `main` @ `94161ef7` · **Mode:** read-only audit. No deploys, transactions, provider contact, DB access or code changes. Only these report files were written.
**Reports:** this directory (14 files + `_research_protocols_and_suppliers.md`). Evidence IDs → `EVIDENCE_REGISTER.md`.

## Verdict in one paragraph

Satelink demonstrably sells **one** thing: **pay-per-call Polygon JSON-RPC**, payable by AI agents through x402 (USDC on Base) or by prepaid USDT credits. The payment plumbing is technically sound and spec-current. But the business is **not ready for a payment-provider application, and not yet a legitimate resale business**.

1. **Supply.** Paid calls are by default proxied to **keyless public RPC endpoints** (PublicNode, dRPC). No supplier's terms confirm resale is permitted.
2. **Positioning.** The live homepage presents Satelink as **"An AI trading operating system"**. Every merchant-of-record reviewed prohibits that category.
3. **Misleading public surfaces.** An AI gateway passes Llama off as GPT-4o/Claude and returns stub "completions". A public endpoint reports $20.53 of "revenue" that is founder test money. Three contradictory price lists are live.
4. **Revenue.** Verified **external revenue is $0.00**.

The founder's broader "machine commerce / API procurement" positioning **is not supported by the code** and is the shape most supplier and provider terms prohibit. The strongest truthful direction is narrower:
- **contracted** pay-per-call RPC for developers and agents;
- card billing through one MoR for the RPC product only;
- Trading AI kept as a separately disclosed, non-paying private beta;
- BYO-key orchestration as a demand-tested next step, not a claim.

## P0 / P1 blockers

**P0** (details in PRIORITIZED_ACTION_PLAN):
1. Unmount the deceptive AI gateway (F-01).
2. Put admin auth on `/api/economics/summary` and `/internal/*-parity` (F-02, F-04).
3. Publish `satelink-mcp` or remove its name from 402 bodies; it is squattable today (F-03).
4. Get written resale rights from an upstream (or run an own node); take keyless public endpoints off the paid path.
5. Make the homepage describe RPC; move Trading AI to "Other products (private beta)".
6. Publish one price list (delete `/v1/plans`; fix "$190/month"; remove free-tier claims).
7. Remove the card→Trading Intelligence boundary, unlist `/v1/intelligence`, and delete the dormant "Local Business Leads" (Google Maps extraction) checkout code.
8. Apply nowhere until 4–7 are live.
9. Rotate pending credentials and set `autoApprove:false`.

**P1:**
- Legal identity on both sites: CIN, registered office, GSTIN, a domain email, phone, a named grievance officer, a consistent founder name.
- Approved Terms, Privacy and Refund policy.
- A CA and lawyer opinion on crypto receipts (GST export status, FEMA bank-channel rule, VDA/FIU).
- MoR selection with written pre-clearance.
- Merge #520 for one canonical ledger.
- Close the x402 settle→record gap.
- One non-founder end-to-end paid test.
- Staging and log retention.

## Decision answers

1. **What does Satelink demonstrably sell today?**
   - Pay-per-call Polygon RPC (x402 $0.10/1,000 calls; USDT credits $0.00003/call).
   - It is live and returns spec-correct 402s.
   - It has never been bought by a verified external customer.
2. **What is broken, incomplete or only documented?**
   - **Broken or misleading:**
     - the AI gateway (F-01)
     - the public revenue endpoint (F-02)
     - unauthenticated internal parity endpoints (F-04)
     - contradictory pricing (F-10, SL-02, SL-03)
     - the unpublished MCP package (F-03)
   - **Not live:**
     - card checkout (TEST mode)
     - Financial OS (#520 draft)
     - settlement payouts (dry-run)
     - refund policy (404)
   - **Not deployed:** Trading AI (unmerged, Gate 0 not passed).
   - **Not mounted:** MEV relay and multi-chain (no evidence).
   - **Only documented or disabled:** API procurement, provider registry, workload marketplace (`/vnext/resell` 503).
3. **What can be sold truthfully and delivered reliably?**
   - Polygon RPC by the call, once it runs on a contracted upstream.
   - Delivery works today; legitimacy of supply does not.
4. **Providers?**
   - **Confirmed unsuitable now:**
     - Razorpay (entity-wide crypto covenant; already suspended)
     - Dodo (prohibits crypto offerings, compute/infrastructure credits, unlicensed financial tools and stored value, and AI-API resale without rights)
     - PayU, Lemon Squeezy, Xflow, Stripe Managed Payments
     - Stripe agentic, stablecoin and MPP products (India not supported)
   - **Awaiting written approval (best fits, RPC product only):**
     - Paddle (primary; avoid "stored value" credits)
     - Polar, Creem, Cashfree
     - Stripe India (invite-only; re-apply with documented cross-border volume)
   - **Crypto rail:** CDP x402 facilitator works technically; India eligibility in the CDP Terms is **unverified**.
5. **Is API procurement with a margin legitimate and viable?**
   - Not as operated.
   - Legitimate only with written supplier resale rights.
   - Generic AI/data API procurement is prohibited or approval-gated by OpenAI, Anthropic, CoinGecko and Firecrawl.
   - Viability is unproven ($0 revenue; price 1.5–40× market).
6. **Which agreements permit resale and automated purchases?**
   - None is confirmed.
   - Approval routes exist: Alchemy, Infura, Ankr, PublicNode.
   - dRPC is undocumented (non-sublicensable licence).
   - QuickNode and Chainstack prohibit resale by default.
   - Infura §3.3 alone explicitly contemplates AI agents using credentials.
7. **Lowest-risk first revenue product?**
   - Prepaid Polygon RPC credits, sold directly to the identified integrators already calling the endpoint.
   - Paid in USDT now (pending CA view), by card via an MoR later, on a contracted upstream.
8. **Should Trading AI remain a separate private beta?**
   - **Yes.** It is a genuinely distinct product (code, users, risk class, gates), so separation is legitimate.
   - Disclose it in every application.
   - No payments, no shared credits, separate terms.
   - Defer Indian-securities automation pending SEBI and legal review.
9. **Website changes that improve clarity without concealing anything?**
   - RPC-led homepage and a single price list.
   - Legal identity block and approved policies.
   - Trading AI in a labelled "Other products: private beta, not for sale" section with its disclosure.
   - Remove unsupported jakuraa.com claims.
   - Detail in WEBSITE_REPOSITIONING_SPEC.
10. **What must change before applying to another provider?**
    - P0-4…P0-7 and P1-1/P1-2 live on both domains.
    - Written answers to the pre-application questions.
    - Dormant unrelated products removed.
11. **Build / buy / partner / defer:**
    - Build fixes and the canonical ledger.
    - Buy an MoR, a log drain and staging.
    - Partner with an RPC supplier and with a CA and lawyer.
    - Defer the marketplace, MPP/ACP, node payouts, the AI gateway and Trading AI payments.
12. **First measurable 7-day milestone:**
    - P0 fixes live, **and** either ≥1 external (non-founder) payer served and reconciled end to end, **or** 5 qualified integrator conversations with recorded reasons for not paying.
13. **Evidence to proceed:**
    - ≥1 external payer plus a repeat payment within 30 days.
    - Written upstream resale permission.
    - One provider approval (or a CA-approved crypto-receipt process).
14. **Evidence forcing NO-GO:**
    - 0 payers after 10 qualified conversations and 30 days, or
    - no supplier grants resale and an own node is uneconomic, or
    - every provider declines the cleaned-up RPC product.

---

# One-page decision memo

**Recommended positioning:** *"Satelink: pay-per-call Polygon RPC for developers and AI agents."* Operated by Jakuraa Commercial Pvt Ltd. Agents pay per request via x402; developers prepay credits. No "AI trading OS", "DePIN", or "machine commerce platform" claims until they are true.

**Recommended first product:** Prepaid Polygon RPC credits (minimum $10), on a contracted upstream, sold first to the integrators already calling the endpoint.

**Recommended payment approach:**
- **Card:** one MoR for the RPC product only. Paddle first, with written pre-clearance and usage-billing rather than stored-value credits; Polar, Creem or Cashfree as backups.
- **Crypto:** keep x402 and USDT as optional, disclosed rails, capped until a CA/lawyer opinion.
- **Never:** route Trading AI, or any resale lacking supplier rights, through any provider.
- **No MPP:** not available to India entities.

**Confirmed facts:**
- External revenue is $0.00.
- x402 v2 is live and correctly implemented (atomic, `tx_hash` UNIQUE).
- Deposits use 25 confirmations and are idempotent.
- Card checkout is in TEST mode.
- Razorpay is suspended.
- Dodo's and Paddle's published policies prohibit trading signals and stored value; Dodo also prohibits crypto offerings.
- Paid RPC defaults to keyless public upstreams.
- Homepage title: "AI trading operating system".
- Gate 0 for Trading AI is not passed.
- `satelink-mcp` is unpublished but advertised.

**Unresolved approvals:**
- Supplier resale permission (none).
- MoR approval (none; Dodo and Cashfree pending under conflicting site content).
- CDP India eligibility (unverified).
- CA/lawyer opinions: crypto receipts, refund policy L1–L10, GST reverse charge.
- SEBI/legal scope for Trading AI.

**P0 actions:**
1. Unmount the AI gateway.
2. Gate the public revenue and parity endpoints.
3. Fix the MCP squat window.
4. Secure upstream resale rights.
5. RPC-led homepage.
6. One price list.
7. Remove the TI card boundary and the leads product.
8. Pause applications.
9. Rotate credentials.

**First revenue experiment:**
- **Days 1–7:** P0 fixes shipped; outreach to ≤10 identified integrators via their public channels with a $10 credit offer; one non-founder x402 test reconciled end to end.
- **Days 8–30:** first repeat payment; MoR decision; BYO-key orchestration waitlist.

**Go:** ≥1 external payer, a repeat payment, written supply rights, and one provider approval within 30 days.
**No-go:** 0 payers after 10 qualified conversations, no supply rights, or all providers decline the cleaned product. Then pivot to BYO-key orchestration software or stop paid Satelink.

---
*Awaiting founder approval before any implementation. Nothing in this audit was deployed, published, sent or merged.*
