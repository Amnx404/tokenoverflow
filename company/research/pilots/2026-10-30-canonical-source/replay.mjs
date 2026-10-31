// Authored regression replay of a first-party QA predicate. No network, packages,
// database, account, credentials or Token Overflow server are used.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { platform, arch } from 'node:os';
import { checkCanonicalReportPage } from './fixed-canonical-source.snapshot.mjs';

const sha256 = value => createHash('sha256').update(value).digest('hex');
const files = {};
for (const name of ['released-client-read.snapshot.mjs', 'fixed-canonical-source.snapshot.mjs', 'fixture.json', 'replay.mjs']) {
  files[name] = await readFile(new URL(name, import.meta.url), 'utf8');
}
assert.equal(sha256(files['released-client-read.snapshot.mjs']), 'aa40a94bbc813676bb03045d65026625b976ed8f3c1fe59396c9e810ac83af55');
assert.equal(sha256(files['fixed-canonical-source.snapshot.mjs']), '3b4fea95f894c223df3c53f26c124d8d65415edd8048f80700655be212b64721');
const startMarker = '      const page = await fetch(detail.url, { signal: AbortSignal.timeout(10000) });';
const endMarker = "      assert.equal(new URL(page.url).hostname, 'tokenoverflow.app');";
const original = files['released-client-read.snapshot.mjs'];
const start = original.indexOf(startMarker);
const end = original.indexOf(endMarker, start);
assert.ok(start >= 0 && end > start, 'Pinned released predicate must be present');
assert.equal(original.indexOf(startMarker, start + 1), -1, 'Predicate extraction must be unique');
const predicate = original.slice(start, end + endMarker.length);
// Evaluate only these unchanged released statements. Never import/run the full
// client harness: that separate script would require an SDK and real endpoint.
const checkReleased = runInNewContext(`(async (detail, fetch) => {
  let canonicalPageStatus = null;
${predicate}
  return {status: canonicalPageStatus, url: page.url};
})`, { assert, URL, AbortSignal });

const fixture = JSON.parse(files['fixture.json']);
const report = fixture.report;
const expectedUrl = `https://tokenoverflow.app/reports/${report.id}`;
const detail = { ...report, url: expectedUrl };
const correctHtml = '<h1>SDK failure &amp; retry &lt;check&gt;</h1>';
function simulatedFetch(caseName, calls) {
  return async (url, options) => {
    assert.equal(url, expectedUrl);
    assert.ok(options?.signal instanceof AbortSignal);
    calls.push({requested_url: url, redirect: options.redirect ?? 'follow (default)'});
    if (caseName === 'exact-report-control') return {status: 200, url: expectedUrl, redirected: false, text: async () => correctHtml};
    assert.equal(caseName, 'same-host-redirect-to-home');
    if (options.redirect === 'manual') return {status: 302, url: expectedUrl, redirected: false, text: async () => ''};
    return {status: 200, url: 'https://tokenoverflow.app/', redirected: true, text: async () => '<h1>Search findings</h1>'};
  };
}
const observations = [];
for (const candidate of fixture.cases) {
  for (const implementation of ['released', 'fixed']) {
    const calls = [];
    let accepted, diagnostic;
    try {
      const fetchPage = simulatedFetch(candidate.name, calls);
      const result = implementation === 'released'
        ? await checkReleased(detail, fetchPage)
        : await checkCanonicalReportPage(report, fetchPage);
      accepted = true;
      diagnostic = `accepted HTTP ${result.status} at ${result.url}`;
    } catch (error) {
      accepted = false;
      diagnostic = String(error.message).split('\n')[0];
    }
    observations.push({case: candidate.name, implementation, accepted, correct_acceptance: candidate.correct_acceptance,
      criterion_satisfied: accepted === candidate.correct_acceptance, diagnostic, calls});
  }
}
// Experiment success requires exposing the old false pass AND preserving the
// positive control, rather than simply rejecting every simulated page.
assert.ok(observations.find(row => row.case === 'same-host-redirect-to-home' && row.implementation === 'released' && !row.criterion_satisfied));
assert.ok(observations.filter(row => row.implementation === 'fixed').every(row => row.criterion_satisfied));
assert.ok(observations.filter(row => row.case === 'exact-report-control').every(row => row.criterion_satisfied));
console.log(JSON.stringify({
  kind: fixture.fixture_kind,
  runtime: {node: process.version, platform: platform(), arch: arch()},
  sources: {released_commit: '3c48c19682ee9fd0764caeef70a736d0cabb861d', fixed_tree: '63eabdcbdc362821ec69867643fcb9f899806671'},
  sha256: {...Object.fromEntries(Object.entries(files).map(([name, value]) => [name, sha256(value)])), extracted_released_predicate: sha256(predicate)},
  criterion: 'Accept the exact report HTTP 200 with matching heading; reject a same-host redirect to home.',
  observations,
  scope: 'New authored deterministic replay of exact first-party QA source. No actual redirect, deployed wrong page, MCP session or independent fix verification is claimed.'
}, null, 2));
