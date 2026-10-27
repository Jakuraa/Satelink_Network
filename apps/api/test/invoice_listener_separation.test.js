// Step 4.2 (2026-10-12): the checkout invoice address must be separate from
// every path that auto-credits RPC balances (api_credits).
//
// v1-v4  validateInvoiceConfig: unset / vault / V1 vault / treasury / x402 payTo /
//        env-configured vault are refused; a dedicated address is accepted
// v5     the onchain-native adapter is unavailable (not offered at checkout)
//        until the address is valid
// s1     LISTENER SEPARATION: a USDT transfer to the invoice address, claimed via
//        POST /api/keys/deposit, credits NOTHING (no api_deposits insert, no
//        api_credits update) — the route only credits transfers to the vault
// s2     the DepositListener binds to the vault contract only; with a valid
//        config the vault and the invoice address can never coincide
import { expect } from 'chai';
import express from 'express';
import request from 'supertest';
import { ethers } from 'ethers';
import { validateInvoiceConfig, listenerCreditedAddresses, createOnchainNativeAdapter } from '../src/payments/adapters/onchain_native.mjs';
import { isAdapterAvailable } from '../src/payments/contract.mjs';

const INVOICE = '0x1ab0000000000000000000000000000000000001'; // dedicated (test) address
const VAULT = '0x577D3716d6Ad5b676d230f5409deF9838FABaCEF';
const V1 = '0x80AFEaC3B77CbeC1f7B9f24a50319DC72785DdA3';
const TREASURY = '0x966E1Ae22996545015b1414B35234b10719d7Ad4';

describe('invoice address separation (Step 4.2)', () => {
  it('v1-v4: refuses unset and every listener-credited address; accepts a dedicated one', () => {
    expect(validateInvoiceConfig({}).reason).to.equal('invoice_address_unset');
    expect(validateInvoiceConfig({ PAYMENTS_ONCHAIN_INVOICE_ADDRESS: 'nope' }).reason).to.equal('invoice_address_unset');
    for (const a of [VAULT, V1, TREASURY, VAULT.toLowerCase()]) {
      expect(validateInvoiceConfig({ PAYMENTS_ONCHAIN_INVOICE_ADDRESS: a }).reason, a).to.equal('invoice_address_unsafe');
    }
    const custom = '0x2222222222222222222222222222222222222222';
    expect(validateInvoiceConfig({ PAYMENTS_ONCHAIN_INVOICE_ADDRESS: custom, VAULT_ADDRESS: custom }).reason).to.equal('invoice_address_unsafe');
    expect(validateInvoiceConfig({ PAYMENTS_ONCHAIN_INVOICE_ADDRESS: custom, X402_PAY_TO: custom }).reason).to.equal('invoice_address_unsafe');
    expect(validateInvoiceConfig({ PAYMENTS_ONCHAIN_INVOICE_ADDRESS: INVOICE })).to.deep.equal({ ok: true });
    expect(listenerCreditedAddresses({})).to.include.members([VAULT.toLowerCase(), V1.toLowerCase(), TREASURY.toLowerCase()]);
  });

  it('v5: onchain-native is not offered at checkout until the invoice address is valid', () => {
    expect(isAdapterAvailable(createOnchainNativeAdapter({ env: {} }))).to.equal(false);
    expect(createOnchainNativeAdapter({ env: {} }).capabilities().unavailableReason).to.equal('invoice_address_unset');
    expect(isAdapterAvailable(createOnchainNativeAdapter({ env: { PAYMENTS_ONCHAIN_INVOICE_ADDRESS: TREASURY } }))).to.equal(false);
    expect(isAdapterAvailable(createOnchainNativeAdapter({ env: { PAYMENTS_ONCHAIN_INVOICE_ADDRESS: INVOICE } }))).to.equal(true);
  });

  describe('s1: a payment to the invoice address never credits an RPC balance', () => {
    const restore = {};
    const KEY = 'sk_free_' + 'e'.repeat(48);
    const WALLET = '0xe00000000000000000000000000000000000e001';
    let writes; let router;
    before(async () => {
      for (const m of ['getTransactionReceipt', 'getBlockNumber']) restore[m] = ethers.JsonRpcProvider.prototype[m];
      const pad = (a) => ethers.zeroPadValue(a, 32);
      ethers.JsonRpcProvider.prototype.getBlockNumber = async () => 1000;
      ethers.JsonRpcProvider.prototype.getTransactionReceipt = async () => ({
        status: 1, blockNumber: 900,
        logs: [{
          address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
          topics: ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', pad(WALLET), pad(INVOICE)],
          data: ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [5_000_000n]),
        }],
      });
      writes = [];
      const q = async (sql) => {
        if (/INSERT INTO api_deposits|UPDATE api_credits/.test(sql)) writes.push(sql);
        if (/FROM api_credits WHERE api_key/.test(sql)) return { rows: [{ api_key: KEY, tier: 'free', wallet_address: WALLET }] };
        return { rows: [], rowCount: 0 };
      };
      const pool = { query: q, connect: async () => ({ query: q, release() {} }) };
      ({ createSimpleApiKeysRouter: router } = await import('../src/billing/api_keys_route.mjs'));
      router = router(pool);
    });
    after(() => { for (const [m, f] of Object.entries(restore)) ethers.JsonRpcProvider.prototype[m] = f; });

    it('claiming it via POST /api/keys/deposit is refused and writes nothing', async () => {
      const app = express(); app.use(express.json()); app.use('/api/keys', router);
      const r = await request(app).post('/api/keys/deposit').set('X-API-Key', KEY).send({ tx_hash: '0x' + '3'.repeat(64) });
      expect(r.status).to.equal(400);
      expect(r.body.error).to.equal('no_usdt_received');
      expect(writes).to.deep.equal([]);
    });
  });

  it('s2: the DepositListener binds to the vault only, which a valid invoice address can never equal', async () => {
    const src = (await import('node:fs')).readFileSync(new URL('../src/services/deposit_listener.js', import.meta.url), 'utf8');
    expect(src).to.match(/new ethers\.Contract\(this\.vaultAddress/);
    expect(src).to.not.match(/PAYMENTS_ONCHAIN_INVOICE_ADDRESS/);
    for (const vault of [undefined, VAULT, '0x3333333333333333333333333333333333333333']) {
      const env = { PAYMENTS_ONCHAIN_INVOICE_ADDRESS: vault ?? VAULT, ...(vault ? { VAULT_ADDRESS: vault } : {}) };
      expect(validateInvoiceConfig(env).ok, String(vault)).to.equal(false);
    }
  });
});
