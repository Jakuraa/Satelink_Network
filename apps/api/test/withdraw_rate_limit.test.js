import { expect } from 'chai';
import express from 'express';
import request from 'supertest';
import { localRequest, closeLocalServers } from './_helpers/local_request.mjs';

import { withdrawLimiter, billingLimiter } from '../src/security/middleware/rate_limits.js';

// Pins the P0-08 rate-limit contract. If `max` drops or the limiter is
// accidentally removed from the withdraw chain, these tests fail loudly.

function buildWithdrawApp() {
    const app = express();
    // Simulate requireJWT having populated req.user
    app.use((req, _res, next) => {
        req.user = { userId: 'u1', wallet: '0xaaaa', role: 'node_operator' };
        next();
    });
    app.post('/api/withdraw', withdrawLimiter, (_req, res) => res.json({ ok: true }));
    return app;
}

function buildBillingApp() {
    const app = express();
    app.post('/bill', billingLimiter, (_req, res) => res.json({ ok: true }));
    return app;
}

describe('rate_limits — P0-08 wiring', () => {
  afterEach(closeLocalServers); // see test/_helpers/local_request.mjs (macOS 127.0.0.1 port hijack)
    describe('withdrawLimiter', () => {
        it('allows requests up to the per-minute cap then returns 429', async () => {
            const app = buildWithdrawApp();

            // Cap is 10 per minute. Fire 10 successful, then the 11th must 429.
            for (let i = 0; i < 10; i++) {
                const ok = await (await localRequest(app)).post('/api/withdraw').send({});
                expect(ok.status, `request ${i + 1} should be 200`).to.equal(200);
            }

            const blocked = await (await localRequest(app)).post('/api/withdraw').send({});
            expect(blocked.status).to.equal(429);
            expect(blocked.body).to.deep.equal({ ok: false, error: 'Withdrawal rate limit exceeded' });
        });
    });

    describe('billingLimiter', () => {
        it('buckets per X-Enterprise-Key header', async () => {
            const app = buildBillingApp();

            // Cap is 120/min; we just verify keying works by firing a burst as
            // key A and confirming key B still gets through.
            for (let i = 0; i < 120; i++) {
                const r = await (await localRequest(app)).post('/bill').set('X-Enterprise-Key', 'keyA').send({});
                expect(r.status, `keyA request ${i + 1} should be 200`).to.equal(200);
            }
            const blockedA = await (await localRequest(app)).post('/bill').set('X-Enterprise-Key', 'keyA').send({});
            expect(blockedA.status).to.equal(429);

            const okB = await (await localRequest(app)).post('/bill').set('X-Enterprise-Key', 'keyB').send({});
            expect(okB.status).to.equal(200);
        });
    });
});
