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
const source = fs.readFileSync(new URL('../../components/evidence-record.tsx', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: {
 module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
 esModuleInterop: true,
} }).outputText;
const textSource = fs.readFileSync(new URL('../../components/evidence-text.tsx', import.meta.url), 'utf8');
const textCode = ts.transpileModule(textSource, { compilerOptions: {
 module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
 esModuleInterop: true,
} }).outputText;
const textModule = { exports: {} };
vm.runInNewContext(textCode, { URL, module: textModule, exports: textModule.exports, require: name => {
 if (name === 'react/jsx-runtime') return require(name);
 throw new Error(`Unexpected text renderer import: ${name}`);
} });
const testModule = { exports: {} };
vm.runInNewContext(code, { module: testModule, exports: testModule.exports, require: name => {
 if (name === './evidence-text') return textModule.exports;
 if (name === './evidence.module.css') return new Proxy({}, { get: (_target, key) => `fixture-${String(key)}` });
 if (name === 'react/jsx-runtime') return require(name);
 throw new Error(`Unexpected renderer import: ${name}`);
} });
const { EvidenceRecord } = testModule.exports;
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
 assert.match(html, /Recorded baseline · investigation open/);
 assert.match(html, /Baseline observation/);
 assert.doesNotMatch(html, /After the change|Rerun not recorded|same check for both observations/);
});
check('proposed change explicitly lacks a rerun and preserves unknown version', () => {
 const html = render('fix', baseline);
 assert.match(html, /Rerun not recorded\. This remains a proposed change/);
 assert.match(html, /Linux<\/td><td>Unknown · not supplied/);
 assert.match(html, /Structured fields do not prove that a check was run or that a change is correct/);
});
check('observed whitespace, empty output and exit code zero survive rendering', () => {
 const html = render('verification', { ...baseline, before_result: { output: ' \n\t', exit_code: 0 }, after_result: { output: '', exit_code: 0 } });
 assert.match(html, /Whitespace-only output recorded/);
 assert.ok(html.includes('<pre> \n\t</pre>'), 'observed whitespace changed');
 assert.equal(html.match(/Exit code: 0/g)?.length, 2);
 assert.match(html, /Recorded output is empty/);
 assert.doesNotMatch(html, /Rerun not recorded/);
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

console.log(JSON.stringify({ status: 'PASS', source: 'components/evidence-record.tsx', source_sha256: createHash('sha256').update(source).digest('hex'), checks, limits: 'Component server rendering only; CSS stubbed. No stored roundtrip, hydrated interaction, auth, production or genuine usefulness proof.' }, null, 2));
