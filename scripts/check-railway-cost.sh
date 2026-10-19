#!/usr/bin/env bash
# Run weekly to monitor Railway costs
# Usage: bash scripts/check-railway-cost.sh

echo "=== SATELINK RAILWAY COST CHECK ==="
echo "Date: $(date)"
echo ""
echo "Service health checks:"
echo ""

API_HEALTH=$(curl -sf https://rpc.satelink.network/rpc/health 2>/dev/null && echo "UP" || echo "DOWN")

echo "  Satelink-api:    $API_HEALTH"
echo "  Paperclip AI OS: DECOMMISSIONED"
echo ""

echo "Memory usage:"
# Check if Railway CLI is available for metrics
if command -v railway &>/dev/null; then
  railway metrics 2>/dev/null || echo "  (install railway CLI for live metrics)"
else
  echo "  (install: npm i -g @railway/cli)"
fi

echo ""
echo "Conversion targets (warm leads):"
# Check conversion_targets table
node -e "
import pg from 'pg';
const pool = new (pg.Pool)({ connectionString: process.env.DATABASE_URL, ssl:{rejectUnauthorized:false} });
pool.query('SELECT COUNT(*) as total, SUM(CASE WHEN intent_score>=100 THEN 1 ELSE 0 END) as hot FROM conversion_targets WHERE converted=false')
  .then(r => {
    console.log('  Total leads:', r.rows[0].total, ' | Hot (3+ days):', r.rows[0].hot);
    pool.end();
  }).catch(e => { console.log('  DB unavailable'); pool.end(); });
" 2>/dev/null

echo ""
echo "=== Budget estimate ==="
echo "  Railway Hobby:    \$5.00 included free"
echo "  Target bill:      \$15-20/month total"
echo "  Review usage at:  railway.com/workspace/usage"
echo ""
echo "Active services: Satelink-api, Postgres-iQeW, satelink-reconciler, Redis."
