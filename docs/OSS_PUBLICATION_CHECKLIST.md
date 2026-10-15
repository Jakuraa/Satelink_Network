# Zone 1 Open Source Publication Checklist

Complete all items before publishing to jakuraa/contracts

## Pre-publication (contracts)

- [ ] All contracts audited by third party (Code4rena, Sherlock, or equivalent)
- [ ] All contracts verified on Polygonscan
- [ ] All contract addresses populated in contracts/README.md
- [ ] No hardcoded wallet addresses in Solidity files
- [ ] MIT License file present (contracts/LICENSE)
- [ ] Foundry tests pass: `forge test -vv`
- [ ] Gas report generated and reviewed: `forge test --gas-report`
- [ ] SECURITY.md present with contact email
- [ ] MockUSDT.sol excluded or moved to test/mocks/
- [ ] All OpenZeppelin imports use stable release versions
- [ ] NatSpec documentation complete on public functions

## Pre-publication (node-agent)

- [ ] Edge agent builds on clean machine
- [ ] No hardcoded RPC URLs in agent code
- [ ] .env.example covers all agent config
- [ ] Apache 2.0 License file present
- [ ] Node setup documentation complete
- [ ] Tested on: OpenWrt / VPS Ubuntu 22.04 / Raspberry Pi
- [ ] Heartbeat and registration flow documented
- [ ] Agent version pinned and tagged

## Publication steps

1. Create org: github.com/jakuraa
2. Create repo: jakuraa/contracts (public, MIT)
3. Copy: `contracts/` `test/` `script/` `foundry.toml` `remappings.txt`
4. Enable GitHub secret scanning
5. Enable Dependabot security alerts
6. Add branch protection: require PR reviews for main
7. Add CODEOWNERS: `* @jakuraa/core-team`
8. Verify contracts on Polygonscan
9. Create GitHub Release with changelog
10. Announce in Polygon Discord + Twitter

## Post-publication

- [ ] Polygonscan verification confirmed
- [ ] GitHub Actions CI workflow passing
- [ ] Security contact email monitored
- [ ] First external PR handled within 48 hours
- [ ] Documentation site links updated

## Contract addresses (fill after deployment)

| Contract | Polygon Mainnet | Polygon Amoy (testnet) |
|----------|-----------------|------------------------|
| NodeRegistryV2 | | |
| RevenueVault | | |
| SplitEngine | | |
| RevenueDistributor | | |
| ClaimsContract | | |
| ClaimsWithdrawals | | |
| EpochAnchor | | |
| EligibilityPolicy | | |
| GovernanceTimelock | | |
