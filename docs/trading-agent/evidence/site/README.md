# Phase 7 site evidence (2026-10-11)

Captured with Playwright at 1440×900 (`-desktop`) and 390×844 (`-m390`), light theme.

| Prefix | Source | Notes |
|---|---|---|
| `web-*` | Vercel **preview** of `site/phase7-corporate` (PR #512, contains #510 + #511): `web-git-site-phase7-corporate-satelinkinternet-collabs-projects.vercel.app` | public preview |
| `corp-*` | local **production build** (`next build && next start`) of `apps/corporate` at the same commit | the jakuraa-corporate preview is behind Vercel deployment protection (302 to login) |

Shots: home, product (`/trading-agent/product`), safety (`/#safety`), interfaces (`/#interfaces`), beta CTA (`/contact-sales?interest=beta`), footer, `/network` paused notice; jakuraa.com home, `/products`, Satelink Trading AI section, footer.

**These are NOT production.** Nothing here is deployed: all three PRs are HELD for founder approval (merging to `main` deploys). Preview checks run by curl on the same preview:
- `X-Robots-Tag: noindex, nofollow` on `/builder`;
- the status line ×14 on the homepage;
- no "DePIN";
- `/network` shows the paused notice;
- the sitemap has 0 `/network` or `/builder` entries.

On mobile, element shots taken while scrolled show the sticky header over the top edge of the section. That is a capture artifact, not a layout bug.
