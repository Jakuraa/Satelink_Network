# Contributing to Satelink

## Branch Strategy

- `main` — production (protected, auto-deploys to Railway/Vercel) — the single source of truth; no `develop` branch exists
- `feature/*` — new features
- `hotfix/*` — emergency fixes

## Commit Format

```
feat(task-id): description
fix(task-id): what was broken
chore(task-id): maintenance
docs(task-id): documentation only
test(task-id): test additions
```

## Pull Request Process

1. Branch from `main`
2. Run tests: `npm test`
3. Run lint: `npm run lint`
4. Create PR to `main`
5. Merge after CI passes

## Security

**Never commit:**
- Private keys or mnemonics
- JWT secrets
- API keys (Alchemy, Ankr, Groq, etc.)
- `.env` files
- `token.txt` or credential files

## Testing

```bash
# Backend
cd apps/api && npm test

# Contracts
forge test -vvv

# Frontend build check
cd apps/web && npm run build
```

## Code Style

- Use async/await (never raw promises without await)
- All DB queries must use `await`
- No SQLite anywhere — PostgreSQL only
- No hardcoded secrets — use `process.env`

## Documentation

Update relevant docs when changing:
- API endpoints → `docs/README.md`
- Architecture → `docs/architecture/`
- Progress → `agent/memory/PROGRESS.md`
