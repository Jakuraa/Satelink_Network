# Publishing `satelink-mcp` — founder steps

State on 2026-10-13: **never published.** `npm view satelink-mcp` → 404, as do `@satelink/mcp`
and `@satelink/mcp-server`. The README and `mcp.json` already tell users to run
`npx -y satelink-mcp`, so (a) that command fails today and (b) anyone can register the name
first. Publish soon.

Claude Code does not hold, request or use npm credentials. Every step below is the founder's.

## 0. Prerequisite

PR #531 merged (2.1.0, version test, `publish-mcp.yml`). 2.1.1 (2026-10-15 repo-move round)
fixed `repository`/`bugs` for OIDC provenance against `Jakuraa/Satelink_Network`.

**2.1.2 (2026-10-15, bin fix) — publish this, not 2.1.1.** npm warned
`"bin[satelink-mcp]" script name index.js was invalid and removed`. Root cause (npm
`@npmcli/package-json/lib/normalize.js`): the warning fires whenever npm *rewrites* a bin
target, and it rewrote `"./index.js"` → `"index.js"`. The message is misleading: the bin was
kept, not removed — identical on npm 10 and 11.6.2 (`npm pack` on both kept the bin block).
Fixed by writing the targets in normalized form (`"index.js"`, `"http.mjs"`); `http.mjs` also
got its missing exec bit. `test/bin.test.mjs` fails if a target would be rewritten. Any local
`satelink-mcp-2.1.1.tgz` is stale — delete it.

Verified on the packed 2.1.2 tarball: `npm publish --dry-run` → 0 warnings; clean-dir install
links both bins; `npx satelink-mcp` handshake → serverInfo `satelink-mcp 2.1.2`, tools
`[polygon_rpc]`.

## Option A (preferred): CI trusted publishing, no token anywhere

My understanding of npm's process (not re-checked against npm's docs this session; confirm at
npmjs.com before relying on it): a trusted publisher is attached in the **package** settings, so
the name must exist first. If npm offers to configure trust for a new package, skip step A1.

- A1. One-time first publish from the founder's machine (2FA on):
  `cd apps/mcp-server && npm login && npm publish --access public --otp=<code>`
- A2. npmjs.com → `satelink-mcp` → Settings → Trusted Publisher → GitHub Actions:
  owner `Jakuraa`, repo `Satelink_Network`, workflow `publish-mcp.yml`, environment
  `npm-publish`.
- A3. GitHub → repo Settings → Environments → create `npm-publish`, required reviewer = founder.
- A4. npmjs.com → package Settings → Publishing access → "Require two-factor authentication and
  disallow tokens".
- A5. Future releases: bump the version (and run `npm test`), merge, then
  `git tag satelink-mcp-v<version> && git push origin satelink-mcp-v<version>`, and approve the run.

## Option B: local publish only

From a fresh clone of `main` after the 2.1.2 PR merges (never from a stale tarball):

```bash
cd apps/mcp-server
npm whoami                                   # must be the founder's npm account
npm test                                     # version + bin tests
npm publish --dry-run                        # expect: no "bin[...]" warning, 11 files, 2.1.2
npm publish --access public --otp=<6-digit code from your authenticator>
```

## After publishing (Claude Code verifies, then updates the board)

```bash
npm view satelink-mcp version dist.tarball   # expect 2.1.2
D=$(mktemp -d) && cd $D && npm init -y >/dev/null && npm i satelink-mcp@2.1.2
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"t","version":"0"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  | (cat; sleep 3) | ./node_modules/.bin/satelink-mcp
# expect serverInfo {name: satelink-mcp, version: 2.1.2} and tools [polygon_rpc]
```

The board row changes to PUBLISHED only after both checks pass on the registry copy.
Pre-publish, the same checks passed on the packed tarball (2026-10-13, re-verified 2026-10-15 at 2.1.2).

The MCP-registry listing (`mcp.json`) is a separate submission. Do it after npm publishes.
