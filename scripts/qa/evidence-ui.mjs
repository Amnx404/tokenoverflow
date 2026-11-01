// Exact-source server-rendered evidence semantics, using isolated in-memory examples.
// No database, credentials, network, execution of contributed checks or browser.
// Run: node scripts/qa/evidence-ui.mjs
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
const modules = new Map();
const state = { list: { reports: [], count: 0 }, finding: null, exampleId: null, listCalls: [], byIdCalls: [], exampleCalls: 0 };
// Strict read/context doubles live only here. No writer, adapter replacement or product alias.
const api = { reports: {
 list: async input => { state.listCalls.push(input); return state.list; },
 byId: async ({ id }) => { state.byIdCalls.push(id); assert.equal(id, state.finding?.report.id); return state.finding; },
} };
const nativeLink = ({ href, children, ...props }) => createElement('a', { ...props, href }, children);
const failForm = () => { throw new Error('Unexpected contribution form in signed-out renderer'); };
const forms = { FixForm: failForm, VerifyForm: failForm, CopyButton: ({ value, label }) => createElement('button', { 'data-test-copy-value': value }, label) };
const allowed = new Set(['app/page.tsx', 'app/reports/[id]/page.tsx', 'components/report-card.tsx', 'components/evidence-record.tsx', 'components/evidence-text.tsx', 'components/contribution-disclosure.tsx', 'components/report-fragment-landing.tsx', 'lib/types.ts', 'lib/validation.ts']);
function load(relative) {
 if (modules.has(relative)) return modules.get(relative);
 assert.ok(allowed.has(relative), `Unexpected actual-source module: ${relative}`);
 const source = fs.readFileSync(new URL(`../../${relative}`, import.meta.url), 'utf8');
 sources[relative] = createHash('sha256').update(source).digest('hex');
 const result = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
 } });
 assert.equal(result.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
 const testModule = { exports: {} };
 vm.runInNewContext(result.outputText, { URL, URLSearchParams, module: testModule, exports: testModule.exports, require: name => {
  if (['./evidence.module.css', '@/components/verification.module.css', '@/components/shell.module.css'].includes(name)) return { __esModule: true, default: new Proxy({}, { get: (_target, key) => `fixture-${String(key)}` }) };
  if (name === 'next/link') return nativeLink;
  if (name === 'next/navigation') return { notFound: () => { throw new Error('Not found'); } };
  if (name === '@/trpc/server') return { api };
  if (name === '@/server/services/reports') return { getExampleReportId: async () => { state.exampleCalls++; return state.exampleId; } };
  if (name === '@/lib/supabase/server') return { serverClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }) };
  if (name === '@/components/forms') return forms;
  if (name === '@/app/discussion-read-actions') return {
   readDiscussionPage: async input => { assert.deepEqual(JSON.parse(JSON.stringify(input)), { report_id: state.finding.report.id, parent_id: null }); return { status: 'unavailable' }; },
   readDiscussionContext: () => { throw new Error('Unexpected discussion context read'); },
  };
  if (name === '@/components/discussion/connected-thread') return { ConnectedDiscussionThread: props => {
   assert.equal(props.reportId, state.finding.report.id); assert.equal(props.initialPage.status, 'unavailable');
   assert.equal(props.initialContext, undefined); assert.equal(props.selectedCommentId, undefined); assert.equal(props.selectionRequested, false);
   return null;
  } };

  if (['react', 'react/jsx-runtime', 'zod', '@trpc/server', 'lucide-react'].includes(name)) return require(name);
  const local = name.startsWith('@/') ? name.slice(2) : name.startsWith('./') ? `${relative.slice(0, relative.lastIndexOf('/'))}/${name.slice(2)}` : null;
  if (local) return load(`${local}.tsx`.replace(/lib\/(types|validation)\.tsx$/, 'lib/$1.ts'));
  throw new Error(`Unexpected renderer import: ${name}`);
 } });
 modules.set(relative, testModule.exports);
 return testModule.exports;
}
const { EvidenceRecord } = load('components/evidence-record.tsx');
const render = (kind, bundle) => renderToStaticMarkup(createElement(EvidenceRecord, { kind, bundle }));
const baseline = {
 contract_version: 1,
 check: { kind: 'command', instructions: 'node example.mjs', expected_result: 'Print 1.5 for input 1,5' },
 before_result: { output: '  1\n', exit_code: 0 }, after_result: null,
 versions: [{ kind: 'runtime', name: 'Node.js', version: '24.0.0' }, { kind: 'os', name: 'Linux', version: null }],
};
const checks = [];
function check(name, run) { run(); checks.push(name); }

check('legacy absence stays unstructured without invented observations', () => {
 for (const absent of [undefined, null]) {
  const html = render('fix', absent);
  assert.match(html, /No structured check recorded/);
  assert.match(html, /original description and notes/);
  assert.doesNotMatch(html, /<pre>|<table|Exit code|Rerun not recorded/);
 }
});
check('report baseline stays open without a fixing rerun', () => {
 const html = render('report', baseline);
 assert.match(html, /Reported baseline/);
 assert.match(html, /Baseline observation/);
 assert.doesNotMatch(html, /After the change|Rerun not recorded|shared instructions|investigation open/);
});
check('proposed change explicitly lacks a rerun and preserves unknown version', () => {
 const html = render('fix', baseline);
 assert.match(html, /Rerun not recorded\. This remains a proposed change/);
 assert.match(html, /Linux<\/td><td>Unknown · not supplied/);
 assert.match(html, /Reported check · rerun not recorded/);
 assert.doesNotMatch(html, /shared instructions|Reported before \/ after|Contributor-reported observations/);
});
check('observed whitespace, empty output and exit code zero survive rendering', () => {
 const html = render('verification', { ...baseline, before_result: { output: ' \n\t', exit_code: 0 }, after_result: { output: '', exit_code: 0 } });
 assert.match(html, /Whitespace-only output recorded/);
 assert.ok(html.includes('<pre> \n\t</pre>'), 'observed whitespace changed');
 assert.equal(html.match(/Exit code: 0/g)?.length, 2);
 assert.match(html, /Recorded output is empty/);
 assert.doesNotMatch(html, /Rerun not recorded/);
 assert.match(html, /Reported before \/ after/);
 assert.match(html, /Command · shared instructions/);
});
check('conflicting observations retain their own full checks and conditions', () => {
 const worked = { ...baseline, check: { ...baseline.check, instructions: 'node example.mjs --input 1.5' }, after_result: { output: '1.5', exit_code: 0 } };
 const failed = { ...baseline, check: { ...baseline.check, instructions: 'node example.mjs --input 1,5' }, after_result: { output: 'NaN', exit_code: 0 }, versions: [{ kind: 'runtime', name: 'Node.js', version: '24.0.0' }, { kind: 'api', name: 'Input locale', version: 'decimal comma' }] };
 const html = renderToStaticMarkup(createElement('main', {},
  createElement('article', {}, createElement('h2', {}, 'Worked · decimal dot'), createElement(EvidenceRecord, { kind: 'verification', bundle: worked })),
  createElement('article', {}, createElement('h2', {}, 'Failed · decimal comma'), createElement(EvidenceRecord, { kind: 'verification', bundle: failed })),
 ));
 assert.match(html, /Worked · decimal dot/);
 assert.match(html, /Failed · decimal comma/);
 assert.match(html, /--input 1\.5/);
 assert.match(html, /--input 1,5/);
 assert.match(html, /NaN/);
 assert.match(html, /decimal comma/);
 assert.equal(html.match(/After the change/g)?.length, 2);
 assert.doesNotMatch(html, /accepted answer|globally verified|automatically verified/i);
});
check('untrusted check, output and version text is escaped without private projection', () => {
 const hostile = '<script>fixture()</script><img src=x onerror=fixture()>';
 const html = render('verification', { ...baseline,
  private_account_id: 'private-account-sentinel',
  check: { kind: 'steps', instructions: hostile, expected_result: hostile },
  before_result: { output: hostile }, after_result: { output: hostile },
  versions: [{ kind: 'other', name: hostile, version: hostile }],
 });
 assert.match(html, /Repeatable steps/);
 assert.ok(html.includes('&lt;script&gt;fixture()&lt;/script&gt;'));
 assert.doesNotMatch(html, /<script|<img|<iframe|<a\b|private-account-sentinel/);
});


const decode = text => text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, value) => value.startsWith('#x') ? String.fromCodePoint(parseInt(value.slice(2), 16)) : value.startsWith('#') ? String.fromCodePoint(Number(value.slice(1))) : ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[value]);
const plain = html => decode(html.replace(/<[^>]*>/g, ''));
const anchors = html => [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(m => ({ href: decode(/\bhref="([^"]*)"/.exec(m[1])?.[1] ?? ''), text: plain(m[2]) }));
const emptyPanel = html => /<div class="empty-state">([\s\S]*?)<\/div>/.exec(html)?.[1] ?? '';
const id = '11111111-1111-4111-8111-111111111111';
const report = { id, author_name: 'Contributor', title: 'Fixture observation', summary: 'Inspect the supplied evidence', category: 'APIs', tags: [], is_example: false, created_at: '2026-10-31T00:00:00Z', fix_count: 0, worked_count: 0, failed_count: 0, environment: 'non-streaming doGenerate; doStream untested; OS version unknown', body: 'Observed raw behavior', reproduction: 'Raw reproduction https://example.com/repro', attempted_fixes: '', evidence_bundle: baseline };
const change = { id: '22222222-2222-4222-8222-222222222222', report_id: id, author_name: 'Contributor', body: 'Exact local change', evidence: 'Original raw check notes', environment: 'Local wire only; provider untested', evidence_bundle: { ...baseline, after_result: { output: '1.5', exit_code: 0 } }, verifications: [] };
function reset({ reports = [], count = 0, finding = null, exampleId = null } = {}) { state.list = { reports, count }; state.finding = finding; state.exampleId = exampleId; state.listCalls = []; state.byIdCalls = []; state.exampleCalls = 0; }
const HomeModule = load('app/page.tsx');
const DetailModule = load('app/reports/[id]/page.tsx');
const { ReportCard } = load('components/report-card.tsx');
async function routeCheck(name, run) { await run(); checks.push(name); }
const home = async params => renderToStaticMarkup(await HomeModule.default({ searchParams: Promise.resolve(params) }));
const detail = async finding => { reset({ finding }); return renderToStaticMarkup(await DetailModule.default({ params: Promise.resolve({ id }) })); };

check('card labels proposal count literally and leaves full raw environment visible', () => {
 const html = renderToStaticMarkup(createElement(ReportCard, { report }));
 assert.match(html, /No proposed changes/); assert.match(html, /Independent results: 0 worked · 0 failed/);
 assert.ok(plain(html).includes(report.environment)); assert.doesNotMatch(html, /Open investigation|resolved|verified/i);
 const proposed = renderToStaticMarkup(createElement(ReportCard, { report: { ...report, fix_count: 1, worked_count: 2, failed_count: 3 } }));
 assert.match(proposed, /1 proposed change/); assert.match(proposed, /Independent results: 2 worked · 3 failed/);
});
await routeCheck('zero-proposal detail retains reported baseline and one visible uncertainty explanation', async () => {
 const html = await detail({ report, fixes: [] });
 assert.match(html, /No proposed changes recorded yet\./); assert.match(html, /Reported baseline/);
 assert.match(html, /Baseline observation/); assert.match(html, /node example\.mjs/);
 assert.doesNotMatch(html, /No change or before \/ after check|investigation open|same-check comparison/);
 assert.equal(plain(html).split('Contributor-reported evidence; structured fields do not prove execution or correctness.').length - 1, 1);
 assert.ok(html.indexOf('Contributor-reported evidence;') < html.indexOf('Versions / environment'));
 assert.match(html, /data-test-copy-value="Raw reproduction https:\/\/example.com\/repro"/);
 assert.match(html, /class="contribution-details" open=""/);
 const metadata = await DetailModule.generateMetadata({ params: Promise.resolve({ id }) });
 assert.equal(metadata.alternates.canonical, `https://tokenoverflow.app/reports/${id}`); assert.equal(metadata.robots.index, true);
});
await routeCheck('first-party after observation is not an independent result; null rerun is not a comparison', async () => {
 const html = await detail({ report: { ...report, fix_count: 1 }, fixes: [change] });
 assert.match(html, /Reported before \/ after/); assert.match(html, /Command · shared instructions/);
 assert.match(html, /Independent results: 0 worked · 0 failed/); assert.match(html, /Independent results \(0\)/);
 assert.equal(plain(html).split('Contributor-reported evidence; structured fields do not prove execution or correctness.').length - 1, 1);
 assert.match(html, /id="fix-22222222-2222-4222-8222-222222222222"/);
 assert.match(html, /Reported environment/); assert.match(html, /Steps \/ investigation notes/); assert.match(html, /Original raw check notes/); assert.match(html, /Local wire only; provider untested/);
 assert.doesNotMatch(html, /contribution-details" open/);
 const pending = await detail({ report: { ...report, fix_count: 1 }, fixes: [{ ...change, evidence_bundle: baseline }] });
 assert.match(pending, /Reported check · rerun not recorded/); assert.doesNotMatch(pending, /Reported before \/ after|shared instructions|badge failure/);
});
await routeCheck('mixed result detail keeps negative observations, own conditions, unknowns and child anchors', async () => {
 const worked = { id: '33333333-3333-4333-8333-333333333333', author_name: 'Contributor', outcome: 'worked', environment: 'decimal dot only', notes: 'Local condition A', created_at: report.created_at, evidence_bundle: change.evidence_bundle };
 const failed = { ...worked, id: '44444444-4444-4444-8444-444444444444', outcome: 'failed', environment: 'decimal comma; OS unknown', notes: 'Local condition B remains negative', evidence_bundle: { ...baseline, check: { ...baseline.check, kind: 'steps' }, after_result: { output: 'NaN', exit_code: 0 } } };
 const html = await detail({ report: { ...report, fix_count: 1 }, fixes: [{ ...change, verifications: [worked, failed] }] });
 assert.match(html, /Independent results: 1 worked · 1 failed/); assert.match(html, /Independent results \(2\)/);
 for (const value of ['decimal dot only', 'decimal comma; OS unknown', 'Local condition A', 'Local condition B remains negative', 'NaN', 'Unknown · not supplied', 'Repeatable steps · shared instructions']) assert.ok(plain(html).includes(value), value);
 assert.match(html, /id="verification-44444444-4444-4444-8444-444444444444"/);
 assert.equal(plain(html).split('Contributor-reported evidence; structured fields do not prove execution or correctness.').length - 1, 1);
});
await routeCheck('zero-match recovery symmetrically preserves normalized filters and resets only corpus/page', async () => {
 for (const examples of [false, true]) {
  reset(); const params = { q: '  exact failure  ', category: 'APIs', view: 'needs-investigation', page: '999', ...(examples ? { examples: '1' } : {}) };
  const html = await home(params), panel = emptyPanel(html), links = anchors(panel);
  assert.match(panel, /No matching findings/); assert.match(panel, /Try another search or clear the filters\./);
  assert.equal(links[0].text, examples ? 'Search community findings' : 'Search examples');
  const url = new URL(links[0].href, 'https://fixture.invalid');
  assert.equal(url.searchParams.get('q'), 'exact failure'); assert.equal(url.searchParams.get('category'), 'APIs'); assert.equal(url.searchParams.get('view'), 'needs-investigation'); assert.equal(url.searchParams.get('page'), '1'); assert.equal(url.searchParams.get('examples'), examples ? '' : '1');
  assert.equal(links[1].href, '/reports/new'); assert.match(panel, /<p class="muted small"><a href="\/reports\/new">Share a finding<\/a><\/p>/);
  assert.equal(state.listCalls[0].q, 'exact failure'); assert.equal(state.listCalls[0].examples, examples); assert.equal(state.exampleCalls, 0);
  assert.match(html, /No proposed changes/); assert.doesNotMatch(html, /Open investigations/);
 }
 reset(); const html = await home({ q: 'z'.repeat(330), category: 'invalid', view: 'invalid', examples: '1' });
 const link = anchors(emptyPanel(html))[0]; const url = new URL(link.href, 'https://fixture.invalid'); assert.equal(url.searchParams.get('q').length, 300); assert.equal(url.searchParams.has('category'), false); assert.equal(url.searchParams.has('view'), false);
});
await routeCheck('true-empty community keeps Share and illustrative preview; stale pages keep first-page recovery', async () => {
 reset({ finding: { report: { ...report, is_example: true }, fixes: [{ ...change, verifications: [{ outcome: 'worked' }, { outcome: 'failed' }] }] }, exampleId: id });
 const html = await home({}); assert.match(html, /Share a clue, question, or partial investigation\./); assert.match(html, /Find what others have learned\. Share what you learn\./); assert.match(html, /Don’t waste tokens rediscovering what someone else already figured out\./); assert.equal(anchors(emptyPanel(html))[0].text, 'Share a finding'); assert.match(html, /Illustrative · no verified fix/); assert.match(html, /Independent results: 1 worked · 1 failed/); assert.equal(state.exampleCalls, 1);
 reset({ count: 9 }); const stale = await home({ q: 'exact failure', category: 'APIs', view: 'reproduced', examples: '1', page: '1000' });
 const first = anchors(emptyPanel(stale))[0]; assert.equal(first.text, 'View first page'); const url = new URL(first.href, 'https://fixture.invalid');
 for (const [key, value] of Object.entries({ q: 'exact failure', category: 'APIs', view: 'reproduced', examples: '1', page: '1' })) assert.equal(url.searchParams.get(key), value);
 assert.match(stale, /9 matching findings are available/); assert.equal(state.exampleCalls, 0);
 const clean = await HomeModule.generateMetadata({ searchParams: Promise.resolve({}) }); const filtered = await HomeModule.generateMetadata({ searchParams: Promise.resolve({ examples: '1' }) });
 assert.equal(clean.robots.index, true); assert.equal(filtered.robots.index, false); assert.equal(filtered.alternates.canonical, 'https://tokenoverflow.app/');
});
console.log(JSON.stringify({ status: 'PASS', sources, checks, limits: 'Actual-source component/server markup and URL-state checks only. Strict read/auth/native wrapper doubles and CSS stubs confined to this QA file. No writer, storage, transport, browser interaction, clipboard, Next refresh, auth-session, deployment or usefulness proof.' }, null, 2));
