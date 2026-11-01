// Pure source/render checks: no application server, network, credentials or replay.
// Run: node scripts/qa/evidence-links.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const sources = {};
function load(relative, imports) {
 const source = fs.readFileSync(new URL(`../../${relative}`, import.meta.url), 'utf8');
 sources[relative] = createHash('sha256').update(source).digest('hex');
 const code = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
 } }).outputText;
 const testModule = { exports: {} };
 vm.runInNewContext(code, { URL, module: testModule, exports: testModule.exports, require: name => {
  if (Object.hasOwn(imports, name)) return imports[name];
  if (name === 'react/jsx-runtime' || name === 'react') return require(name);
  throw new Error(`Unexpected render import: ${name}`);
 } });
 return testModule.exports;
}
const css = new Proxy({}, { get: (_target, key) => `fixture-${String(key)}` });
const { EvidenceText } = load('components/evidence-text.tsx', {});
const fragmentLanding = load('components/report-fragment-landing.tsx', {});
const { ContributionDisclosure } = load('components/contribution-disclosure.tsx', {});
const { EvidenceRecord } = load('components/evidence-record.tsx', {
 './evidence-text': { EvidenceText }, './evidence.module.css': css,
});
const decode = text => text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity) => {
 if (entity.startsWith('#x')) return String.fromCodePoint(parseInt(entity.slice(2), 16));
 if (entity.startsWith('#')) return String.fromCodePoint(parseInt(entity.slice(1), 10));
 return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[entity];
});
const plain = html => decode(html.replace(/<[^>]*>/g, ''));
const anchors = html => [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(match => ({
 href: decode(/\bhref="([^"]*)"/.exec(match[1])?.[1] ?? ''),
 text: plain(match[2]), attributes: match[1],
}));
const renderText = text => renderToStaticMarkup(createElement(EvidenceText, { text }));
const renderRecord = (bundle, kind = 'fix') => renderToStaticMarkup(createElement(EvidenceRecord, { kind, bundle }));
const checks = [];
function check(name, run) { run(); checks.push(name); }
function exact(text, hrefs) {
 const html = renderText(text);
 assert.equal(plain(html), text, 'rendered text changed');
 const links = anchors(html);
 assert.deepEqual(links.map(link => link.href), hrefs);
 for (const link of links) {
  assert.equal(link.text, link.href, 'visible URL changed from literal href');
  assert.match(link.attributes, /rel="noopener noreferrer nofollow ugc"/);
  assert.match(link.attributes, /referrerPolicy="no-referrer"/i);
  assert.doesNotMatch(link.attributes, /\btarget=|\bon\w+=|prefetch/i);
 }
 return html;
}
const draft = JSON.parse(fs.readFileSync(new URL('../../company/research/2026-10-30-first-useful-finding-draft.json', import.meta.url), 'utf8'));
const pin = '8b0b406fe2d976d98ea535a2524627c34bbaa412';
const root = `Amnx404/tokenoverflow/${pin}/company/research/pilots/2026-10-30-openai-compatible-null/`;
const zip = `https://raw.githubusercontent.com/${root}pr24151-reader.zip`;
const readme = `https://github.com/Amnx404/tokenoverflow/blob/${pin}/company/research/pilots/2026-10-30-openai-compatible-null/README.md`;
check('actual approved reproduction and both check instructions retain text and exact two pinned hrefs', () => {
 for (const text of [draft.report.reproduction, draft.report.evidence_bundle.check.instructions, draft.proposed_change.evidence_bundle.check.instructions]) exact(text, [zip, readme]);
 for (const bundle of [draft.report.evidence_bundle, draft.proposed_change.evidence_bundle]) {
  const html = renderRecord(bundle, bundle.after_result === null ? 'report' : 'fix');
  assert.deepEqual(anchors(html).map(link => link.href), [zip, readme]);
  const instructions = /<pre>([\s\S]*?)<\/pre>/.exec(html)?.[1];
  assert.equal(plain(instructions), bundle.check.instructions);
 }
});
check('repeated and prose-adjacent URLs preserve ordering, separation and whitespace', () => {
 const a = 'https://example.test/a'; const b = 'http://other.test/b';
 exact(` \t${a}\n${a}\r\n${b} `, [a, a, b]);
 exact(`${a},${b}`, [a, b]);
 exact(`(${a})(${b})`, [a, b]);
 exact('', []);
 const long = `https://example.test/${'x'.repeat(20000)}`;
 exact(`${long}${'.'.repeat(20000)}`, [long]);
});
check('balanced path punctuation, IPv6 and conservative terminal prose trimming', () => {
 const balanced = 'https://example.test/a(b)';
 exact(`(${balanced}).`, [balanced]);
 exact('[https://example.test/path)]', ['https://example.test/path']);
 exact('See https://example.test/path.,;!', ['https://example.test/path']);
 exact('(http://[2001:db8::1]:8080/a)', ['http://[2001:db8::1]:8080/a']);
 exact('HTTPS://EXAMPLE.TEST/a%20b', ['HTTPS://EXAMPLE.TEST/a%20b']);
});
check('literal query, fragment, colon, question mark and percent encoding are never rebuilt', () => {
 for (const url of [
  'https://example.test/?q=ending:', 'https://example.test/path:',
  'https://example.test/?', 'https://example.test/?q=what?',
  'https://example.test/?q=a,b.;!', 'https://example.test/?a=1&b=%2F#frag%20ment',
  'https://example.test/?q=,https://other.test/',
 ]) exact(url, [url]);
});
check('credentials, raw authority @, backslashes and invalid hosts remain wholly inert', () => {
 for (const text of [
  'https://user:password@example.test/a', 'https://@example.test/a',
  'https://user%40name@example.test/a', 'https://good.test\\evil.test/a',
  'https:///example.test/a', 'https://bad..test/a', 'https://-bad.test/a',
  'https://./a', 'https://example.test:wrong/a', 'https://[invalid]/a',
 ]) exact(text, []);
});
check('raw controls and percent-encoded C0/DEL reject the whole candidate, never a safe prefix', () => {
 for (const code of [...Array(32).keys(), 127]) {
  if (![10, 13].includes(code)) exact(`https://example.test/a${String.fromCharCode(code)}b`, []);
  exact(`https://example.test/a%${code.toString(16).padStart(2, '0')}b`, []);
 }
 exact('https://example.test/a\thttps://other.test/', []);
 exact('https://example.test/a\nhttps://other.test/', ['https://example.test/a', 'https://other.test/']);
});
check('other schemes, embedded schemes and identifier prefixes do not expose an inner link', () => {
 for (const text of [
  'javascript:https://example.test/', 'data:text/plain,https://example.test/',
  'identifierhttps://example.test/', 'javascript:alert(1)', 'data:text/html,<script>x</script>',
  'ftp://example.test/', 'mailto:person@example.test',
 ]) exact(text, []);
});
check('HTML is React-escaped and the renderer adds no wrapper or active markup', () => {
 const html = exact('<script>alert("x")</script> & <img src=x onerror=x> https://example.test/?q=%3Cscript%3E&x=1', ['https://example.test/?q=%3Cscript%3E&x=1']);
 assert.doesNotMatch(html, /<script|<img|<iframe|<div|<span|dangerouslySetInnerHTML/);
 assert.match(html, /&lt;script&gt;/);
});
check('observations, expected results, versions and legacy/null states remain text, not links or verdicts', () => {
 const url = 'https://example.test/observation';
 const bundle = { ...draft.proposed_change.evidence_bundle,
  check: { kind: 'steps', instructions: 'Read https://example.test/check', expected_result: `Expected ${url}` },
  before_result: { output: `Failed observation ${url}`, exit_code: 0 },
  after_result: { output: `Still failed ${url}`, exit_code: 0 },
  versions: [{ kind: 'other', name: url, version: null }, { kind: 'package', name: 'literal version', version: url }],
 };
 const html = renderRecord(bundle, 'verification');
 assert.deepEqual(anchors(html).map(link => link.href), ['https://example.test/check']);
 const blocks = [...html.matchAll(/<pre>([\s\S]*?)<\/pre>/g)].map(match => plain(match[1]));
 assert.deepEqual(blocks, [bundle.check.instructions, bundle.check.expected_result, bundle.before_result.output, bundle.after_result.output]);
 assert.match(html, /Unknown · not supplied/);
 assert.match(html, /Still failed/);
 assert.equal(html.match(/Exit code: 0/g)?.length, 2);
 assert.match(renderRecord({ ...bundle, after_result: null }), /Rerun not recorded/);
 const baseline = renderRecord({ ...bundle, after_result: null }, 'report');
 assert.match(baseline, /Reported baseline/); assert.doesNotMatch(baseline, /After the change/);
 for (const absent of [null, undefined]) {
  const legacy = renderRecord(absent); assert.match(legacy, /No structured check recorded/); assert.deepEqual(anchors(legacy), []);
 }
 const whitespace = renderRecord({ ...bundle, before_result: { output: ' \n\t' }, after_result: { output: '' } });
 assert.ok(whitespace.includes('<pre> \n\t</pre>')); assert.match(whitespace, /Recorded output is empty/);
});

const reportSource = fs.readFileSync(new URL('../../app/reports/[id]/page.tsx', import.meta.url), 'utf8');
const reportId = '11111111-1111-4111-8111-111111111111';
const fixId = '22222222-2222-4222-8222-222222222222';
const resultId = '33333333-3333-4333-8333-333333333333';
const finding = { report: { ...draft.report, id: reportId, author_name: 'Fixture', created_at: '2026-10-30', is_example: false }, fixes: [{
 ...draft.proposed_change, id: fixId, author_name: 'Fixture change', created_at: '2026-10-30', is_own_fix: false,
 verifications: [{ id: resultId, author_name: 'Fixture result', outcome: 'failed', environment: 'Unknown', notes: 'Not a global verdict', evidence_bundle: null }],
}] };
const { default: Detail } = load('app/reports/[id]/page.tsx', {
 '@/components/report-fragment-landing': fragmentLanding,
 '@/app/discussion-read-actions': {
  readDiscussionPage: async input => { assert.deepEqual(JSON.parse(JSON.stringify(input)), { report_id: reportId, parent_id: null }); return { status: 'unavailable' }; },
  readDiscussionContext: () => { throw new Error('Unexpected discussion context read'); },
 },
 '@/components/discussion/connected-thread': { ConnectedDiscussionThread: props => {
  assert.equal(props.reportId, reportId); assert.equal(props.initialPage.status, 'unavailable');
  assert.equal(props.initialContext, undefined); assert.equal(props.selectedCommentId, undefined); assert.equal(props.selectionRequested, false);
  return null;
 } },

 'next/link': ({ children, ...props }) => createElement('a', props, children),
 'next/navigation': { notFound: () => { throw new Error('Unexpected notFound'); } },
 zod: { z: { uuid: () => ({ safeParse: () => ({ success: true }) }) } },
 '@trpc/server': { TRPCError: class extends Error {} },
 '@/trpc/server': { api: { reports: { byId: async () => finding } } },
 'lucide-react': { ArrowLeft: () => createElement('svg') },
 '@/lib/supabase/server': { serverClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }) },
 '@/components/forms': { CopyButton: ({ value, label }) => createElement('button', { 'data-raw-copy': value }, label), FixForm: () => null, VerifyForm: () => null },
 '@/lib/types': { dateLabel: () => 'Fixture date' },
 '@/components/evidence-record': { EvidenceRecord },
 '@/components/evidence-text': { EvidenceText },
 '@/components/contribution-disclosure': { ContributionDisclosure },
 '@/components/verification.module.css': css,
});
const detailHtml = renderToStaticMarkup(await Detail({ params: Promise.resolve({ id: reportId }) }));
check('actual detail render preserves raw reproduction Copy and exact child fragment IDs', () => {
 assert.ok(reportSource.includes('<CopyButton value={r.reproduction} label="Copy reproduction"/>'));
 const reproduction = /<pre class="evidence-block">([\s\S]*?)<\/pre>/.exec(detailHtml)?.[1];
 assert.equal(plain(reproduction), draft.report.reproduction);
 assert.deepEqual(anchors(reproduction).map(link => link.href), [zip, readme]);
 const copied = [...detailHtml.matchAll(/data-raw-copy="([^"]*)"/g)].map(match => decode(match[1]));
 assert.ok(copied.includes(draft.report.reproduction));
 assert.ok(detailHtml.includes(`<article id="fix-${fixId}" class="fix-card">`));
 assert.ok(detailHtml.includes(`id="verification-${resultId}"`));
 assert.match(detailHtml, /Independent results: 0 worked · 1 failed/);
 assert.match(detailHtml, /Not a global verdict/);
});
console.log(JSON.stringify({ status: 'PASS', checks, sources, limits: 'Pure isolated React server rendering with dependency/CSS stubs; no browser, application server, auth, storage, network, artifact replay or production verification.' }, null, 2));
