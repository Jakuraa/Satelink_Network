# Security triage — dependency advisories (2026-11-09)

Fresh audit of every lockfile on `main` at `dd279db4`, checked against what production deploys. **A PR existing does not
resolve anything here: nothing is merged or deployed, so every row below is still open in production.**

## How production installs
| Surface | Host | Install | Deployed |
|---|---|---|---|
| API | Railway, root directory `/apps/api` | `npm ci` from `apps/api/package-lock.json`, isolated | `dd279db4` |
| satelink.network | Vercel | root lock | `dd279db4` |
| console.satelink.network | Vercel | root lock | `dd279db4` |
| jakuraa.com | Vercel | root lock | **`0388891`**: later production builds were canceled |
| `apps/cms` | none found | own lock | No Vercel project or Railway service; STATUS_MATRIX lists it as obsolete |
| `satelink-mcp` | npm | n/a | Never published (npm 404) |

## Correction to OB-14
OB-14 said live auth was exposed to `better-auth` and `proxy-addr` advisories. **For production this was wrong.** The
production lock has pinned `better-auth` 1.7.11 and `proxy-addr` 2.0.8 since 2026-10-20, a week before the `better-auth`
advisory was published. The vulnerable versions are in the root lock, which CI installs.

Two consequences:
- CI has been testing `better-auth` 1.7.5 while production runs 1.7.11. Release A's auth evidence is on the older version.
- `npm audit` inside `apps/api` walks up to the root lock. Audit an isolated copy to see production.

Limit: before 2026-10-20 the API had no lock and floated on `^1.7.5`. `better-auth` 1.7.7 was published 2026-09-30, so
builds before then ran a vulnerable version, and later ones cannot be established from git. See founder actions below.

## Critical
| Advisory | Package | Vulnerable | Patched | On `main` | Production exposure | PR |
|---|---|---|---|---|---|---|
| [GHSA-2464-fhr4-w9xw](https://github.com/advisories/GHSA-2464-fhr4-w9xw): RCE, librsvg via sharp in the image optimizer | `next` | ≤ 15.5.27 | 15.5.28 with sharp ≥ 0.35.5 | console, corporate 15.5.27; web 15.5.28 **with sharp 0.34.5** | **Version present on all three sites. Trigger looks closed**: no config enables SVG, and an SVG returned 400 locally. Whether Vercel's hosted optimizer uses this sharp is **not established** | #631 |
| [GHSA-965c-763c-88jm](https://github.com/advisories/GHSA-965c-763c-88jm): OAuth state accepted as a magic link, sign-in as another user | `better-auth` | 1.4.0-beta.18 to < 1.7.7 | 1.7.7 | root lock 1.7.5; **API lock 1.7.11** | **Not exposed today** by lockfile and build record. The configuration matches the vulnerable pattern, so the pre-lock window matters | #632 |
| [GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h): IP spoofing through a mis-specified trust subnet | `proxy-addr` | < 2.0.8 | 2.0.8 | root lock 2.0.7; **API lock 2.0.8** | **Not exposed today** | #632 |
| [GHSA-cg2g-xh64-v4q7](https://github.com/advisories/GHSA-cg2g-xh64-v4q7): DOMPurify template bypass in DOM-returning modes | `dompurify` | 3.4.4 to 3.4.16 | 3.4.17 | root lock 3.4.12 via `swagger-ui-react` | In the web bundle; needs `SAFE_FOR_TEMPLATES` with a DOM mode. Whether the docs viewer uses that mode is not established | #632 |
| Same `next` advisory, plus older critical `next` RCEs | `next` | 15.4.11 is below all fixes | Needs next 16 (Payload's peer range forbids patched 15.x) | `apps/cms` | **Not deployed**. No PR; recommend removal | none |

## High
| Package | Where | Production | Status |
|---|---|---|---|
| `next` Server Actions DoS (GHSA-p3m5-59mp-jv5r) | console, corporate, web | Yes | #631 |
| `body-parser`, `follow-redirects`, `ws` | API lock | Yes | #634 |
| `axios`, `compression`, others | root lock | Not the API install | #632 |
| `@modelcontextprotocol/sdk` | root lock | Unpublished | #633 |
| `zod` < 4.6.6 (memory exhaustion) through `@x402/*` | API lock | Yes, live payment rail | #635, **narrows only**: zod 3 stays through `@coinbase/x402` 2.1.0 (latest). Open until upstream moves |
| `postcss` in `next` 15.x | all sites | Build-time, needs attacker-controlled CSS or source maps | Open: needs next 16 |
| `web3`, `abitype` chains through `zod` | API lock | `@openzeppelin/defender-sdk` in `EvmAdapter` | Open: same zod |

Audit after each PR (`--omit=dev`, isolated where relevant):
| Lock | Before | After | Via |
|---|---|---|---|
| Root | 4 critical, 20 high | **0 critical, 15 high** | #631, #632 |
| API | 0 critical, 30 high | 0 critical, 27 high (24 with #635) | #634, #635 |
| Corporate | 1 critical, 1 high | 0 critical, 1 high | #631 |

The high counts include dependents of one root cause, mostly `zod`.

## Coverage gaps found
1. **26 API test files use `node:test`, and CI does not report them.** A broken `@x402` signer passed mocha fully green and
   failed 5 of 7 in `node --test`. Worth fixing on its own.
2. CI runs API tests on the root lock, so the production lock only gets an install and import smoke test.
3. `npm audit` in a workspace package misreports, as above.

## Founder actions
1. Decide on merging #631 → #632 → #633 and #634. Recommended now; they do not depend on the Release A stack.
2. Decide on #635 separately. Holding is defensible: it needs a controlled mainnet settlement and only narrows a high.
3. Confirm with Vercel whether hosted image optimization uses the project's sharp, if you want the historic RCE exposure settled.
4. Decide whether to review sign-ins from before 2026-10-20 for the `better-auth` window. Requires production database access; no agent has run it.
5. Remove or upgrade `apps/cms`.
6. Rotate credentials: see `CREDENTIAL_ROTATION_CHECKLIST.md`.
