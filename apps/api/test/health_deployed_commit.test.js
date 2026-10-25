// /health reports the deployed commit so post-deploy probes can prove which build is live
// (2026-10-21: merges sat undeployed during a Railway build pause; uptime was the only hint).
import { expect } from 'chai';
import express from 'express';
import request from 'supertest';
import { createHealthHandler, deployedCommit } from '../src/core/health_route.js';

const SHA = '6e34d3ba0f1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e';

describe('/health — deployed commit', () => {
  const app = (env, pool = { async query() { return { rows: [{ '?column?': 1 }] }; } }) => {
    const a = express(); a.get('/health', createHealthHandler(pool, env)); return a;
  };

  it('reports RAILWAY_GIT_COMMIT_SHA', async () => {
    const res = await request(app({ RAILWAY_GIT_COMMIT_SHA: SHA })).get('/health');
    expect(res.status).to.equal(200);
    expect(res.body).to.include({ ok: true, server: 'ok', db: 'ok', commit: SHA });
    expect(res.body.uptime).to.be.a('number');
    expect(res.headers['cache-control']).to.equal('no-cache');
  });

  it('prefers the Railway SHA over GIT_SHA, and falls back to GIT_SHA', () => {
    expect(deployedCommit({ RAILWAY_GIT_COMMIT_SHA: SHA, GIT_SHA: 'abcdef1' })).to.equal(SHA);
    expect(deployedCommit({ GIT_SHA: 'ABCDEF1' })).to.equal('abcdef1');
  });

  it('reports "unknown" when unset or not a hex SHA (never echoes arbitrary env text)', () => {
    expect(deployedCommit({})).to.equal('unknown');
    for (const bad of ['main', '<script>', 'abc', 'g'.repeat(40), 'a'.repeat(41), ' ']) {
      expect(deployedCommit({ RAILWAY_GIT_COMMIT_SHA: bad }), bad).to.equal('unknown');
    }
  });

  it('still answers 200 with the commit when the DB is down', async () => {
    const down = { async query() { throw new Error('connect ECONNREFUSED'); } };
    const res = await request(app({ RAILWAY_GIT_COMMIT_SHA: SHA }, down)).get('/health');
    expect(res.status).to.equal(200);
    expect(res.body.commit).to.equal(SHA);
    expect(res.body.db).to.match(/^degraded: connect ECONNREFUSED/);
  });
});
