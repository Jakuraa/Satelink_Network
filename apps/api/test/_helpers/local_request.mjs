// Test servers bound explicitly to 127.0.0.1 (2026-10-21, Step 4.5 root cause).
//
// supertest(app) listens on the wildcard address ([::]:<ephemeral>) but connects to
// 127.0.0.1:<port>. On macOS (BSD semantics; Node sets SO_REUSEADDR) a socket bound
// specifically to 127.0.0.1:<same port> — any local process, or a test server binding
// 127.0.0.1 — coexists with the wildcard bind AND receives those connections (reproduced:
// a 127.0.0.1 server answered 403 for a request meant for the wildcard one). Rate-limit tests
// open hundreds of ephemeral listens, so occasionally one hit a foreign server: "expected 403
// to equal 200" / "socket hang up". A server bound to 127.0.0.1 itself is never given a port
// already taken on that address and always receives its own connections.
import http from 'node:http';

const open = new Set();

/** Listen on 127.0.0.1:<ephemeral>; pass the returned server to supertest(). */
export async function bindLocal(app) {
  const s = http.createServer(app);
  await new Promise((resolve, reject) => { s.once('error', reject); s.listen(0, '127.0.0.1', resolve); });
  open.add(s);
  return s;
}

/** Close every server opened by bindLocal (call in afterEach). */
export async function closeLocalServers() {
  const all = [...open];
  open.clear();
  await Promise.all(all.map((s) => new Promise((r) => s.close(() => r()))));
}

const cache = new WeakMap();
/** supertest for an app bound once to 127.0.0.1 (cached per app until closeLocalServers). */
export async function localRequest(app) {
  const { default: supertest } = await import('supertest');
  let s = cache.get(app);
  if (!s || !s.listening) { s = await bindLocal(app); cache.set(app, s); }
  return supertest(s);
}
