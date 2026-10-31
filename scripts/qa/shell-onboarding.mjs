// Actual-source SSR and deterministic clipboard/hook-state checks. No browser, account write or network.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import postcss from 'postcss';
const require = createRequire(import.meta.url);
const connectionHelpOnly = process.argv[2] === '--connection-help';
const output = process.argv[connectionHelpOnly ? 3 : 2];
const sources = {}, cache = new Map(), checks = [];
const fixture = { pathname: '/', user: null, keys: [], keyError: false, keyReads: 0, actionCalls: 0, reports: [], reportCalls: [] };
const nativeLink = ({ href, children, ...props }) => React.createElement('a', { ...props, href }, children);
const forbiddenAction = () => { fixture.actionCalls++; throw new Error('Unexpected account action'); };
const forms = { CopyButton: ({ value, label = 'Copy' }) => React.createElement('button', { 'data-raw-copy': value }, label), KeyForm: () => React.createElement('form', { 'data-existing-key-form': true }, 'Existing key creation controls'), ReportForm: () => React.createElement('form', { 'data-existing-report-form': true }, 'Existing report fields') };
function load(relative, overrides = {}) {
 if (!Object.keys(overrides).length && cache.has(relative)) return cache.get(relative);
 const text = fs.readFileSync(new URL(`../../${relative}`, import.meta.url), 'utf8'); sources[relative] = createHash('sha256').update(text).digest('hex');
 const compiled = ts.transpileModule(text, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } });
 assert.equal(compiled.diagnostics?.filter(x => x.category === ts.DiagnosticCategory.Error).length, 0);
 const loaded = { exports: {} };
 vm.runInNewContext(compiled.outputText, { URL, URLSearchParams, module: loaded, exports: loaded.exports, ...overrides.globals, require: name => {
  if (name === 'react') return overrides.react ?? React;
  if (name === 'react/jsx-runtime') return require(name);
  if (name.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_target, key) => `fixture-${path.basename(name, '.module.css')}-${String(key)}` }) };
  if (name === './globals.css') return {};
  if (name === 'next/link') return nativeLink;
  if (name === 'next/navigation') return { usePathname: () => fixture.pathname, redirect: value => { throw new Error(`Redirect:${value}`); } };
  if (name === 'next/font/google') return { Geist: () => ({ variable: 'fixture-geist' }), Geist_Mono: () => ({ variable: 'fixture-geist-mono' }) };
  if (name === '@/components/telemetry') return { Telemetry: () => null };
  if (name === '@/lib/telemetry-browser') return { captureTelemetryCopy: overrides.telemetry ?? (() => {}) };
  if (name === '@/components/forms') return forms;
  if (name === '@/app/actions' || name === './actions') return { revokeAgentKey: forbiddenAction, signOut: forbiddenAction };
  if (name === '@/lib/supabase/server') return { serverClient: async () => ({ auth: { getUser: async () => ({ data: { user: fixture.user } }) } }) };
  if (name === '@/trpc/server') return { api: { agentKeys: { list: async () => { fixture.keyReads++; if (fixture.keyError) throw new Error('Fixture list unavailable'); return fixture.keys; } }, reports: { list: async input => { fixture.reportCalls.push(input); return { reports: fixture.reports, count: fixture.reports.length }; } } } };
  if (name === '@/server/services/reports') return { getExampleReportId: async () => null };
  if (['lucide-react', 'zod'].includes(name)) return require(name);
  const local = name.startsWith('@/') ? name.slice(2) : name.startsWith('./') ? `${path.posix.dirname(relative)}/${name.slice(2)}` : null;
  if (local) return load(local + (['lib/types', 'lib/validation', 'lib/feedback'].includes(local) ? '.ts' : '.tsx'));
  throw new Error(`Unexpected actual-source import: ${name}`);
 } });
 if (!Object.keys(overrides).length) cache.set(relative, loaded.exports);
 return loaded.exports;
}
if (connectionHelpOnly) {
 const prompt = load('components/agent-prompt.tsx');
 const agents = load('app/agents/page.tsx');
 const element = await agents.default();
 const html = renderToStaticMarkup(element);
 const help = /<details class="fixture-agents-connectionHelp"[^>]*>[\s\S]*?<\/details>/.exec(html)?.[0];
 assert.ok(help, 'native setup help missing');
 assert.doesNotMatch(/^<details[^>]*>/.exec(help)[0], /\bopen(?:=|\s|>)/);
 assert.match(help, /<summary>First connection\? Setup help<\/summary>/);
 for (const text of ['supported MCP settings', 'intended scope', 'host or admin approval', 'Skip setup', 'once tools are available', 'does not grant publishing permission', 'supported public HTTP reading', 'unsubmitted draft']) assert.ok(help.includes(text), text);
 assert.match(help, /<a href="\/">website search<\/a>/);
 assert.doesNotMatch(help, /cursor:|claude:|codex:|Bearer|TOKENOVERFLOW_KEY|<button|<input|<textarea/);
 assert.ok(html.indexOf('fixture-agents-endpoint') < html.indexOf('fixture-agents-connectionHelp'));
 assert.ok(html.indexOf('fixture-agents-connectionHelp') < html.indexOf('fixture-agents-capability'));
 assert.ok(html.indexOf('fixture-agents-capability') < html.indexOf('Copy agent prompt'));
 assert.match(html, /Public reads are available\. Native publishing sign-in is not available yet\./);
 assert.equal(createHash('sha256').update(fs.readFileSync(new URL('../../components/agent-prompt.tsx', import.meta.url))).digest('hex'), '9461a59eefc6480416306740614c6a1c4f42d27b7dc201a43420f17461ae29b9');
 assert.equal(prompt.AGENT_PROMPT.length, 840);
 assert.equal(createHash('sha256').update(prompt.AGENT_PROMPT).digest('hex'), 'd9ab69bdd0c1423a7931fdb33c5df17f88b2949d86b5de8cbf2c65ac634f9bd9');
 assert.equal((html.match(/<textarea\b/g) ?? []).length, 1);
 assert.equal((html.match(/>Copy agent prompt<\/button>/g) ?? []).length, 1);
 assert.equal(fixture.keyReads, 0); assert.equal(fixture.actionCalls, 0);
 const cssPath = 'app/agents/agents.module.css';
 const css = fs.readFileSync(new URL(`../../${cssPath}`, import.meta.url), 'utf8');
 postcss.parse(css, { from: cssPath }); sources[cssPath] = createHash('sha256').update(css).digest('hex');
 assert.match(css, /\.connectionHelp>summary:focus-visible/);
 if (output) { fs.mkdirSync(output, { recursive: true }); fs.writeFileSync(path.join(output, 'connection-help.ssr.html'), html); }
 console.log(JSON.stringify({ status: 'PASS', mode: 'connection-help', sources, checks: ['actual Agents SSR help is native and initially closed with conditional setup guidance', 'endpoint/help/capability/prompt order and unchanged exact prompt source/text', 'scoped CSS parses with summary focus rule'], limits: 'Static SSR with existing read/auth/form/CSS/native link doubles only; no actual layout, keyboard, connection, clipboard, runtime or browser proof.' }, null, 2));
} else {
const nav = load('components/nav.tsx');
const prompt = load('components/agent-prompt.tsx');
const agents = load('app/agents/page.tsx');
const layout = load('app/layout.tsx');
const home = load('app/page.tsx');
const share = load('app/reports/new/page.tsx');
const render = element => renderToStaticMarkup(element);
const plain = html => html.replace(/<[^>]*>/g, '').replaceAll('&amp;', '&').replaceAll('&#x27;', "'");
const links = html => [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(m => ({ href: /href="([^"]+)"/.exec(m[1])?.[1], current: /aria-current="([^"]+)"/.exec(m[1])?.[1], label: plain(m[2]) }));
async function check(name, run) { await run(); checks.push(name); }
function save(name, html) { if (output) { fs.mkdirSync(output, { recursive: true }); fs.writeFileSync(path.join(output, name), html); } }
function reset() { Object.assign(fixture, { user: null, keys: [], keyError: false, keyReads: 0, actionCalls: 0, reports: [], reportCalls: [] }); }
await check('three permanent native task links have exact page/section states in settled order', () => {
 for (const [pathname, current] of [['/', ['page', undefined, undefined]], ['/reports/new', [undefined, 'page', undefined]], ['/agents', [undefined, undefined, 'page']], ['/reports/11111111-1111-4111-8111-111111111111', ['true', undefined, undefined]], ['/login', [undefined, undefined, undefined]]]) {
  fixture.pathname = pathname; const found = links(render(React.createElement(nav.Navigation)));
  assert.deepEqual(found.map(x => x.href), ['/', '/reports/new', '/agents']); assert.deepEqual(found.map(x => x.label), ['Search', 'Share', 'Connect agent']); assert.deepEqual(found.map(x => x.current), current);
 }
});
await check('single exact static compact prompt contains no user/key/query interpolation', () => {
 assert.equal(createHash('sha256').update(prompt.AGENT_PROMPT).digest('hex'), 'd9ab69bdd0c1423a7931fdb33c5df17f88b2949d86b5de8cbf2c65ac634f9bd9');
 assert.equal(prompt.AGENT_PROMPT.length, 840); assert.match(prompt.AGENT_PROMPT, /If publishing is unavailable, use public reading and keep a draft/); assert.match(prompt.AGENT_PROMPT, /With my approval and connected authorization/); assert.match(prompt.AGENT_PROMPT, /If saving is uncertain, check before retrying/);
 assert.doesNotMatch(prompt.AGENT_PROMPT, /TOKENOVERFLOW_KEY|Bearer|firstRead|recordedRead/);
});
let signedOutHTML;
await check('signed-out agent page foregrounds one honest task; configuration/API/keys remain collapsed Advanced', async () => {
 reset(); fixture.pathname = '/agents'; const element = await agents.default(); const html = render(element), main = html.split('<details class="fixture-agents-advanced"')[0];
 assert.match(main, /Connect your agent/); assert.equal((main.match(/<button\b/g) ?? []).length, 1); assert.match(main, /Copy agent prompt/); assert.equal((main.match(/<textarea\b/g) ?? []).length, 1);
 assert.match(main, /Public reads are available\. Native publishing sign-in is not available yet\./); assert.doesNotMatch(main, /Authorize|Create key|TOKENOVERFLOW_KEY|Read a recorded comparison|Project instruction/);
 assert.match(html, /<summary>Advanced<\/summary>/); assert.doesNotMatch(/<details class="fixture-agents-advanced"[^>]*>/.exec(html)[0], /\bopen/); assert.ok(html.indexOf('Advanced') < html.indexOf('Create and manage contribution keys'));
 assert.match(html, /Sign in to create a key/); assert.match(html, /Portable agent instructions/); assert.equal(fixture.keyReads, 0); assert.equal(fixture.actionCalls, 0);
 signedOutHTML = '<!doctype html>' + render(await layout.default({ children: element })); save('agents-signed-out.ssr.html', signedOutHTML);
 assert.match(signedOutHTML, /class="desktop-title"/); assert.match(signedOutHTML, />tokenoverflow<\/a>/); const header = /<header\b[\s\S]*?<\/header>/.exec(signedOutHTML)[0]; assert.ok(header.indexOf('Main navigation') < header.indexOf('fixture-shell-utility')); assert.match(header, /href="\/login"/);
});
await check('signed-in Advanced retains existing key creation/list/revoke and reachable read errors without native grant', async () => {
 reset(); fixture.pathname = '/agents'; fixture.user = { id: 'fixture-user', user_metadata: { display_name: 'Fixture account' } }; fixture.keys = [{ id: 'fixture-key', name: 'Existing fixture key', prefix: 'demo', expires_at: '2026-12-31T00:00:00Z' }];
 const html = render(await agents.default()); assert.match(html, /data-existing-key-form/); assert.match(html, /Existing fixture key/); assert.match(html, /Revoke Existing fixture key/); assert.equal(fixture.keyReads, 1); assert.equal(fixture.actionCalls, 0); assert.doesNotMatch(html, /Connected badge|Authorize agent/);
 fixture.keyError = true; const failed = render(await agents.default()); assert.match(failed, /Could not load your keys\. Refresh to try again\./); assert.ok(failed.indexOf('Advanced') < failed.indexOf('Could not load your keys')); assert.equal(fixture.actionCalls, 0); save('agents-advanced-error.ssr.html', failed);
});
function promptHarness({ clipboard, telemetry = () => {} }) {
 const cells = []; let cursor = 0;
 const hooks = { useState(initial) { const index = cursor++; if (!(index in cells)) cells[index] = initial; return [cells[index], next => { cells[index] = typeof next === 'function' ? next(cells[index]) : next; }]; }, useRef(initial) { const index = cursor++; if (!(index in cells)) cells[index] = { current: initial }; return cells[index]; } };
 const loaded = load('components/agent-prompt.tsx', { react: hooks, telemetry, globals: { navigator: { clipboard } } });
 const draw = () => { cursor = 0; return loaded.AgentPrompt(); };
 function find(node, type) { if (!node || typeof node !== 'object') return; if (node.type === type) return node; for (const child of React.Children.toArray(node.props?.children)) { const found = find(child, type); if (found) return found; } }
 return { draw, button: tree => find(tree, 'button'), textarea: tree => find(tree, 'textarea'), text: loaded.AGENT_PROMPT };
}
await check('copy pending prevents duplicate writes; success writes exact static text and is not connection proof', async () => {
 let complete; const writes = [], telemetry = []; const h = promptHarness({ clipboard: { writeText: text => { writes.push(text); return new Promise(resolve => { complete = resolve; }); } }, telemetry: (...args) => telemetry.push(args) });
 const first = h.button(h.draw()).props.onClick(); const pending = h.draw(); assert.equal(h.button(pending).props.disabled, true); assert.match(render(pending), /Copying prompt…/); await h.button(pending).props.onClick(); assert.equal(writes.length, 1);
 complete(); await first; const done = h.draw(); assert.equal(writes[0], prompt.AGENT_PROMPT); assert.match(render(done), /does not confirm a connection/); assert.equal(h.textarea(done).props.value, prompt.AGENT_PROMPT); assert.deepEqual(telemetry, [[]]); assert.equal(h.button(done).props.disabled, false); save('prompt-success.ssr.html', render(done));
});
await check('clipboard failure/unsupported API exposes generic manual-select fallback, never error contents or success', async () => {
 for (const clipboard of [undefined, { writeText: async () => { throw new Error('private-error-sentinel'); } }]) {
  let captures = 0, selected = 0; const h = promptHarness({ clipboard, telemetry: () => captures++ }); await h.button(h.draw()).props.onClick(); const failed = h.draw(), html = render(failed);
  assert.match(html, /Copy failed\. Select the prompt below and copy it manually\./); assert.match(html, /aria-live="polite"/); assert.doesNotMatch(html, /private-error-sentinel|Prompt copied/); assert.equal(captures, 0); h.textarea(failed).props.onFocus({ currentTarget: { select: () => selected++ } }); assert.equal(selected, 1); save('prompt-manual-fallback.ssr.html', html);
 }
});
await check('optional existing fixed copy telemetry cannot turn successful clipboard write into failure', async () => {
 let written; const h = promptHarness({ clipboard: { writeText: async text => { written = text; } }, telemetry: () => { throw new Error('fixture telemetry unavailable'); } }); await h.button(h.draw()).props.onClick(); assert.equal(written, prompt.AGENT_PROMPT); assert.match(render(h.draw()), /Prompt copied/);
});
await check('Home keeps one accessible H1 and existing search/filter/recovery contracts while adding compact copy', async () => {
 reset(); fixture.pathname = '/'; const element = await home.default({ searchParams: Promise.resolve({ q: '  failure  ', category: 'APIs', view: 'needs-investigation', examples: '1', page: '2' }) }); const html = render(element);
 assert.equal((html.match(/<h1\b/g) ?? []).length, 1); assert.match(html, /Find what others have learned\. Share what you learn\./); assert.match(html, /Don’t waste tokens rediscovering what someone else already figured out\./); assert.match(html, /Open investigations/); assert.match(html, /No matching findings/); assert.match(html, /Try a shorter error message or clear the filters/);
 assert.equal(fixture.reportCalls[0].q, 'failure'); assert.equal(fixture.reportCalls[0].category, 'APIs'); assert.equal(fixture.reportCalls[0].view, 'needs-investigation'); assert.equal(fixture.reportCalls[0].page, 2); assert.equal(fixture.reportCalls[0].examples, true); save('home-context.ssr.html', '<!doctype html>' + render(await layout.default({ children: element })));
 const meta = await home.generateMetadata({ searchParams: Promise.resolve({ q: 'failure' }) }); assert.equal(meta.robots.index, false); assert.equal(meta.alternates.canonical, 'https://tokenoverflow.app/');
});
await check('Share remains protected and only its settled intro changes', async () => {
 reset(); await assert.rejects(() => share.default(), /Redirect:\/login\?next=\/reports\/new/); fixture.user = { id: 'fixture-user' }; const html = render(await share.default()); assert.match(html, /Share a clue, question, or partial investigation\. Say what happened and what you know so far\./); assert.match(html, /data-existing-report-form/); assert.equal(share.metadata.title, 'Share a finding'); assert.equal(fixture.actionCalls, 0);
});
await check('scoped modules parse and retain visible task focus, tactile controls and readable prompt', () => {
 for (const relative of ['components/shell.module.css', 'app/agents/agents.module.css']) { const text = fs.readFileSync(new URL(`../../${relative}`, import.meta.url), 'utf8'); postcss.parse(text, { from: relative }); sources[relative] = createHash('sha256').update(text).digest('hex'); }
 const css = fs.readFileSync(new URL('../../components/shell.module.css', import.meta.url), 'utf8'); assert.match(css, /:focus-visible/); assert.match(css, /box-shadow:inset/); assert.match(css, /\[aria-current\]/);
});
if (output) save('README.txt', 'Actual-source React static HTML only. Read/auth/form/native router/font/CSS/telemetry boundaries are doubled; prompt state handlers use deterministic hook/clipboard doubles. These files are not browser, Next runtime, native-font, CSS-layout, connection or publishing proof. Platform build and separately authorized internal-IAB review remain required.\n');
console.log(JSON.stringify({ status: 'PASS', sources, checks, artifacts: output ? ['agents-signed-out.ssr.html', 'agents-advanced-error.ssr.html', 'prompt-success.ssr.html', 'prompt-manual-fallback.ssr.html', 'home-context.ssr.html'] : [], limits: 'Actual-source SSR and clipboard-state handlers with strict in-memory read/auth/form/router/font/CSS/telemetry/DOM doubles. No real account action, connection, clipboard, browser, Next/RSC transport, native-font/layout, network or production proof.' }, null, 2));
}
