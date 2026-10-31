import assert from 'node:assert/strict';
import test from 'node:test';
import { checkCanonicalReportPage } from './canonical-source.mjs';

const report = { id: '10000000-0000-4000-8000-000000000001', title: 'SDK failure & retry <check>' };
const url = `https://tokenoverflow.app/reports/${report.id}`;
const validHtml = '<h1>SDK failure &amp; retry &lt;check&gt;</h1>';
const page = (overrides = {}) => ({ status: 200, url, redirected: false, text: async () => validHtml, ...overrides });
const fetchPage = response => async (requested, options) => {
  assert.equal(requested, url);
  assert.equal(options.redirect, 'manual');
  return response;
};

test('accepts an exact canonical report page with its escaped title', async () => {
  assert.deepEqual(await checkCanonicalReportPage(report, fetchPage(page())), { status: 200, url, identity_verified: true });
});
test('accepts presentation markup and numeric entities within the report heading', async () => {
  await checkCanonicalReportPage(report, fetchPage(page({ text: async () => '<h1 class="title"><span>SDK failure</span> &#38; retry &#x3c;check&#62;</h1>' })));
});
test('rejects a same-host redirect to the home page before following it', async () => {
  await assert.rejects(checkCanonicalReportPage(report, fetchPage(page({ status: 302 }))), /without redirect/);
});
test('rejects a followed same-host redirect ending at HTTP 200', async () => {
  await assert.rejects(checkCanonicalReportPage(report, fetchPage(page({ url: 'https://tokenoverflow.app/', redirected: true }))), /must not follow/);
});
test('rejects a successful home URL even when a report title is present', async () => {
  await assert.rejects(checkCanonicalReportPage(report, fetchPage(page({ url: 'https://tokenoverflow.app/' }))), /exact report URL/);
});
test('rejects a different report path or a query-bearing alternate URL', async () => {
  for (const wrongUrl of [`${url}?next=home`, url.replace(report.id, '20000000-0000-4000-8000-000000000002')]) {
    await assert.rejects(checkCanonicalReportPage(report, fetchPage(page({ url: wrongUrl }))), /exact report URL/);
  }
});
test('rejects home-page or wrong-report heading at the expected URL', async () => {
  await assert.rejects(checkCanonicalReportPage(report, fetchPage(page({ text: async () => '<h1>Search findings</h1>' }))), /h1 must identify/);
});
test('rejects an identity appearing only in scripts, comments or body text', async () => {
  await assert.rejects(checkCanonicalReportPage(report, fetchPage(page({ text: async () => `<!--${validHtml}--><script>${validHtml}</script><p>${report.title}</p>` }))), /h1 must identify/);
});
test('rejects inert template identity before the wrong real report heading', async () => {
  for (const template of [`<template>${validHtml}</template>`, `<template><template>nested</template>${validHtml}</template>`]) {
    await assert.rejects(checkCanonicalReportPage(report, fetchPage(page({ text: async () => `${template}<h1>Wrong page</h1>` }))), /h1 must identify/);
  }
});
test('rejects explicitly hidden or aria-hidden report heading', async () => {
  for (const attributes of ['hidden', 'hidden="false"', 'aria-hidden="true"']) {
    await assert.rejects(checkCanonicalReportPage(report, fetchPage(page({ text: async () => validHtml.replace('<h1>', `<h1 ${attributes}>`) + '<h1>Wrong page</h1>' }))), /h1 must identify/);
  }
});
