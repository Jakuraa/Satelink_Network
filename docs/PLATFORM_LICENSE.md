# Satelink Platform — License & Usage

## License

This repository is licensed under the [Business Source License 1.1](../LICENSE.BSL).

**What this means:**
- You CAN read, study, and run this code for personal/evaluation use
- You CAN contribute back via Pull Requests
- You CANNOT use this code commercially without a license
- In 2030, this automatically converts to AGPL-3.0 (fully open source)

## What's Public (Zone 1 — MIT)
- Smart contracts: github.com/jakuraa/contracts
- Node edge agent: github.com/jakuraa/node-agent
- Developer SDK: github.com/jakuraa/sdk

## What's Source-Available (Zone 2 — BSL 1.1, this repo)
- Platform backend (public and builder API routes)
- Frontend dashboards (node operator and builder views)
- Authentication middleware
- Settlement adapter interface
- Reputation engine (interface, not weights)

## What's Private (Zone 3)
Certain operational components remain private to protect network integrity:
- Revenue protection sentinel logic
- Pricing and surge algorithms
- Security monitoring configuration
- Admin API routes and dashboards

This is standard practice for production DePIN networks. Cloudflare,
Vercel, and Supabase use identical models.

## Commercial Licensing

To use the Satelink Platform commercially, contact: legal@satelink.network

## Contributing

We welcome contributions under the Contributor License Agreement (CLA).
By submitting a PR, you agree that your contributions will be licensed
under the same BSL 1.1 terms.
