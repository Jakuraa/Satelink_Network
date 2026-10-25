#!/usr/bin/env node
// scripts/sync-trading-engine.mjs
//
// Synchronizes compiled trading engine files from services/trading/dist
// to apps/api/src/trading/engine so the isolated Railway deployment (which
// operates on rootDirectory=/apps/api without access to external monorepo
// workspaces) has a complete, working runtime resolution for paper trading simulation.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const SRC_DIR = path.join(REPO_ROOT, 'services', 'trading', 'dist');
const DEST_DIR = path.join(REPO_ROOT, 'apps', 'api', 'src', 'trading', 'engine');

if (!fs.existsSync(SRC_DIR)) {
  console.error(`[sync-trading-engine] Source directory does not exist: ${SRC_DIR}`);
  console.error(`[sync-trading-engine] Run 'npm run build' inside services/trading first.`);
  process.exit(1);
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') {
        continue;
      }
      copyRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      if (entry.name.endsWith('.d.ts') || entry.name.endsWith('.map')) {
        continue;
      }
      if (entry.name.endsWith('.js')) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

copyRecursive(SRC_DIR, DEST_DIR);
console.log(`[sync-trading-engine] Successfully synced compiled trading engine from ${path.relative(REPO_ROOT, SRC_DIR)} to ${path.relative(REPO_ROOT, DEST_DIR)}`);
