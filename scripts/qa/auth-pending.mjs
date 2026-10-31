// Read-only check for deployments whose GitHub provider is intentionally pending.
import assert from 'node:assert/strict';
const base = process.env.BASE_URL || 'http://localhost:3000';
const canonical = process.env.AUTH_EXPECTED_ORIGIN || new URL(base).origin;
const login = await fetch(new URL('/login', base));
const html = await login.text();
assert.equal(login.status, 200);
assert.match(html, /Sign-in is being set up\. Please check back shortly\./);
assert.doesNotMatch(html, /<input[^>]+type="password"/);
console.log('PASS login accurately pending; no password input');
for (const next of ['//untrusted.invalid', 'https://untrusted.invalid', '/\\untrusted.invalid']) {
  const url = new URL('/auth/callback', base); url.searchParams.set('next', next);
  const response = await fetch(url, { redirect: 'manual' });
  assert.equal(response.status, 307);
  const destination = new URL(response.headers.get('location'));
  assert.equal(destination.origin, canonical);
  assert.equal(destination.pathname, '/login');
  assert.equal(destination.searchParams.get('error'), 'oauth');
  assert.equal(destination.searchParams.get('next'), '/');
  assert.match(response.headers.get('cache-control'), /no-store/);
  console.log(`PASS callback rejects unsafe next ${JSON.stringify(next)}`);
}
