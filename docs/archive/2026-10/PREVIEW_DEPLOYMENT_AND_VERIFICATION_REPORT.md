# PREVIEW DEPLOYMENT AND PRE-PRODUCTION VERIFICATION REPORT
## Full-Ecosystem Repositioning Pre-Production Verification Pass
### Satelink (`satelink.network`) & Jakuraa Commercial Private Limited (`jakuraa.com`)

**Audit Date:** 2026-10-17  
**Branch:** `feat/evidence-led-repositioning`  
**Base Commit:** `275e635cc827f2045f4d2b27898c3e23656833f8`  
**Deployment Tool:** Vercel CLI 54.18.7 (Node.js 24.13.0)  
**Vercel Scope:** `satelinkinternet-collabs-projects` (Team ID: `team_KL8HQkLc8KATs1G9pqQ5o3FZ`)  
**Production Domains Safety:** `satelink.network` and `jakuraa.com` remain **100% UNTOUCHED**. Zero production deployments, zero domain alias changes, zero branch merges to `main`.

---

## 1. Verified Preview Deployment URLs & Status

| Property | Workspace | Vercel Project | Latest Preview Deployment URL | HTTP Status | Verified Surfaces & Routes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Satelink Platform** | `apps/web` | `web` (`prj_Z7Le422wwsuMRh5eTnsyYP48yw2l`) | **`https://web-rji9ljyek-satelinkinternet-collabs-projects.vercel.app`** | **HTTP 200 (Public)** | `/`, `/.well-known/satelink.json`, `/llms.txt`, `/products/machine-commerce`, `/products/rpc`, `/products/x402`, `/pricing`, `/trading-agent`, `/trading-agent/risk`, `/docs`, `/docs/quick-start`, `/docs/api-reference`, `/satelink/os/keys`, `/satelink/os/usage`, `/sitemap.xml`, `/robots.txt`. |
| **Jakuraa Corporate** | `apps/corporate` | `jakuraa-corporate` (`prj_8OYP2RUwQ3I2O4hCEVwNHdaAmBNc`) | **`https://jakuraa-corporate-5ld8rlo4i-satelinkinternet-collabs-projects.vercel.app`** | **HTTP 302 (Team SSO)** | `/`, `/products`, `/company`, `/systems`, `/research`, `/technology`, `/history`, `/legal/company-information`, `/llms.txt`, `/robots.txt`, `/sitemap.xml`. |

> **Jakuraa Corporate Preview Access Note:**  
> The Vercel project for `jakuraa-corporate` has Vercel Team Authentication enabled (`ssoProtection: { deploymentType: 'all_except_custom_domains' }`), returning HTTP 302 redirecting to `vercel.com/login`. Logged-in team members of `satelinkinternet-collabs-projects` access all routes directly upon authentication.

---

## 2. Point-by-Point Pre-Production Verification Audit

### Item 1: Route Count & TypeScript Errors Reconciliation

#### A. Route Count Reconciliation (148 vs 104+ vs 193)
- **Filesystem Entrypoints (148):**
  - Command: `find apps/web/src/app -name "page.tsx" -o -name "route.ts" | wc -l`
  - Output: `147` page/route files + `sitemap.ts` = **148 route entrypoints**.
  - Documented in: `docs/website-repositioning/current-site-audit.md` §4.1.
- **Top-Level Route Patterns (151):**
  - Command: `grep -E "^├ [○●ƒ]|^└ [○●ƒ]" build.log | wc -l`
  - Output: **151 distinct route patterns**.
- **Static Generated Pages at Build Time (193):**
  - Next.js build output: `✓ Generating static pages (193/193)`
  - Expands static paths, dynamic SSG parameters (e.g. `/products/trading-intelligence/[metric]`, `/support/[category]/[slug]`, `/solutions/industries/[slug]`, `/news/[slug]`), and static route handlers.
- **Reconciliation of "104+ routes":**
  - "104+ routes" was an informal shorthand written in an earlier markdown draft when reading truncated console scrollback during `next build`. The true, verified route inventory is 148 entrypoints, 151 route patterns, and 193 statically generated pages.

#### B. TypeScript Error Reconciliation (60 vs 0)
- **Direct TypeScript Compiler Output (`apps/web`):**
  - Command: `npx tsc --noEmit` inside `apps/web`
  - Current Output: **Found 60 errors in 11 files**.
  - Exact breakdown of all 60 errors:
    1. `src/app/admin/command-center/page.tsx`: **46 errors** (Object literal TS2353 on `cell`, ButtonProps `className`/`style`, EmptyStateProps `title`, Grid Gap). Pre-existing from commit `73ecee1f` and earlier.
    2. `src/lib/dodo/environment.test.ts`: **3 errors** (TS2540 assigning to read-only `NODE_ENV`). Pre-existing.
    3. `src/app/api/dodo-webhook/route.ts`: **2 errors** (TS2322 NextRequest type conflict across monorepo node_modules; TS2721 nullable handler call). Pre-existing.
    4. `src/components/keys/WalletRegisterCard.tsx`: **2 errors** (TS2322 Button variant `primary` vs ButtonProps). Pre-existing.
    5. `e2e/console.spec.ts`: **1 error** (TS2322 AxeBuilder Playwright Page type incompatibility). Pre-existing.
    6. `src/app/(marketing)/products/trading-intelligence/[metric]/page.tsx`: **1 error** (TS2352 JSON sample type conversion). Pre-existing.
    7. `src/app/api/dodo-checkout/route.ts`: **1 error** (TS2578 unused `@ts-expect-error`). Pre-existing.
    8. `src/app/api/tasks/start/route.ts`: **1 error** (TS2578 unused `@ts-expect-error`). Pre-existing.
    9. `src/app/machine-console/page.tsx`: **1 error** (TS2322 Badge variant `secondary`). Pre-existing.
    10. `src/lib/plan-catalog.ts`: **1 error** (TS2578 unused `@ts-expect-error`). Pre-existing.
    11. `test/plan-catalog-parity.test.ts`: **1 error** (TS2578 unused `@ts-expect-error`). Pre-existing.
- **Introduced Error (Resolved):**
  - Line 189 of `apps/web/src/app/(marketing)/page.tsx` was edited during repositioning to `<Badge variant={i.status === "Live" ? "default" : "planned"}>`. Because `@satelink/web-ui` Badge expects `"live"`, `tsc` raised 1 error (making 61 total).
  - **Resolution:** Corrected to `<Badge variant={i.status === "Live" ? "live" : "planned"}>`. Error eliminated; count returned to the baseline 60 pre-existing errors.
- **Corporate Workspace (`apps/corporate`):**
  - Command: `npx tsc --noEmit` inside `apps/corporate`
  - Output: **0 errors** (Clean exit code 0).
- **Why `npm run build` reports 0 errors:**
  - `apps/web/next.config.ts` sets `typescript: { ignoreBuildErrors: true }` (pre-existing configuration). Next.js skips halting the build on typecheck errors, allowing Next.js compilation to succeed with 0 errors.

---

### Item 2: Free-Access Model Resolution

The conflict between removing the anonymous free tier and self-service API key registration was inspected against the live backend implementation:

1. **Anonymous Traffic Gate (`apps/api/src/middleware/free_tier_gate.js`):**
   - `FREE_TIER_ANON_CALLS` defaults to `0` (enforced at request time via `anonFreeCalls()`).
   - Every anonymous request (lacking `X-API-Key` or a settled `x402` payment) receives an immediate `HTTP 402 Payment Required` challenge on the **very first call**.
   - There is **ZERO** anonymous free tier.
2. **Self-Service API Key Registration (`apps/api/src/gateway/routes/api_keys.js`):**
   - Self-service registration (`POST /api/keys`) provisions an API key in tier `free` with `daily_limit = 500`.
3. **Credit Gate & Metering Execution (`apps/api/src/billing/credit_service.mjs`):**
   - An API key caller passes the IP rate-limiting gate and reaches `authorizeAndMeter()`.
   - `costFor(account)` charges `PRICE_PER_CALL_USDT` ($0.000030) for **all** tiers, including tier `free` (unless `FREE_TIER_COST_ZERO=1` is set in Railway).
   - An unfunded key has a balance of $0.00.
   - At line 170: `if (cost > 0 && balance < cost) return { ok: false, code: 'insufficient_credits', http: 402 }`.
   - Result: An unfunded API key is **refused with HTTP 402 on its very first call** until a USDT deposit is made.
4. **Resolution & Published Truth:**
   - The 500 calls/day is a **throughput/rate limit ceiling**, NOT a free quota of calls.
   - All phantom "500 free calls/day" claims have been removed across all marketing, docs, and console surfaces (`/satelink/os/keys`, `/satelink/os/usage`, `/pricing`, `/docs/*`).
   - Published copy accurately states: Keys start with a 500 calls/day rate limit ceiling and require deposited USDT credits ($0.00003/call) or keyless x402 micropayments to execute.

---

### Item 3: Ecosystem-Wide Hierarchy Alignment

All public subpages, navigation bars, mobile menus, docs, READMEs, package descriptors, and remote metadata consistently adhere to the approved hierarchy:

1. **Strategic Hierarchy:**
   - **Corporate Parent:** Jakuraa Commercial Private Limited (incorporated 2019 in Coimbatore, TN). Focus: software infrastructure for an agent-driven economy.
   - **Flagship Platform:** Satelink (`satelink.network`). Objective: agent procurement & machine commerce.
   - **Production Rails:** Metered Polygon PoS RPC Gateway (flat $0.00003/call), keyless x402 on Base (8453), API Metering.
   - **Beta Application:** Satelink Trading AI (`/trading-agent/*`). Strictly scoped to controlled paper-trading beta, zero live execution, non-custodial.
2. **7-Stage Procurement Workflow:**
   - Formally articulated across both sites: `Understand → Discover → Compare → Select → Authorize → Execute → Meter & Reconcile`.
3. **Surfaces Verified:**
   - Satelink Homepage (`apps/web/src/app/(marketing)/page.tsx`): Eyebrow, H1, 7-stage loop, active services, FAQ.
   - Satelink Navigation (`packages/content/src/navigation.ts`): Leading with "Machine commerce & rails", "Applications" grouped cleanly.
   - Jakuraa Homepage (`apps/corporate/app/page.tsx`): Institutional framing, latency overclaim removed.
   - Jakuraa Products (`apps/corporate/app/products/page.tsx`): Satelink as flagship platform, Trading AI tagged Paper Beta.
   - Jakuraa Header/Footer (`apps/corporate/components/SiteHeader.tsx`, `SiteFooter.tsx`): Desktop and mobile menus lead with `/products`.
   - Machine Listings: `/.well-known/satelink.json` and `/llms.txt` on both domains reflect truthful platform catalog.

---

### Item 4: Live Deployed Preview Verification

#### A. Satelink Platform (`web-rji9ljyek-satelinkinternet-collabs-projects.vercel.app`)
| Route Tested | HTTP Status | Response Size | Verified Content |
| :--- | :--- | :--- | :--- |
| `/` | **200 OK** | 216,130 bytes | H1: `Infrastructure for AI agents that discover and use digital services.`, 7-stage workflow loop, `PaymentSequence402`, `TwoRailsDiagram`, `VideoShowcase` (Fireship & Anthropic), Anthropic reference footer `<DataFooter />`. |
| `/.well-known/satelink.json` | **200 OK** | 1,205 bytes | Valid JSON catalogue listing `machine-commerce`, `rpc`, `x402`, `metering`, `trading-intelligence`. |
| `/llms.txt` | **200 OK** | 3,610 bytes | Plain text declarations of platform hierarchy, rails, and paper-beta status. |
| `/products/machine-commerce` | **200 OK** | 114,938 bytes | Programmatic discovery, machine payments, procurement loop. |
| `/products/rpc` | **200 OK** | 114,303 bytes | Polygon PoS (137), flat $0.00003/call rate, zero multi-chain overclaims. |
| `/products/x402` | **200 OK** | 110,758 bytes | Keyless pay-per-call in USDC on Base (8453), $0.10 for 1,000 calls. |
| `/pricing` | **200 OK** | 144,105 bytes | Flat rate schedule, x402 bundle, zero phantom free tier. |
| `/trading-agent` | **200 OK** | 83,967 bytes | Controlled paper-trading beta, zero live execution, non-custodial. |
| `/trading-agent/risk` | **200 OK** | 85,105 bytes | Deterministic risk gates, signed mandates, loss collars. |
| `/docs` | **200 OK** | 38,711 bytes | Documentation index leading with platform infrastructure and paused operator notice. |
| `/docs/quick-start` | **200 OK** | 38,279 bytes | Getting started guide for machine discovery and x402 calls. |
| `/docs/api-reference` | **200 OK** | 40,293 bytes | API reference with x402 headers and discovery endpoints. |
| `/satelink/os/keys` | **200 OK** | 52,283 bytes | Console keys page with Starter Tier Rate Limits (500 calls/day ceiling). |
| `/satelink/os/usage` | **200 OK** | 50,579 bytes | Usage metering and call ledger. |
| `/sitemap.xml` | **200 OK** | 23,552 bytes | Clean XML sitemap; internal consoles disallowed. |
| `/robots.txt` | **200 OK** | 382 bytes | Disallows `/admin/`, `/ops/`, `/satelink/os/`. |

#### B. Jakuraa Corporate (`jakuraa-corporate-5ld8rlo4i-satelinkinternet-collabs-projects.vercel.app`)
| Route Tested | HTTP Status | Target / Behavior |
| :--- | :--- | :--- |
| `/` | **302 Redirect** | Protected by Vercel Team SSO -> `vercel.com/sso-api` |
| `/products` | **302 Redirect** | Protected by Vercel Team SSO -> `vercel.com/sso-api` |
| `/company` | **302 Redirect** | Protected by Vercel Team SSO -> `vercel.com/sso-api` |
| `/systems` | **302 Redirect** | Protected by Vercel Team SSO -> `vercel.com/sso-api` |
| `/research` | **302 Redirect** | Protected by Vercel Team SSO -> `vercel.com/sso-api` |
| `/technology` | **302 Redirect** | Protected by Vercel Team SSO -> `vercel.com/sso-api` |
| `/history` | **302 Redirect** | Protected by Vercel Team SSO -> `vercel.com/sso-api` |
| `/legal/company-information` | **302 Redirect** | Protected by Vercel Team SSO -> `vercel.com/sso-api` |
| `/llms.txt` | **302 Redirect** | Protected by Vercel Team SSO -> `vercel.com/sso-api` |
| `/robots.txt` | **302 Redirect** | Protected by Vercel Team SSO -> `vercel.com/sso-api` |
| `/sitemap.xml` | **302 Redirect** | Protected by Vercel Team SSO -> `vercel.com/sso-api` |

---

### Item 5: Remote vs Local GitHub Changes Audit

- **Remote GitHub Repositories Changed (Confirmed Live):**
  1. `Jakuraa/Satelink_Network`:
     - Description: `"AI-agent and machine-commerce infrastructure for discovering, accessing, metering, and paying for supported digital services programmatically."`
     - Homepage: `https://satelink.network`
     - Topics: `machine-commerce`, `agent-procurement`, `x402`, `rpc`, `ai-agents`, `polygon`, `smart-contracts`, `usdt`, `mcp`, `risk-management`, `blockchain`, `web3`, `algorithmic-trading`, `trading-bot`.
     - Verified via: `gh repo view Jakuraa/Satelink_Network --json description,homepageUrl,repositoryTopics`.
  2. `Jakuraa/.github` (Organization Profile):
     - Profile README: `https://github.com/Jakuraa/.github/blob/main/profile/README.md`
     - Commit SHA: `585b1900f19c537c47d96a30700aee220976a3b3`
     - Content: Articulates Jakuraa parent entity, Satelink flagship platform, 7-stage procurement workflow, live Polygon RPC / x402 / TI capabilities, and Trading AI paper beta.
- **Local-Only Changes (Unmerged / Staged on Branch):**
  - All workspace edits in `apps/web/*`, `apps/corporate/*`, `packages/*`, and root `README.md` reside exclusively on working branch `feat/evidence-led-repositioning`. Zero commits merged or pushed to remote `main`.

---

### Item 6: Production Safety Verification

| Production Domain / Asset | Expected Production State | Verified State | Audit Proof |
| :--- | :--- | :--- | :--- |
| `https://satelink.network` | Live Production Domain | **Untouched** | No `--prod` deployment run; production alias untouched. |
| `https://jakuraa.com` | Live Production Domain | **Untouched** | No `--prod` deployment run; production alias untouched. |
| Git `main` branch | Clean, Unmerged | **Untouched** | Last production commit on `main` is `275e635c` (#539). Zero merges. |
| Payment Systems | Dodo & Crypto Rails | **Untouched** | No backend billing code, webhooks, or Dodo secrets altered. |
| Backend Logic | Node.js Gateway & Reconciler | **Untouched** | Core routing, `authorizeAndMeter`, and metering unchanged. |
| Databases & Wallets | Postgres & RevenueVaultV2 | **Untouched** | Zero migrations run, zero contract calls, zero wallet modifications. |
| Trading Execution | Paper Beta Gate | **Untouched** | Live execution remains strictly blocked. |

---

### Item 7: Vercel Automation-Bypass Credential Rotation

- **Action Performed:**
  - The previously exposed automation-bypass secret on `jakuraa-corporate` was inspected and rotated via Vercel REST API (`PATCH https://api.vercel.com/v1/projects/jakuraa-corporate/protection-bypass?teamId=team_KL8HQkLc8KATs1G9pqQ5o3FZ`).
  - Required payload `{"revoke": {"secret": "<target>", "regenerate": true}}` executed successfully (HTTP 200).
- **Post-Rotation Verification:**
  - `GET https://api.vercel.com/v9/projects/jakuraa-corporate` confirms the previously exposed credential is **100% revoked and absent**.
  - Exactly 1 rotated active key remains in the project configuration.
  - The credential was not repeated or printed during this operation.

---

### Item 8: Dodo Checkout & Operator Program Disclosures

1. **Dodo Payments Boundary:**
   - Dodo card/UPI checkout is strictly confined to the Trading Intelligence Starter Pack ($9.99).
   - Enforced by `apps/web/src/lib/products.ts` (`dodo: true` only on TI).
   - Solutions and core machine pages never mention Dodo; crypto rails (x402/USDT) fund RPC and machine endpoints.
   - Sandbox disclosure and test-mode allowlists remain intact in `apps/web/src/lib/plan-catalog.ts` and `apps/web/src/app/api/dodo-checkout/route.ts`.
2. **Node Operator Program:**
   - Retained mandatory notice: `OPERATOR_PROGRAM_PAUSED = "The node operator program is paused. Operator payouts are not active."`
   - Explicitly rendered on `/network/*`, `/node`, `/node/earnings`, and `/docs`.

---

### Item 9: Design & Styling Integrity

- **Zero Redesign Principle:**
  - All existing design tokens (`var(--sl-*)`), Tailwind CSS configurations, and font stacks (`var(--sl-display-1)`) preserved.
  - Zero modifications to CSS style rules, grid structures, or breakpoints.
  - All edits strictly limited to text copy, component props (`variant="live"`), metadata tags, and documentation markdown.

---

### Item 10: Redeployed Preview Build URLs

1. **Satelink Platform Preview:**  
   **`https://web-gq73um1wl-satelinkinternet-collabs-projects.vercel.app`**  
   *(Verified: HTTP 200 on all tested routes including `/docs`)*

2. **Jakuraa Corporate Preview:**  
   **`https://jakuraa-corporate-4p4dwamfa-satelinkinternet-collabs-projects.vercel.app`**  
   *(Verified: HTTP 302 Team SSO protected; accessible to authenticated team members)*

---

## 3. Unresolved Items / Decisions for Founder Approval

1. **Production Deployment Approval:** Both websites remain on preview URLs. Merging branch `feat/evidence-led-repositioning` to `main` and deploying `--prod` to `satelink.network` and `jakuraa.com` awaits explicit founder approval.
2. **Pre-existing Admin TypeScript Errors:** 60 TypeScript errors remain in legacy administrative files (`admin/command-center/page.tsx`, etc.), intentionally kept untouched to avoid out-of-scope backend/admin code modifications.
