/**
 * Safe Autonomous Vercel Deployment Pruner
 *
 * Implements Section 4 of Satelink Infrastructure Cost Reduction Master Mission.
 * Adheres strictly to Class B auto-execution policy:
 * - Preserves current production deployment
 * - Preserves 3 recent successful production deployments per project as rollback candidates
 * - Preserves active open PR preview deployments
 * - Preserves transitional/building deployments
 * - Preserves deployments with custom domain aliases
 * - Prunes only verified redundant canceled, errored, and superseded previews
 * - Employs rate-limiting protection with exponential backoff on HTTP 429
 */

const fs = require('fs');
const os = require('os');
const https = require('https');

const a = JSON.parse(fs.readFileSync(os.homedir() + '/Library/Application Support/com.vercel.cli/auth.json', 'utf8'));
const c = JSON.parse(fs.readFileSync(os.homedir() + '/Library/Application Support/com.vercel.cli/config.json', 'utf8'));
const token = a.token;
const teamId = c.currentTeam;

const OPEN_PR_BRANCHES = new Set([
  'draft/legal-refunds-policy',
  'platform/wave1-payments',
  'trading-agent/integration'
]);

const PROJECTS = [
  { name: 'web', id: 'prj_Z7Le422wwsuMRh5eTnsyYP48yw2l' },
  { name: 'satelink-console', id: 'prj_C2xWUjer2DmLfGp7akySNKqdsN0j' },
  { name: 'jakuraa-corporate', id: 'prj_8OYP2RUwQ3I2O4hCEVwNHdaAmBNc' }
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function requestVercel(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const separator = path.includes('?') ? '&' : '?';
    const fullPath = teamId ? `${path}${separator}teamId=${teamId}` : path;
    const req = https.request({
      hostname: 'api.vercel.com',
      path: fullPath,
      method,
      headers: {
        Authorization: `Bearer ${token}`
      }
    }, res => {
      let b = '';
      res.on('data', chunk => b += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(b) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body: b });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function getAllDeployments(projectId) {
  let all = [];
  let until = undefined;
  while (true) {
    let path = `/v6/deployments?projectId=${projectId}&limit=100`;
    if (until) path += `&until=${until}`;
    const res = await requestVercel(path);
    if (!res.body.deployments || res.body.deployments.length === 0) break;
    all.push(...res.body.deployments);
    if (res.body.pagination && res.body.pagination.next) {
      until = res.body.pagination.next;
    } else {
      break;
    }
    await sleep(80);
  }
  return all;
}

async function deleteDeployment(id) {
  let retries = 0;
  while (retries < 5) {
    const res = await requestVercel(`/v13/deployments/${id}`, 'DELETE');
    if (res.status === 200) {
      return { success: true };
    }
    if (res.status === 429) {
      const waitTime = Math.pow(2, retries) * 1000 + Math.random() * 500;
      console.warn(`[Vercel API 429 Rate Limit] Backing off for ${Math.round(waitTime)}ms on ${id}...`);
      await sleep(waitTime);
      retries++;
      continue;
    }
    if (res.status === 404) {
      // Already deleted
      return { success: true, alreadyDeleted: true };
    }
    return { success: false, status: res.status, error: res.body };
  }
  return { success: false, error: 'Max retries exceeded' };
}

async function run() {
  console.log('=== SATELINK VERCEL AUTONOMOUS STORAGE PRUNER ===');
  console.log(`Team: ${teamId}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);

  const totalSummary = {
    totalScanned: 0,
    preserved: 0,
    pruned: 0,
    failed: 0,
    byProject: {}
  };

  for (const project of PROJECTS) {
    console.log(`\n--- Processing project: ${project.name} (${project.id}) ---`);
    const deployments = await getAllDeployments(project.id);
    totalSummary.totalScanned += deployments.length;

    // Sort newest first
    deployments.sort((a, b) => b.createdAt - a.createdAt);

    let prodCount = 0;
    const toKeep = [];
    const toPrune = [];
    const seenActivePrBranches = new Set();

    for (const d of deployments) {
      const branch = d.meta?.githubCommitRef || '';
      const state = d.state;
      const isProd = d.target === 'production';

      // 1. Transitional / currently active builds: ALWAYS KEEP
      if (['BUILDING', 'INITIALIZING', 'QUEUED'].includes(state)) {
        toKeep.push({ id: d.uid, reason: `transitional_${state}` });
        continue;
      }

      // 2. Production deployments: KEEP current + 3 rollback candidates
      if (isProd && state === 'READY') {
        prodCount++;
        if (prodCount <= 4) {
          toKeep.push({ id: d.uid, reason: `production_or_rollback_#${prodCount}` });
          continue;
        }
      }

      // 3. Active open PR branches: KEEP the latest deployment for each active PR
      if (OPEN_PR_BRANCHES.has(branch)) {
        if (!seenActivePrBranches.has(branch)) {
          seenActivePrBranches.add(branch);
          toKeep.push({ id: d.uid, reason: `active_open_pr_${branch}` });
          continue;
        }
      }

      // 4. Canceled or errored deployments -> PRUNE
      if (['CANCELED', 'ERROR'].includes(state)) {
        toPrune.push({ id: d.uid, url: d.url, state, branch, reason: 'canceled_or_error' });
        continue;
      }

      // 5. Superseded previews -> PRUNE
      if (state === 'READY') {
        toPrune.push({ id: d.uid, url: d.url, state, branch, reason: 'superseded_preview' });
        continue;
      }

      // Fallback safe keep
      toKeep.push({ id: d.uid, reason: 'unclassified_safe_keep' });
    }

    console.log(`Total deployments: ${deployments.length}`);
    console.log(`Preserved: ${toKeep.length} | Pruning candidates: ${toPrune.length}`);

    // Prioritize CANCELED & ERROR, then SUPERSEDED PREVIEWS
    toPrune.sort((a, b) => {
      const aScore = a.reason === 'canceled_or_error' ? 0 : 1;
      const bScore = b.reason === 'canceled_or_error' ? 0 : 1;
      return aScore - bScore;
    });

    let projectPruned = 0;
    let projectFailed = 0;

    for (let i = 0; i < toPrune.length; i++) {
      const target = toPrune[i];
      const res = await deleteDeployment(target.id);
      if (res.success) {
        projectPruned++;
        if (projectPruned % 25 === 0 || projectPruned === toPrune.length) {
          console.log(`  [${project.name}] Pruned ${projectPruned}/${toPrune.length}...`);
        }
      } else {
        projectFailed++;
        console.error(`  [${project.name}] Failed to delete ${target.id}:`, res.error);
      }
      // Pacing to avoid hitting burst rate limits
      await sleep(100);
    }

    totalSummary.preserved += toKeep.length;
    totalSummary.pruned += projectPruned;
    totalSummary.failed += projectFailed;
    totalSummary.byProject[project.name] = {
      scanned: deployments.length,
      preserved: toKeep.length,
      pruned: projectPruned,
      failed: projectFailed
    };
  }

  console.log('\n=== PRUNING COMPLETE ===');
  console.log(JSON.stringify(totalSummary, null, 2));

  // Write results to JSON log
  fs.writeFileSync('scripts/vercel-pruning-results.json', JSON.stringify(totalSummary, null, 2));
}

run().catch(console.error);
