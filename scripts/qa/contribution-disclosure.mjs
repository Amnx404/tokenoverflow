// Source + actual React SSR + explicitly mocked-hook state units only.
// No browser, DOM, Next transport, application server, network or authentication.
// Run: node scripts/qa/contribution-disclosure.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const path = 'components/contribution-disclosure.tsx';
const source = fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const detail = fs.readFileSync(new URL('../../app/reports/[id]/page.tsx', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: {
 module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
 jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
} }).outputText;
function load(react = require('react')) {
 const testModule = { exports: {} };
 vm.runInNewContext(code, { module: testModule, exports: testModule.exports, require: name => {
  if (name === 'react') return react;
  if (name === 'react/jsx-runtime') return require(name);
  throw new Error(`Unexpected disclosure import: ${name}`);
 } });
 return testModule.exports.ContributionDisclosure;
}
const ContributionDisclosure = load();
const checks = [];
function check(name, run) { run(); checks.push(name); }
check('actual React server rendering preserves initial open and closed states, exact class/summary and escaped children', () => {
 for (const initialOpen of [true, false]) {
  const html = renderToStaticMarkup(createElement(ContributionDisclosure, { initialOpen },
   createElement('p', { 'data-child': 'retained' }, '<script>untrusted</script> & receipt'),
  ));
  assert.match(html, /^<details class="contribution-details"/);
  assert.equal(/\bopen=""/.test(html), initialOpen);
  assert.match(html, /<summary>Share a change or workaround<\/summary>/);
  assert.match(html, /<p data-child="retained">&lt;script&gt;untrusted&lt;\/script&gt; &amp; receipt<\/p>/);
  assert.doesNotMatch(html, /<script|onToggle=/);
 }
});
function mockedInstance(initialOpen) {
 let mounted = false;
 let state;
 let initializations = 0;
 const Component = load({ useState: initial => {
  if (!mounted) { state = initial; mounted = true; initializations++; }
  return [state, next => { state = typeof next === 'function' ? next(state) : next; }];
 } });
 return { render: (nextInitial = initialOpen, children = 'saved receipt') => Component({ initialOpen: nextInitial, children }), get initializations() { return initializations; } };
}
check('mocked-hook same-instance update keeps receipt open when the first saved fix changes initialOpen to false', () => {
 const instance = mockedInstance(true);
 const first = instance.render();
 assert.equal(first.type, 'details'); assert.equal(first.props.open, true);
 const afterSave = instance.render(false, 'exact saved fix receipt');
 assert.equal(afterSave.props.open, true);
 assert.ok(afterSave.props.children.includes('exact saved fix receipt'));
 assert.equal(instance.initializations, 1);
});
check('mocked-hook toggle follows currentTarget and retains user choice across opposite initial props', () => {
 const instance = mockedInstance(true);
 instance.render().props.onToggle({ currentTarget: { open: false }, target: { open: true } });
 assert.equal(instance.render(true).props.open, false);
 instance.render(false).props.onToggle({ currentTarget: { open: true }, target: { open: false } });
 assert.equal(instance.render(false).props.open, true);
 assert.equal(instance.initializations, 1);
 const initiallyClosed = mockedInstance(false);
 assert.equal(initiallyClosed.render().props.open, false);
 assert.equal(initiallyClosed.render(true).props.open, false);
 // A fresh mocked instance has fresh initialization; real keyed reconciliation is not simulated here.
 assert.equal(mockedInstance(true).render().props.open, true);
});
check('actual detail source keys by public finding while retaining conditional form children, Copy and saved-child anchors', () => {
 assert.match(source, /^'use client';/);
 assert.doesNotMatch(source, /useEffect|useLayoutEffect|defaultOpen|document\.|window\./);
 assert.ok(detail.includes('<ContributionDisclosure key={id} initialOpen={!fixes.length}>'));
 assert.ok(detail.includes('{user?<FixForm reportId={id}/>:<p className="notice"><Link href={`/login?next=/reports/${id}`}>Sign in to share a change</Link></p>}</ContributionDisclosure>'));
 assert.ok(detail.includes('<CopyButton value={r.reproduction} label="Copy reproduction"/>'));
 assert.ok(detail.includes('id={`fix-${f.id}`}'));
 assert.ok(detail.includes('id={`verification-${v.id}`}'));
 assert.ok(detail.includes('<VerifyForm fixId={f.id} reportId={id}/>'));
 assert.doesNotMatch(detail, /<details className="contribution-details"/);
});
console.log(JSON.stringify({ status: 'PASS', checks, source: path,
 source_sha256: createHash('sha256').update(source).digest('hex'),
 detail_sha256: createHash('sha256').update(detail).digest('hex'),
 limits: 'Initial markup uses actual React SSR; updates/toggles use an explicit mocked useState lifecycle, not real DOM, hydration, Next transport/refresh, keyed reconciliation, IAB, auth or production proof. No browser launched.',
}, null, 2));
