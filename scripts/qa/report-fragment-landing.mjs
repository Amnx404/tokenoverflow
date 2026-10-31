// Content-only actual controller/hook job with focused DOM and single-frame doubles.
// No browser/server/network, loading ticket, timers, observer, or copied implementation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../../components/report-fragment-landing.tsx', import.meta.url), 'utf8');
const effects = [], loaded = { exports: {} };
const context = { URL, module: loaded, exports: loaded.exports, require: name => {
 if (name === 'react') return { useEffect: effect => effects.push(effect) };
 throw new Error(`Unexpected helper import: ${name}`);
} };
const code = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
assert.equal(code.diagnostics?.filter(x => x.category === ts.DiagnosticCategory.Error).length, 0);
vm.runInNewContext(code.outputText, context);
const { createReportFragmentLandingController: createJob, ReportFragmentLanding } = loaded.exports;
const fix = 'fix-11111111-1111-4111-8111-111111111111', result = 'verification-22222222-2222-4222-8222-222222222222';
const inputs = ['wheel', 'touchstart', 'pointerdown', 'keydown', 'scroll', 'hashchange', 'popstate', 'pagehide'];
const checks = [];
function check(name, run) { run(); checks.push(name); }
function fixture({ id = fix, type = 'navigate', hash = `#${id}`, visibility = 'visible' } = {}) {
 const listeners = { window: new Map(), document: new Map() }, frames = new Map(), callbacks = [], cancelled = [], scrolls = [];
 let url = 'https://fixture.invalid/reports/33333333-3333-4333-8333-333333333333?scope=1' + hash, nav = { type, name: url }, x = 0, y = 0, height = 800, top = 1200, bottom = 1500, currentDoc, frameCount = 0, geometryCalls = 0, lookupHook, geometryHook, hashOverride;
 const count = () => Object.values(listeners).reduce((total, map) => total + [...map.values()].reduce((n, set) => n + set.size, 0), 0);
 function events(where) { return {
  addEventListener(name, listener, options) { assert.equal(options.capture, true); assert.equal(options.passive, true); const set = listeners[where].get(name) ?? new Set(); assert.equal(set.has(listener), false); set.add(listener); listeners[where].set(name, set); },
  removeEventListener(name, listener, capture) { assert.equal(capture, true); const set = listeners[where].get(name); assert.ok(set?.has(listener), 'remove each listener once'); set.delete(listener); },
 }; }
 const nodes = new Map();
 const doc = { ...events('document'), get visibilityState() { return visibility; }, getElementById(id) { const value = nodes.get(id) ?? null; lookupHook?.(); return value; } };
 currentDoc = doc;
 const node = { id, ownerDocument: doc, isConnected: true, getBoundingClientRect() { geometryCalls++; geometryHook?.(); return { top, bottom }; }, focus() { throw new Error('Focus forbidden'); }, scrollIntoView(options) { assert.equal(count(), 0); assert.equal(options.behavior, 'instant'); assert.equal(options.block, 'start'); assert.equal(options.inline, 'nearest'); scrolls.push({ ...options }); } };
 nodes.set(id, node);
 const requestFrame = callback => { const id = ++frameCount; frames.set(id, callback); callbacks.push(callback); return id; };
 const cancelFrame = id => { assert.ok(frames.has(id)); frames.delete(id); cancelled.push(id); };
 const env = { document: doc, currentDocument: () => currentDoc, href: () => url, hash: () => hashOverride ?? new URL(url).hash, navigation: () => nav, position: () => ({ x, y }), viewportHeight: () => height, events: events('window'), requestFrame, cancelFrame };
 const job = createJob(env);
 const flush = () => { const next = frames.entries().next().value; if (next) { frames.delete(next[0]); next[1](); } };
 const f = { job, doc, node, nodes, frames, callbacks, cancelled, scrolls, count, flush, emit: (name, where = 'window') => { for (const callback of [...(listeners[where].get(name) ?? [])]) callback(); }, get requested() { return frameCount; }, get geometryCalls() { return geometryCalls; }, set url(value) { url = value; }, get url() { return url; }, set nav(value) { nav = value; }, set currentDoc(value) { currentDoc = value; }, set visibility(value) { visibility = value; }, set position(value) { ({ x, y } = value); }, set rect(value) { ({ top, bottom } = value); }, set height(value) { height = value; }, set geometryHook(value) { geometryHook = value; }, set lookupHook(value) { lookupHook = value; }, set hashOverride(value) { hashOverride = value; } };
 f.window = { document: doc, location: { get href() { return url; }, get hash() { return new URL(url).hash; } }, performance: { getEntriesByType: () => nav ? [nav] : [] }, get scrollX() { return x; }, get scrollY() { return y; }, get innerHeight() { return height; }, ...events('window'), requestAnimationFrame: requestFrame, cancelAnimationFrame: cancelFrame };
 return f;
}
check('direct committed content schedules one frame for navigate/reload exact known fix/result, then consumes before instant scroll', () => {
 for (const type of ['navigate', 'reload']) for (const id of [fix, result]) { const f = fixture({ type, id }); f.job.commit([id]); assert.equal(f.requested, 1); assert.equal(f.count(), 9); assert.equal(f.scrolls.length, 0); f.flush(); assert.equal(f.scrolls.length, 1); assert.equal(f.count(), 0); f.job.commit([id]); f.flush(); assert.equal(f.requested, 1); assert.equal(f.scrolls.length, 1); }
});
check('actual hook repeated-setup double reuses one pending document job and snapshots first server IDs', () => {
 const f = fixture(); context.window = f.window; const ids = [fix]; ReportFragmentLanding({ knownIds: ids }); assert.equal(effects.shift()(), undefined); ids.splice(0, 1, result); ReportFragmentLanding({ knownIds: [result] }); assert.equal(effects.shift()(), undefined); assert.equal(f.requested, 1); f.flush(); assert.equal(f.scrolls.length, 1); ReportFragmentLanding({ knownIds: [fix] }); effects.shift()(); assert.equal(f.requested, 1);
 const empty = fixture(); empty.job.commit([]); empty.job.commit([fix]); assert.equal(empty.requested, 0);
});
check('observed input/history/pagehide and actual document visibility cancel/remove before the frame; hidden-start never rearms', () => {
 for (const event of [...inputs, 'visibilitychange']) { const f = fixture(); f.job.commit([fix]); f.emit(event, event === 'visibilitychange' ? 'document' : 'window'); assert.equal(f.count(), 0); assert.equal(f.cancelled.length, 1); f.callbacks[0](); f.job.commit([fix]); assert.equal(f.requested, 1); assert.equal(f.scrolls.length, 0); }
 const hidden = fixture({ visibility: 'hidden' }); hidden.job.commit([fix]); hidden.visibility = 'visible'; hidden.job.commit([fix]); assert.equal(hidden.requested, 0);
 const changed = fixture(); changed.job.commit([fix]); changed.visibility = 'hidden'; changed.flush(); assert.equal(changed.scrolls.length, 0); assert.equal(changed.count(), 0);
});
check('missing/malformed/nonliteral or unallowlisted hashes and ineligible initial navigation terminally decline', () => {
 for (const hash of ['', '#other', `#FIX-${fix.slice(4)}`, `#${fix}%20`, '#fix-%31' + fix.slice(5), `#${fix}/extra`]) { const f = fixture({ hash }); f.job.commit([fix]); f.url = f.url.split('#')[0] + '#' + fix; f.nav = { type: 'navigate', name: f.url }; f.job.commit([fix]); assert.equal(f.requested, 0); }
 for (const type of ['back_forward', 'prerender']) { const f = fixture({ type }); f.job.commit([fix]); assert.equal(f.requested, 0); }
 for (const mismatch of ['origin', 'path', 'search', 'absent', 'malformed']) { const f = fixture(); f.nav = mismatch === 'absent' ? undefined : { type: 'navigate', name: mismatch === 'malformed' ? 'invalid' : mismatch === 'origin' ? f.url.replace('fixture.invalid', 'other.invalid') : mismatch === 'path' ? f.url.replace('/reports/', '/other/') : f.url.replace('scope=1', 'scope=2') }; f.job.commit([fix]); assert.equal(f.requested, 0); }
 const raw = fixture(); raw.hashOverride = '#encoded'; raw.job.commit([fix]); assert.equal(raw.requested, 0); const unknown = fixture(); unknown.job.commit([result]); assert.equal(unknown.requested, 0);
});
check('native visible/part-visible target or nonzero scroll restoration declines with no later rearm', () => {
 for (const rect of [{ top: 0, bottom: 300 }, { top: -50, bottom: 20 }, { top: 799, bottom: 1000 }, { top: NaN, bottom: 1500 }, { top: 0, bottom: 0 }]) { const f = fixture(); f.rect = rect; f.job.commit([fix]); f.flush(); f.rect = { top: 1200, bottom: 1500 }; f.job.commit([fix]); assert.equal(f.scrolls.length, 0); assert.equal(f.count(), 0); assert.equal(f.requested, 1); }
 for (const position of [{ x: 1, y: 0 }, { x: 0, y: 500 }]) { const f = fixture(); f.job.commit([fix]); f.position = position; f.flush(); f.position = { x: 0, y: 0 }; f.job.commit([fix]); assert.equal(f.scrolls.length, 0); assert.equal(f.requested, 1); }
});
check('missing/disconnected/foreign or replaced targets are terminal; no target insertion retry', () => {
 for (const change of [f => f.nodes.clear(), f => { f.node.isConnected = false; }, f => { f.node.ownerDocument = {}; }, f => { f.node.id = result; }]) { const f = fixture(); f.job.commit([fix]); change(f); f.flush(); f.nodes.set(fix, f.node); f.node.id = fix; f.node.isConnected = true; f.node.ownerDocument = f.doc; f.job.commit([fix]); assert.equal(f.scrolls.length, 0); assert.equal(f.count(), 0); assert.equal(f.requested, 1); }
 const replaced = fixture(); replaced.job.commit([fix]); replaced.geometryHook = () => replaced.nodes.set(fix, { ...replaced.node }); replaced.flush(); assert.equal(replaced.scrolls.length, 0); assert.equal(replaced.count(), 0);
});
check('the sole callback rechecks actual document, URL, visibility, position and same connected target around geometry', () => {
 for (const change of [f => { f.currentDoc = {}; }, f => { f.url = f.url.replace('/reports/', '/other/'); }, f => { f.url = f.url.replace('scope=1', 'scope=2'); }, f => { f.url = f.url.split('#')[0] + '#' + result; }, f => { f.visibility = 'hidden'; }, f => { f.nav = { type: 'back_forward', name: f.url }; }]) { const f = fixture(); f.job.commit([fix]); change(f); f.flush(); assert.equal(f.scrolls.length, 0); assert.equal(f.count(), 0); }
 for (const change of [f => { f.position = { x: 0, y: 5 }; }, f => { f.node.id = result; }, f => { f.node.isConnected = false; }, f => { f.currentDoc = {}; }, f => f.emit('scroll')]) { const f = fixture(); f.job.commit([fix]); f.geometryHook = () => change(f); f.flush(); assert.equal(f.scrolls.length, 0); assert.equal(f.count(), 0); }
});
check('helper is after serialized target section and has no early loading/timer/observer framework', () => {
 const detail = fs.readFileSync(new URL('../../app/reports/[id]/page.tsx', import.meta.url), 'utf8'); assert.ok(detail.indexOf('<ReportFragmentLanding') > detail.indexOf('id={`verification-${v.id}`}')); assert.match(detail, /<\/section><ReportFragmentLanding knownIds=\{fixes\.flatMap/); assert.match(detail, /`fix-\$\{f\.id\}`/); assert.match(detail, /`verification-\$\{v\.id\}`/);
 assert.doesNotMatch(source, /useLayoutEffect|queueMicrotask|setTimeout|setInterval|MutationObserver|ResizeObserver|LoadingGuard/); assert.equal(fs.existsSync(new URL('../../app/reports/[id]/loading.tsx', import.meta.url)), false);
});
console.log(JSON.stringify({ status: 'PASS', source_sha256: createHash('sha256').update(source).digest('hex'), checks, limits: 'Actual content controller and hook setup with DOM/effect/rAF doubles only. Placement after serialized markup improves opportunity, not timing proof. Pre-init gestures/history and ordering versus native fragment completion in rAF are unguaranteed. No browser/React streaming/restoration proof, retries, polling, observers, focus or timers.' }, null, 2));
