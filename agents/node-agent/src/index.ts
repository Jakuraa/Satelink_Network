#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import axios from 'axios';
// Signed-message formats verified by the API (see protocol.js).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { walletFromEnv, signedRegistration, signedHeartbeat, createHeartbeatClock } = require('./protocol');

const CONFIG_DIR = join(homedir(), '.satelink');
const CONFIG_FILE = join(CONFIG_DIR, 'node.json');
const API_BASE = (process.env.SATELINK_API || 'https://rpc.satelink.network').replace(/\/+$/, '');
const KEY_ENV = 'SATELINK_NODE_PRIVATE_KEY';

interface NodeConfig {
  nodeId: string;        // assigned by the API at registration
  wallet: string;        // payout wallet (signs registration and heartbeats)
  nodeType: string;
  endpointUrl: string;
  region: string;
  chainIds: number[];
  registeredAt: string;
}

const program = new Command();

program
  .name('satelink-node')
  .description(`Satelink node operator CLI. Signing key: set ${KEY_ENV} (the payout wallet's private key).`)
  .version('1.1.0');

function loadConfig(): NodeConfig | null {
  if (!existsSync(CONFIG_FILE)) return null;
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function saveConfig(config: NodeConfig): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}

async function apiCall(endpoint: string, method = 'GET', body: any = null): Promise<{ status: number; data: any }> {
  try {
    const res = await axios({
      method,
      url: `${API_BASE}${endpoint}`,
      data: body,
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
      maxRedirects: 0,
    });
    return { status: res.status, data: res.data };
  } catch (err: any) {
    if (err.response) return { status: err.response.status, data: err.response.data };
    throw err;
  }
}

function loadWallet() {
  try {
    return walletFromEnv(process.env, KEY_ENV);
  } catch (err: any) {
    console.error(err.message);
    process.exit(1);
  }
}

program
  .command('register')
  .description('Register this node (signed by the payout wallet)')
  .requiredOption('-e, --endpoint <url>', 'Public http(s) URL of your RPC endpoint (must answer GET /health with 200)')
  .option('-r, --region <region>', 'Node region (ap-south-1, us-east-1, eu-west-1, ap-southeast-1)', 'us-east-1')
  .option('-t, --type <type>', 'Node type (rpc, bandwidth, compute)', 'rpc')
  .option('-c, --chains <ids>', 'Comma-separated chain ids', '137')
  .action(async (opts) => {
    const wallet = loadWallet();
    const chainIds = String(opts.chains).split(',').map((s: string) => Number(s.trim()));
    console.log(`Registering node for wallet ${wallet.address} ...`);
    try {
      const body = await signedRegistration(wallet, { nodeType: opts.type, endpointUrl: opts.endpoint, region: opts.region, chainIds });
      const { status, data } = await apiCall('/api/nodes/register', 'POST', body);
      if (status !== 201 || !data?.nodeId) {
        console.error(`Registration failed (HTTP ${status}):`, data?.error || data);
        process.exit(1);
      }
      const config: NodeConfig = {
        nodeId: data.nodeId, wallet: wallet.address, nodeType: opts.type, endpointUrl: opts.endpoint,
        region: opts.region, chainIds, registeredAt: new Date().toISOString(),
      };
      saveConfig(config);
      console.log('Node registered successfully!');
      console.log(`  Node ID: ${config.nodeId}`);
      console.log(`  Status:  ${data.status} (becomes active after the first signed heartbeat)`);
      console.log(`\nConfig saved to: ${CONFIG_FILE}`);
      console.log('Run "satelink-node start" to begin sending heartbeats.');
    } catch (err: any) {
      console.error('Registration failed:', err.message);
      process.exit(1);
    }
  });

program
  .command('start')
  .description('Start the node agent (signed heartbeat every 2 minutes)')
  .action(async () => {
    const config = loadConfig();
    if (!config) {
      console.error('Node not registered. Run "satelink-node register --endpoint https://..." first.');
      process.exit(1);
    }
    const wallet = loadWallet();
    if (wallet.address.toLowerCase() !== config.wallet.toLowerCase()) {
      console.error(`${KEY_ENV} belongs to ${wallet.address}, but this node is registered to ${config.wallet}.`);
      process.exit(1);
    }

    console.log('Starting Satelink node agent...');
    console.log(`  Node ID: ${config.nodeId}`);
    console.log(`  Region:  ${config.region}`);
    console.log(`  API:     ${API_BASE}`);
    console.log('');

    const nextTimestamp = createHeartbeatClock();

    async function sendHeartbeat() {
      const at = new Date().toISOString();
      try {
        const body = await signedHeartbeat(wallet, {
          nodeId: config!.nodeId,
          timestamp: nextTimestamp(),
          metrics: { uptime_seconds: Math.round(process.uptime()) },
        });
        const { status, data } = await apiCall(`/api/nodes/${encodeURIComponent(config!.nodeId)}/heartbeat`, 'POST', body);
        if (status === 200 && data?.ok) {
          console.log(`[${at}] Heartbeat sent (status ${data.status})`);
        } else {
          console.log(`[${at}] Heartbeat refused (HTTP ${status}): ${data?.error || 'unknown'}`);
        }
      } catch (err: any) {
        console.error(`[${at}] Heartbeat failed: ${err.message}`);
      }
    }

    await sendHeartbeat();
    const INTERVAL_MS = 2 * 60 * 1000;
    setInterval(sendHeartbeat, INTERVAL_MS);
    console.log('Node agent running. Press Ctrl+C to stop.\n');
  });

program
  .command('status')
  .description('Show current node status')
  .action(async () => {
    const config = loadConfig();
    if (!config) {
      console.log('Status: NOT REGISTERED');
      console.log('Run "satelink-node register --endpoint https://..." to register.');
      return;
    }

    console.log('Satelink Node Status');
    console.log('--------------------');
    console.log(`Node ID:    ${config.nodeId}`);
    console.log(`Wallet:     ${config.wallet}`);
    console.log(`Region:     ${config.region}`);
    console.log(`Endpoint:   ${config.endpointUrl}`);
    console.log(`Chains:     ${config.chainIds.join(', ')}`);
    console.log(`Registered: ${config.registeredAt}`);
    console.log(`API:        ${API_BASE}`);

    try {
      const { status, data } = await apiCall(`/api/nodes/${encodeURIComponent(config.nodeId)}`);
      if (status === 200 && data?.ok) {
        console.log(`\nNetwork Status: ${data.node?.status}`);
        console.log(`Last Heartbeat: ${data.node?.lastHeartbeatAt ? new Date(data.node.lastHeartbeatAt * 1000).toISOString() : 'never'}`);
        console.log(`Reputation:     ${data.node?.reputationScore ?? 'pending'}`);
      } else {
        console.log(`\nNetwork Status: unavailable (HTTP ${status})`);
      }
    } catch {
      console.log('\nNetwork Status: Unable to reach API');
    }
  });

program.parse();
