# Friends Beta — scope lock (2026-11-10)

Source: founder mandate "SATELINK — FRIENDS BETA LAUNCH v2026-11-10". This file lists exactly the phases of that
mandate. Anything else goes to `BACKLOG.md` and is not built in this session.

**Mission.** An invite-only Friends Beta of Satelink AI Assistance on production (satelink.network,
console.satelink.network, api.satelink.network) that 5–20 invited friends can use without help.

**Beta truth (product copy and invite must hold to it).**
- AI answers and model routing are real; capped spend is paid by Satelink.
- Food, shopping, developer services, agent and machine commerce, trading, payments and receipts are simulated and labelled.
- No customer is charged. Promotional credits never count as revenue.

## Phases

| ID | Phase | Authorization | Done when |
|---|---|---|---|
| B0 | Ground truth sync (read-only) | none needed | PRs, SHAs, deploys, env names, migration state, scanning status recorded; contradictions logged |
| B1 | Security train: merge #631 → #632 → #633 → #634 | F1 | Merged with green CI; three Vercel projects and Railway on the merged SHA; versions verified |
| B2 | Credential minimum bar: JWT rotation, admin-token removal, DB role switch, scanning check, checklist update | F2, F3, F4 | Each verified in production with rollback noted |
| B3 | Production backup + migrations | F5 | Backup restored and checked locally; migrations applied and verified; deployed API still healthy |
| B4 | Release merge via `release/beta-1` (stack #610…#630, #638, #636) | F6, F7 | Merged with full CI/E2E green; production on the merged SHA; flags still off |
| B5 | Beta controls behind flags: invite gate, OTP + Turnstile, spend caps, kill switches, promo credits, feedback, observability, beta pages | F6 scope | Built, tested, flags off |
| B6 | Customer-facing UI/UX polish (`beta/ui-polish`) | F6 scope | Ten must-fix outcomes met; Lighthouse and axe targets met; merged and verified |
| B7 | Hard test against production and preview | F9 | No red item, or the red item is in the go/no-go with its impact |
| B8 | Go/no-go + launch kit; enable flags only on GO | F10 | `BETA_GO_NO_GO.md`, `docs/beta/` kit, final report |

## Not authorized (F8, F11 unticked)
- F8: Trading Intelligence Starter Pack purchase on `/checkout` stays unchanged.
- F11: `~/.zshrc` plaintext exports are a manual founder action.

## Stays forbidden
PR #635; any real settlement; changing `SETTLEMENT_DRY_RUN=1`; on-chain signer or treasury actions; `git gc` or
stash drop; real orders, real trading, customer charges, legal terms edits; force-push; printing secret values;
deleting production backup files.

## Out of scope
No new domains, connectors, payment rails, architecture rewrites, or refactors outside a phase.

## Stop conditions
A production deploy fails and rollback fails · migration verification fails · smoke tests break after variable
removal · any path charges money, settles on-chain or places a real order · a secret value appears in output or a
commit · a test can only pass by weakening an assertion.
