import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Source + inert SSR fixture only: no action execution, browser, network or storage.
const root = process.cwd();
const [baselinePath, outputPath] = process.argv.slice(2);
assert(baselinePath && outputPath, 'Pass baseline forms.tsx and private output directory');
const output = path.resolve(outputPath);
assert(!output.startsWith(root + path.sep), 'Keep generated evidence outside application source');
fs.mkdirSync(output, { recursive: true });
const source = fs.readFileSync(path.join(root, 'components/forms.tsx'), 'utf8');
const baseline = fs.readFileSync(baselinePath, 'utf8');
function parse(text) { return ts.createSourceFile('forms.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); }
function functions(text) {
 const tree = parse(text);
 return new Map(tree.statements.filter(ts.isFunctionDeclaration).map(node => [node.name.text, node.getText(tree)]));
}
const before = functions(baseline), after = functions(source);
const excluded = ['Message', 'AuthForm', 'useContributionForm', 'ContributionMessage', 'CopyButton', 'KeyForm'];
for (const name of excluded) assert.equal(after.get(name), before.get(name), `${name} exact bytes`);
const kinds = ['ReportForm', 'FixForm', 'VerifyForm'];
function contracts(text, name) {
 const tree = parse(text);
 const node = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === name);
 const controls = [];
 function visit(child) {
  if (ts.isJsxOpeningElement(child) || ts.isJsxSelfClosingElement(child)) {
   const tag = child.tagName.getText(tree);
   if (['form', 'input', 'textarea', 'select', 'option', 'button', 'EvidenceFields', 'ContributionMessage'].includes(tag)) {
    controls.push([tag, child.attributes.properties.filter(attribute => !ts.isJsxAttribute(attribute) || !['className', 'placeholder'].includes(attribute.name.text)).map(attribute => attribute.getText(tree))]);
   }
  }
  ts.forEachChild(child, visit);
 }
 visit(node);
 return controls;
}
for (const name of kinds) {
 assert.deepEqual(contracts(source, name), contracts(baseline, name), `${name} ordered functional attributes`);
 assert.equal(after.get(name).split('return ')[0], before.get(name).split('return ')[0], `${name} hook setup`);
}
function normalizeClasses(text) {
 const tree = parse(text), ranges = [];
 function visit(node) {
  if (ts.isJsxAttribute(node) && node.name.text === 'className') ranges.push([node.getStart(tree), node.end]);
  ts.forEachChild(node, visit);
 }
 visit(tree);
 for (const [start, end] of ranges.reverse()) text = text.slice(0, start) + 'className=STYLE' + text.slice(end);
 return text;
}
assert.equal(normalizeClasses(after.get('VerifyForm')), normalizeClasses(before.get('VerifyForm')), 'Verify formal text/JSX unchanged except classes');
const evidence = fs.readFileSync(path.join(root, 'components/evidence-fields.tsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'components/contribution-form.module.css'), 'utf8');
assert(!css.includes('checkbox') && !css.includes(':global(.notice)'), 'No checkbox/global notice override');
const require = createRequire(import.meta.url);
const styles = new Proxy({}, { get: (_, key) => `contribution-${String(key)}` });
function load(relative) {
 const filename = path.join(root, relative);
 const text = fs.readFileSync(filename, 'utf8');
 const code = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
 const fixtureModule = { exports: {} };
 function fixtureRequire(id) {
  if (id === 'react') return { ...React, useActionState: () => [{}, undefined, false] };
  if (id.endsWith('.module.css')) return { __esModule: true, default: styles };
  if (id === '@/app/actions') return { beginGitHubSignIn() {}, contribute() {}, createAgentKey() {} };
  if (id === '@/lib/telemetry-browser') return { captureTelemetryCopy() {} };
  if (id === '@/lib/types') return load('lib/types.ts');
  if (id === '@/components/evidence-fields') return load('components/evidence-fields.tsx');
  return require(id);
 }
 vm.runInNewContext('(function(require,module,exports){' + code + '\n})', { console }, { filename })(fixtureRequire, fixtureModule, fixtureModule.exports);
 return fixtureModule.exports;
}
const forms = load('components/forms.tsx');
const htmls = {};
for (const [name, props] of [['ReportForm', {}], ['FixForm', { reportId: 'fixture-report' }], ['VerifyForm', { fixId: 'fixture-fix', reportId: 'fixture-report' }]]) {
 const html = renderToStaticMarkup(React.createElement(forms[name], props));
 htmls[name] = html;
 fs.writeFileSync(path.join(output, `${name}.html`), html + '\n');
 assert(html.includes('name="evidence_enabled"') && !html.includes('name="evidence_check_kind"'), `${name} optional evidence remains opt-in`);
 assert.equal((html.match(/<button/g) || []).length, 1, `${name} one bottom action by default`);
 assert(html.includes('aria-busy="false"'), `${name} default pending state`);
}
assert(htmls.ReportForm.includes('Your finding') && htmls.ReportForm.includes('Helpful details') && htmls.ReportForm.includes('Publish finding'));
assert(htmls.FixForm.includes('Relevant environment') && htmls.FixForm.includes('If no check was run, say so.') && htmls.FixForm.includes('Publish change'));
assert(htmls.VerifyForm.includes('Worked in my environment') && htmls.VerifyForm.includes('Did not work in my environment') && htmls.VerifyForm.includes('Record result'));
const result = { evidence: 'Actual component static SSR with inert action-state fixture; not hydrated/browser/build/deployed acceptance', checks: ['six excluded functions exact bytes', 'three ordered field/action/limit/pending/receipt attribute contracts', 'three unchanged hook setup blocks', 'Verify exact text/JSX except classes', 'default Report/Fix/Verify SSR and optional evidence/action checks'], outputs: kinds.map(name => `${name}.html`), evidenceFieldsBytes: Buffer.byteLength(evidence) };
fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
