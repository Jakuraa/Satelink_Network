# AC13 — public claims audit (2026-11-09)

Scope: satelink.network and jakuraa.com, rendered output of local production builds at this branch.
Rule: D14 (locked): Satelink AI Assistance is the product; "Trading Intelligence = internal metered tools inside
Trading AI. Not a standalone product page."; "AI-agent & machine-commerce infrastructure" is a rejected identity.

## Corrected in this PR
| Surface | Was | Now |
|---|---|---|
| `/products/trading-intelligence/*`, `/intelligence/*` metric pages | Standalone product pages, in the sitemap | 308 to `/trading-agent/product`; route removed; `/intelligence/success` still works |
| `llms.txt`, `llms-full.txt`, `pricing.json`, `.well-known/satelink.json`, `/products/trading-intelligence.json` | Listed as a product | Not listed; the JSON returns 404 |
| `/machine` | x402 shown protecting `/v1/intelligence/*` at $0.01 | `POST /rpc/polygon`, $0.10 = 1,000 calls, matching live `/.well-known/x402` |
| Overview, developer API, quickstart, SDKs, academy, solutions, industries, platform, support, plans, home | Product copy and examples | RPC and discovery examples, or removed |
| Site metadata, footer, FAQ, docs, README, all of jakuraa.com | "AI-agent and machine-commerce infrastructure" | "AI assistance and agent commerce for people, developers, AI agents and machines" |
| jakuraa.com FAQ, README | Two different wrong CINs | D14 CIN |
| jakuraa.com history, status note | "market intelligence", "trading intelligence systems" | Removed |

## Evidence
| Check | Result |
|---|---|
| Crawl: web | 143 URLs, 0 broken, hits only on the surfaces listed below |
| Crawl: corporate | 28 URLs, 0 broken, 0 hits |
| Playwright `p5-websites` (390, 768, 1440; includes axe serious/critical and internal links) | 6/6 on local production builds |
| Web unit | 294/294, including new `d14-public-claims.test.ts` |
| Packages unit | 9/9 |
| Claims lint | 0 findings on both sites |
| Builds | web, corporate, console exit 0 |
| Screenshots | `docs/build/evidence/ac13/` |

The crawl found three surfaces that a source search missed, and the new guard test then found a fourth.
Local only: nothing is deployed, so the live sites still show the old copy.

## Deliberately NOT changed: decisions needed
These describe a sale or contract that still exists. Editing the words alone would make them false or change terms.

| Surface | Why it stays | Who decides |
|---|---|---|
| `/checkout`, `/intelligence/success`, Dodo checkout and webhook | The Starter Pack still sells "Satelink Trading Intelligence", and it is what a payment provider may have reviewed | Founder: keep selling, rename, or stop |
| `/terms`, `/billing-policy`, `/acceptable-use` | Legal terms name the product | Founder and counsel |
| `/docs/api-reference`, `docs/pricing` | `/v1/intelligence` still serves existing keys; now described as tools inside Trading AI, prices kept while the sale runs | Follows the checkout decision |
| `console.satelink.network` Trading Intelligence page | Authenticated tool for existing keys | Follows the checkout decision |
| `/corporate` "Market data services" | Sold as a service; the framing sits close to D14's rejected "data API company" | Founder |
| "On-Chain Settlement" footer and "on-chain settlement" home heading | x402 and deposits are on-chain, but `SETTLEMENT_DRY_RUN=1` blocks epoch settlement broadcasting | Founder (action 14) |
| Organization `email` in JSON-LD | Differs from D14's infra@satelink.network | Founder |

Also not audited: repository `docs/` outside the docs portal (internal records) and the GitHub repo description (founder setting, D14).
**AC13 therefore stays open until this PR is merged and deployed and the table above is decided.**
