#!/usr/bin/env node
// Release A · P5 — writes the website's capability list FROM THE REGISTRY (never hand-typed, R9):
//   apps/web/src/content/preview-capabilities.generated.json
// Consumed by satelink.network's /preview page, /.well-known/satelink-capabilities.json and llms.txt.
// apps/api/test/public_capabilities_sync.test.js fails if this file goes stale. Usage: node scripts/preview/generate-public-capabilities.mjs
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildPublicCapabilities } from '../../apps/api/src/workflows/public_capabilities.js';

const OUT = join(resolve(import.meta.dirname, '..', '..'), 'apps', 'web', 'src', 'content', 'preview-capabilities.generated.json');
writeFileSync(OUT, `${JSON.stringify(await buildPublicCapabilities(), null, 2)}\n`);
console.log(`wrote ${OUT}`);
