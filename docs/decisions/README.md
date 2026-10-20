# Decisions

Locked product and architecture decisions for the Satelink AI Assistance build mandate
(`docs/build/MASTER_BUILD_PROMPT.md`). Earlier ADRs live in `docs/adr/`.

| ID | Title | Status |
|---|---|---|
| D1–D13 | Standing decisions (Financial OS sole ledger; AI proposes / code decides, no withdrawals; no free tier; PRs + health checks; no prod DB access; settlement dry-run; runner-only additive migrations; Claude Code only on money paths; external-revenue definition; prepaid crypto subscriptions; truth endpoint admin-only; node program paused; planned plans pending confirmation) | BINDING (see [`../build/AUDIT_2026-10-20.md`](../build/AUDIT_2026-10-20.md) §A1) |
| AD-1–AD-9 | Architecture decisions locked by the audit (§B6) | BINDING |
| D14 | [Product identity](D14_PRODUCT_IDENTITY.md) | LOCKED 2026-10-20 |
| D15 | [apps/api deploy lockfile](D15_API_LOCKFILE.md) | DECIDED 2026-10-20 |

Evidence that contradicts a locked decision goes in [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).
