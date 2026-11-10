// apps/api/test/better_auth_preview_mode.test.js — Release A: the local-preview auth switches are OFF by
// default and refuse to run in production (production cookie/mail behaviour must be unchanged).
import { expect } from 'chai';
import { devMailSink, previewCookies, previewRateLimitOff } from '../src/auth/better_auth.mjs';

const KEYS = ['AUTH_DEV_MAIL_SINK', 'AUTH_COOKIE_DOMAIN', 'AUTH_SECURE_COOKIES', 'AUTH_PREVIEW_RATE_LIMIT', 'NODE_ENV'];
describe('Better Auth preview mode (Release A)', () => {
  let saved;
  beforeEach(() => { saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]])); for (const k of KEYS) delete process.env[k]; });
  afterEach(() => { for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });

  it('defaults: no mail sink, production cookie mode (cross-subdomain, secure)', () => {
    expect(devMailSink()).to.equal(null);
    expect(previewCookies()).to.equal(false);
    expect(previewRateLimitOff()).to.equal(false);
  });

  it('preview cookies need BOTH switches', () => {
    process.env.AUTH_COOKIE_DOMAIN = 'none';
    expect(previewCookies()).to.equal(false);
    process.env.AUTH_SECURE_COOKIES = 'false';
    expect(previewCookies()).to.equal(true);
  });

  it('both switches are refused in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.AUTH_DEV_MAIL_SINK = '/tmp/mail.jsonl';
    expect(() => devMailSink()).to.throw(/not allowed in production/);
    process.env.AUTH_COOKIE_DOMAIN = 'none'; process.env.AUTH_SECURE_COOKIES = 'false';
    expect(() => previewCookies()).to.throw(/not allowed in production/);
    process.env.AUTH_PREVIEW_RATE_LIMIT = 'off';
    expect(() => previewRateLimitOff()).to.throw(/not allowed in production/);
  });
});
