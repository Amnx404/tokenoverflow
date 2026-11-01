// Pure actual-component SSR and explicit mocked-hook/presentation-state units.
// No browser/DOM/hydration, server, API/Auth, network or database.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const root = new URL('../../', import.meta.url);
const sources = {};
let sequence = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;
function modules(react = require('react')) {
 const cache = new Map();
 function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const source = fs.readFileSync(new URL(file, root), 'utf8');
  sources[file] = createHash('sha256').update(source).digest('hex');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const testModule = { exports: {} }; cache.set(file, testModule);
  vm.runInNewContext(code, { URL, TextEncoder, crypto: { randomUUID: uuid }, module: testModule, exports: testModule.exports, require: name => {
   if (name === 'react') return react;
   if (name === 'react/jsx-runtime') return require(name);
   if (name.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_target, key) => `fixture-${String(key)}` }) };
   if (name.startsWith('.')) {
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), name));
    return load(fs.existsSync(new URL(`${target}.tsx`, root)) ? `${target}.tsx` : `${target}.ts`);
   }
   throw new Error(`Unexpected presentation import: ${name}`);
  } });
  return testModule.exports;
 }
 return load;
}
const load = modules();
const { DiscussionThread } = load('components/discussion/thread.tsx');
const { DiscussionComment } = load('components/discussion/comment.tsx');
const { DiscussionComposer, ComposerSession } = load('components/discussion/composer.tsx');
const { bodyProblem, commentHref, validPage } = load('components/discussion/types.ts');
const render = (Component, props) => renderToStaticMarkup(createElement(Component, props));
const ctx = { reportId: 'report-one', parentId: null };
const comment = (id = 'c1', extra = {}) => ({ id, reportId: ctx.reportId, parentId: null, depth: 0, authorName: 'Same display name', createdAt: '2026-10-31T01:00:00Z', replyCount: 0, canRedact: false, state: 'visible', body: 'Question or partial attempt', ...extra });
const page = (children = [], extra = {}) => ({ ...ctx, ancestors: [], children, hasMore: false, ...extra });
const checks = [];
const compactOnly = process.argv.includes('--compact-metadata');
const compactCheck = 'compact UTC metadata, exact native details and concise page-local copy preserve handlers';
function check(name, run) { if (compactOnly) return; run(); checks.push(name); }
async function asyncCheck(name, run) { if (compactOnly && name !== compactCheck) return; await run(); checks.push(name); }
const text = node => node == null || typeof node === 'boolean' ? '' : typeof node === 'string' || typeof node === 'number' ? String(node) : Array.isArray(node) ? node.map(text).join('') : text(node.props?.children);
function all(node, predicate, output = []) {
 if (Array.isArray(node)) { node.forEach(item => all(item, predicate, output)); return output; }
 if (!node || typeof node !== 'object') return output;
 if (predicate(node)) output.push(node);
 all(node.props?.children, predicate, output); return output;
}
const button = (tree, label) => all(tree, node => node.type === 'button' && text(node) === label)[0];
function hooks(file, name) {
 let cursor = 0; const slots = [];
 const mock = { useState(initial) {
  const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
  return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
 }, useRef(initial) { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index]; }, useId() { const index = cursor++; return `mock-id-${index}`; }, useEffect(effect) { effect(); } };
 const Component = modules(mock)(file)[name];
 return props => { cursor = 0; return Component(props); };
}
check('actual SSR root, signed-out, default read-only and available composer states', () => {
 const empty = render(DiscussionThread, { page: page() });
 assert.match(empty, /Ask a question or add what you tried\./);
 assert.match(empty, /Comment creation is unavailable here/);
 assert.doesNotMatch(empty, /Worked|Failed|evidence_bundle|verification_count/);
 assert.match(render(DiscussionThread, { page: page(), capability: 'signed-out' }), /Sign in to comment/);
 const available = render(DiscussionComposer, { ...ctx, capability: 'can-comment', onCreate: async () => ({ status: 'unknown' }) });
 assert.match(available, /Comments are public/); assert.match(available, /<label for=/);
 assert.doesNotMatch(available, /<button type="submit" disabled/);
 assert.match(render(DiscussionComposer, { ...ctx, capability: 'can-comment' }), /Comment creation is unavailable here/);
});
check('actual SSR full escaped body, safe links and exact same-report permalink validation', () => {
 const body = '<script>unsafe()</script>\nhttps://example.test/a?x=1&y=%2F javascript:https://bad.test/';
 const html = render(DiscussionComment, { comment: comment('c1', { body, permalink: '/reports/report-one#comment-c1' }) });
 assert.match(html, /&lt;script&gt;unsafe\(\)&lt;\/script&gt;/); assert.doesNotMatch(html, /<script/);
 assert.match(html, /href="https:\/\/example.test\/a\?x=1&amp;y=%2F"/);
 assert.doesNotMatch(html, /href="https:\/\/bad.test/);
 assert.match(html, /href="\/reports\/report-one#comment-c1"/);
 assert.equal(commentHref('report-one', 'c1', '/reports/report-one?comment=c1#comment-c1'), '/reports/report-one?comment=c1#comment-c1');
 assert.equal(commentHref('report-one', 'c1', '/reports/report-one?comment=c1&extra=1#comment-c1'), undefined);
 for (const href of ['https://evil.test/reports/report-one#comment-c1', '//evil.test/', '/reports/other#comment-c1', '/reports/report-one#comment-other', '/reports/report-one?x=1#comment-c1']) assert.equal(commentHref('report-one', 'c1', href), undefined);
});
check('actual SSR unknown/redacted parent context, selected unloaded target and supplied focus context', () => {
 const a = comment('root', { state: 'redacted' }); delete a.body;
 const b = comment('parent', { depth: 1, parentId: 'root', state: 'unavailable' }); delete b.body;
 const target = comment('deep', { depth: 2, parentId: 'parent', body: 'Specific deep question' });
 const focused = render(DiscussionThread, { page: page(), selectedContext: { state: 'loaded', target, ancestors: [a, b] } });
 assert.match(focused, /Comment removed/); assert.match(focused, /Parent context unavailable/);
 assert.match(focused, /Specific deep question/); assert.match(focused, /Selected comment context is supplied/);
 assert.match(focused, /Parent <code>parent<\/code>/);
 const missing = render(DiscussionThread, { page: page(), selectedContext: { state: 'not-loaded', reportId: ctx.reportId, id: 'deep' } });
 assert.match(missing, /Selected comment is not loaded/); assert.doesNotMatch(missing, /Specific deep question/);
 assert.match(render(DiscussionThread, { page: page(), selectedContext: { state: 'loaded', target, ancestors: [b] } }), /supplied context is unavailable/);
});
check('actual SSR bounded chronological children, partial continuation and no silent reparenting', () => {
 const html = render(DiscussionThread, { page: page([comment('first'), comment('second', { createdAt: '2026-10-31T02:00:00Z' })], { hasMore: true, nextCursor: 'opaque' }) });
 assert.ok(html.indexOf('comment-first') < html.indexOf('comment-second'));
 assert.match(html, /More comments available/); assert.match(html, /Continuation unavailable/);
 assert.equal(validPage(page(Array.from({ length: 21 }, (_, index) => comment(`c${index}`)))), false);
 assert.equal(validPage(page(Array.from({ length: 50 }, (_, index) => comment(`c${index}`)), { limit: 50 })), true);
 assert.equal(validPage(page([], { limit: 51 })), false);
 assert.equal(validPage(page([comment('wrong', { parentId: 'missing' })])), false);
});
check('actual supplied selected context keeps root continuation and avoids duplicate comment IDs', () => {
 const ancestor = comment('root', { replyCount: 1 });
 const target = comment('deep', { parentId: 'root', depth: 1 });
 const html = render(DiscussionThread, { page: page([ancestor], { hasMore: true, nextCursor: 'root-cursor' }), selectedContext: { state: 'loaded', target, ancestors: [ancestor] }, onRequestPage() {} });
 assert.match(html, /Load more comments/); assert.match(html, /data-depth="1"/);
 const ids = [...html.matchAll(/id="(comment-[^"]+)"/g)].map(match => match[1]);
 assert.deepEqual(ids.sort(), ['comment-deep', 'comment-root']);
 assert.match(html, /Collapse replies/);
});
check('actual first-page reply and continuation handlers only request the exact supplied target/cursor', () => {
 let requested;
 const draw = hooks('components/discussion/comment.tsx', 'DiscussionComment');
 const tree = draw({ comment: comment('parent', { replyCount: 2 }), onRequestPage: value => { requested = value; } });
 button(tree, 'Load replies').props.onClick();
 assert.equal(requested.reportId, ctx.reportId); assert.equal(requested.parentId, 'parent'); assert.equal(requested.cursor, null);
});
check('actual Thread and composer mocked hooks retain active target/draft when a supplied confirmed tombstone disables reply', () => {
 const thread = hooks('components/discussion/thread.tsx', 'DiscussionThread');
 const composer = hooks('components/discussion/composer.tsx', 'DiscussionComposer');
 const parent = comment('parent', { canRedact: true });
 const props = { page: page([parent]), capability: 'can-comment', onCreate: async () => ({ status: 'unknown' }) };
 let tree = thread(props);
 const branch = all(tree, node => typeof node.type === 'function' && node.type.name === 'Branch')[0];
 branch.props.onReply(parent); tree = thread(props);
 let composerProps = all(tree, node => typeof node.type === 'function' && node.type.name === 'DiscussionComposer')[0].props;
 let form = composer(composerProps);
 all(form, node => node.type === 'textarea')[0].props.onChange({ currentTarget: { value: 'reply draft retained' } });
 const tombstone = { ...parent, state: 'redacted', canRedact: false }; delete tombstone.body;
 all(tree, node => typeof node.type === 'function' && node.type.name === 'Branch')[0].props.onPresentationRedact(tombstone);
 tree = thread(props);
 composerProps = all(tree, node => typeof node.type === 'function' && node.type.name === 'DiscussionComposer')[0].props;
 assert.equal(composerProps.parentId, 'parent'); assert.equal(composerProps.capability, 'read-only');
 form = composer(composerProps); assert.equal(all(form, node => node.type === 'textarea')[0].props.value, 'reply draft retained');
 assert.match(text(tree), /no root fallback was made/);
});
check('actual nested depth-eight SSR keeps total indentation on content blocks only', () => {
 const nodes = Array.from({ length: 9 }, (_, depth) => comment(`depth${depth}`, { depth, parentId: depth ? `depth${depth - 1}` : null, replyCount: depth < 8 ? 1 : 0 }));
 let nested = nodes[8];
 for (let depth = 7; depth >= 0; depth--) nested = { ...nodes[depth], replies: page([nested], { parentId: nodes[depth].id, ancestors: nodes.slice(0, depth + 1) }) };
 const html = render(DiscussionThread, { page: page([nested]), capability: 'can-comment' });
 assert.match(html, /data-indent="3" data-depth="8"/); assert.match(html, /Reply depth limit reached/);
 const stack = []; let contentCount = 0;
 for (const match of html.matchAll(/<(\/?)([a-z0-9]+)\b([^>]*)>/gi)) {
  if (match[1]) { while (stack.length && stack.pop().name !== match[2]) { /* HTML stack for this known SSR output. */ } continue; }
  if (/\bdata-indent=/.test(match[3])) { contentCount++; assert.ok(!stack.some(item => /\bdata-indent=/.test(item.attributes)), 'indent content contains another indent block'); }
  if (!['input', 'br', 'hr', 'meta', 'link'].includes(match[2])) stack.push({ name: match[2], attributes: match[3] });
 }
 assert.equal(contentCount, 9);
 const css = fs.readFileSync(new URL('components/discussion/discussion.module.css', root), 'utf8');
 assert.match(css, /\.list\{list-style:none;margin:0;padding:0\}/);
 assert.match(css, /\.content\[data-indent="3"\]\{margin-inline-start:3rem\}/);
});
check('same display names confer no ownership; create unavailability does not remove supplied own-redaction control', () => {
 const html = render(DiscussionThread, { page: page([comment('not-own'), comment('own', { canRedact: true })]), capability: 'read-only', onRedact: async () => ({ status: 'unknown' }) });
 assert.equal(html.match(/Remove my comment/g)?.length, 1);
 assert.match(html, /Comment creation is unavailable/);
});
check('unknown reply totals do not become zero; tombstones show neutral author and retain first-page read access', () => {
 const unknown = comment('unknown'); delete unknown.replyCount;
 const html = render(DiscussionComment, { comment: unknown, onRequestPage() {} });
 assert.match(html, /Reply total unknown/); assert.match(html, /Load replies/); assert.doesNotMatch(html, /0 known replies/);
 const removed = { ...unknown, state: 'redacted', authorName: 'stale private display name' }; delete removed.body;
 const redacted = render(DiscussionComment, { comment: removed, onRequestPage() {} });
 assert.match(redacted, /Removed comment/); assert.match(redacted, /Load replies/); assert.doesNotMatch(redacted, /stale private display name/);
});
check('body UI bounds count Unicode codepoints and UTF-8 bytes without claiming backend enforcement', () => {
 assert.equal(bodyProblem(' \n\t'), true); assert.equal(bodyProblem('😀'.repeat(2000)), false);
 assert.equal(bodyProblem('😀'.repeat(2001)), true); assert.equal(bodyProblem('a'.repeat(2001)), true);
 assert.equal(bodyProblem('\u0085'), true); assert.equal(bodyProblem('\uD800'), true); assert.equal(bodyProblem('a\0b'), true);
 assert.equal(bodyProblem(` ${'a'.repeat(1999)} `), true); assert.equal(bodyProblem('\n  code();\n'), false);
});
await asyncCheck('actual ComposerSession rejected draft/parent/request retained until explicit new correction', async () => {
 let ids = 0; const model = new ComposerSession(() => { ids++; return `request-${ids}`; });
 const target = { ...ctx, parentId: 'same-author-parent' };
 model.edit(target, '  partial clue\n'); const sent = [];
 await model.submit(target, async payload => { sent.push(payload); return { status: 'rejected', error: 'rate-limited', retryAfter: 12 }; });
 assert.equal(model.view(target).body, '  partial clue\n'); assert.equal(model.view(target).attempt.parentId, 'same-author-parent');
 assert.equal(model.view(target).rejection.retryAfter, 12);
 model.edit(target, 'silently changed'); assert.equal(model.view(target).body, '  partial clue\n');
 model.correct(target); model.edit(target, 'corrected clue');
 await model.submit(target, async payload => { sent.push(payload); return { status: 'unknown' }; });
 assert.equal(ids, 2); assert.notEqual(sent[0].requestId, sent[1].requestId);
 assert.equal(sent[0].body, '  partial clue\n'); assert.equal(sent[1].parentId, target.parentId);
});
await asyncCheck('actual ComposerSession pending synchronous duplicate guard and late old-context completion', async () => {
 const model = new ComposerSession(uuid); let finish; let calls = 0;
 model.edit(ctx, 'old report draft'); const callback = payload => { calls++; assert.ok(Object.isFrozen(payload)); return new Promise(resolve => { finish = resolve; }); };
 const first = model.submit(ctx, callback); await model.submit(ctx, callback); assert.equal(calls, 1);
 model.edit(ctx, 'cannot overwrite pending'); assert.equal(model.view(ctx).body, 'old report draft');
 const newer = { reportId: 'report-two', parentId: 'new-parent' }; model.edit(newer, 'new report draft');
 finish({ status: 'saved', id: 'saved-old', ...ctx }); await first;
 assert.equal(model.view(ctx).body, ''); assert.equal(model.view(newer).body, 'new report draft');
 assert.equal(model.view(newer).receipt, undefined);
});
await asyncCheck('actual ComposerSession unknown retry keeps exact UUID/payload; known saved ID survives unavailable link', async () => {
 let ids = 0; const model = new ComposerSession(() => `request-${++ids}`); const payloads = [];
 model.edit(ctx, 'not a performed test');
 await model.submit(ctx, async payload => { payloads.push(payload); return { status: 'unknown' }; });
 model.edit(ctx, 'cannot change unknown'); model.correct(ctx);
 await model.submit(ctx, async payload => { payloads.push(payload); return { status: 'saved', ...ctx, id: 'saved-real', permalink: 'https://evil.test/' }; });
 assert.equal(ids, 1); assert.equal(payloads[0], payloads[1]);
 assert.equal(model.view(ctx).receipt.id, 'saved-real'); assert.equal(model.view(ctx).receipt.permalink, undefined);
 assert.equal(model.view(ctx).body, ''); assert.equal(payloads.length, 2);
 const malformed = new ComposerSession(uuid); malformed.edit(ctx, 'retained');
 await malformed.submit(ctx, async () => ({ status: 'saved', ...ctx })); assert.equal(malformed.view(ctx).status, 'unknown'); assert.equal(malformed.view(ctx).body, 'retained');
 const noCallback = new ComposerSession(() => { throw new Error('must not generate'); }); noCallback.edit(ctx, 'retained'); await noCallback.submit(ctx); assert.equal(noCallback.view(ctx).status, 'editing');
});
await asyncCheck('actual composer handlers with mocked hooks keep newer context draft and never show old receipt there', async () => {
 const draw = hooks('components/discussion/composer.tsx', 'DiscussionComposer'); let finish; let calls = 0;
 const props = { ...ctx, capability: 'can-comment', onCreate: () => { calls++; return new Promise(resolve => { finish = resolve; }); } };
 let tree = draw(props); all(tree, node => node.type === 'textarea')[0].props.onChange({ currentTarget: { value: 'first draft' } });
 tree = draw(props); const first = tree.props.onSubmit({ preventDefault() {} }); const duplicate = tree.props.onSubmit({ preventDefault() {} }); assert.equal(calls, 1);
 const next = { ...props, reportId: 'report-two', parentId: 'new-parent' };
 tree = draw(next); all(tree, node => node.type === 'textarea')[0].props.onChange({ currentTarget: { value: 'newer draft' } });
 finish({ status: 'saved', ...ctx, id: 'saved-old' }); await first; await duplicate;
 tree = draw(next); assert.equal(all(tree, node => node.type === 'textarea')[0].props.value, 'newer draft'); assert.doesNotMatch(text(tree), /saved-old/);
 tree = draw(props); assert.match(text(tree), /saved-old/); assert.match(text(tree), /link unavailable/);
});
check('actual collapse handler with mocked hooks retains parent, moves focus to trigger and reversibly hides descendants', () => {
 const draw = hooks('components/discussion/comment.tsx', 'DiscussionComment');
 const props = { comment: comment('parent', { replyCount: 1 }), children: createElement('p', {}, 'child retained') };
 let focus = 0; let tree = draw(props);
 button(tree, 'Collapse replies (1 known)').props.onClick({ currentTarget: { focus() { focus++; } } });
 tree = draw(props); assert.equal(focus, 1); assert.ok(all(tree, node => node.props?.hidden === true).length);
 assert.match(renderToStaticMarkup(tree), /Question or partial attempt/);
 button(tree, 'Show replies (1 known)').props.onClick({ currentTarget: { focus() { focus++; } } });
 tree = draw(props); assert.equal(focus, 1); assert.ok(!all(tree, node => node.props?.hidden === true).length);
});
check('selected path expands initially but actual collapse handler honors the same selection and new selection reopens it', () => {
 const draw = hooks('components/discussion/comment.tsx', 'DiscussionComment');
 const props = { comment: comment('parent', { replyCount: 2 }), selectionIdentity: 'report-one:target-one', children: createElement('ol', {}, createElement('li', {}, 'first retained child'), createElement('li', {}, 'selected target text')) };
 let focus = 0; let tree = draw(props);
 const original = renderToStaticMarkup(tree);
 let trigger = button(tree, 'Collapse replies (2 known)'); assert.equal(trigger.props['aria-expanded'], true); assert.ok(!trigger.props.disabled);
 trigger.props.onClick({ currentTarget: { focus() { focus++; } } });
 tree = draw(props); trigger = button(tree, 'Show replies (2 known)');
 assert.equal(trigger.props['aria-expanded'], false); assert.equal(focus, 1);
 assert.ok(all(tree, node => node.props?.hidden === true).some(node => text(node).includes('selected target text')));
 assert.match(renderToStaticMarkup(tree), /first retained child.*selected target text/);
 trigger.props.onClick({ currentTarget: { focus() { focus++; } } });
 tree = draw(props); assert.equal(renderToStaticMarkup(tree), original);
 button(tree, 'Collapse replies (2 known)').props.onClick({ currentTarget: { focus() { focus++; } } });
 tree = draw({ ...props, selectionIdentity: 'report-one:target-two' });
 assert.equal(button(tree, 'Collapse replies (2 known)').props['aria-expanded'], true);
 tree = draw(props); assert.equal(button(tree, 'Collapse replies (2 known)').props['aria-expanded'], true);
});
await asyncCheck('actual redaction handlers with mocked hooks preserve authoritative body on failure and descendants on supplied tombstone', async () => {
 const draw = hooks('components/discussion/comment.tsx', 'DiscussionComment'); let finish; let calls = 0;
 const original = comment('own', { canRedact: true, replyCount: 1 });
 const props = { comment: original, children: createElement('p', {}, 'descendant stays'), onRedact: () => { calls++; return new Promise(resolve => { finish = resolve; }); } };
 let tree = draw(props); button(tree, 'Remove my comment').props.onClick(); tree = draw(props);
 let attempt = button(tree, 'Confirm removal').props.onClick(); const duplicate = button(tree, 'Confirm removal').props.onClick(); assert.equal(calls, 1);
 finish({ status: 'rejected', error: 'not-allowed' }); await attempt; await duplicate;
 tree = draw(props); assert.match(renderToStaticMarkup(tree), /Question or partial attempt/);
 attempt = button(tree, 'Confirm removal').props.onClick();
 const tombstone = { ...original, state: 'redacted', canRedact: false }; delete tombstone.body;
 finish({ status: 'redacted', comment: tombstone }); await attempt; tree = draw(props);
 const html = renderToStaticMarkup(tree); assert.match(html, /Comment removed/); assert.match(html, /descendant stays/);
 assert.match(html, /id="comment-own"/); assert.doesNotMatch(html, /Question or partial attempt|>Reply<\/button>/);
});
if (compactOnly) await asyncCheck(compactCheck, async () => {
 const output = process.env.DISCUSSION_UI_EVIDENCE_DIR, baseline = process.env.DISCUSSION_UI_BASELINE_DIR;
 assert.ok(output && baseline, 'Set private evidence and PR20 baseline directories for this focused mode');
 fs.mkdirSync(output, { recursive: true });
 const save = (name, html) => fs.writeFileSync(path.join(output, `${name}.static.html`), html);
 const exactTime = '2026-10-31T22:18:44.123456Z';
 const rootComment = comment('root-id', { createdAt: exactTime, replyCount: undefined, permalink: '/reports/report-one?comment=root-id#comment-root-id', body: '<raw> partial clue\nhttps://example.test/source' });
 const rootHtml = render(DiscussionComment, { comment: rootComment, onRequestPage() {} });
 save('compact-root', rootHtml);
 assert.match(rootHtml, /31 Oct 2026, 22:18 UTC/); assert.ok(rootHtml.includes(`dateTime="${exactTime}"`));
 assert.match(rootHtml, /<details class="fixture-context"><summary>Details<\/summary>/); assert.doesNotMatch(rootHtml, /<details[^>]*\bopen/);
 assert.ok(rootHtml.includes(`<p>Created <time dateTime="${exactTime}">${exactTime}</time></p>`));
 assert.match(rootHtml, /Comment <code>root-id<\/code>/); assert.doesNotMatch(rootHtml, /Parent <code>/);
 assert.match(rootHtml, /id="comment-root-id"/); assert.match(rootHtml, /href="\/reports\/report-one\?comment=root-id#comment-root-id"/);
 assert.match(rootHtml, /&lt;raw&gt; partial clue/); assert.match(rootHtml, /href="https:\/\/example.test\/source"/);
 assert.match(rootHtml, /Reply total unknown\./); assert.match(rootHtml, /Replies not loaded\./); assert.doesNotMatch(rootHtml, /0 known replies/);
 // The formatter does no timezone conversion, locale formatting or clock work.
 const oldTZ = process.env.TZ;
 try {
  process.env.TZ = 'Pacific/Honolulu'; const west = render(DiscussionComment, { comment: rootComment, onRequestPage() {} });
  process.env.TZ = 'Asia/Tokyo'; const east = render(DiscussionComment, { comment: rootComment, onRequestPage() {} });
  assert.equal(west, east); assert.equal(east, rootHtml);
 } finally { if (oldTZ === undefined) delete process.env.TZ; else process.env.TZ = oldTZ; }
 const cases = [
  ['2024-02-29T00:01:00.000001Z', '29 Feb 2024, 00:01 UTC'],
  ['2026-02-29T22:18:00Z', '2026-02-29T22:18:00Z'],
  ['2026-04-31T22:18:00Z', '2026-04-31T22:18:00Z'],
  ['2026-10-31T24:18:00Z', '2026-10-31T24:18:00Z'],
  ['2026-10-31T22:60:00Z', '2026-10-31T22:60:00Z'],
  ['2026-10-31T22:18:60Z', '2026-10-31T22:18:60Z'],
  ['2026-10-31T23:18:44.123456+01:00', '2026-10-31T23:18:44.123456+01:00'],
  ['time not supplied', 'time not supplied'],
 ];
 const drawComment = hooks('components/discussion/comment.tsx', 'DiscussionComment');
 for (const [raw, expected] of cases) {
  const tree = drawComment({ comment: comment('date-case', { createdAt: raw }) });
  const primary = all(tree, node => node.type === 'time')[0];
  assert.equal(text(primary), expected); assert.equal(primary.props.dateTime, raw);
 }
 const reply = comment('reply-id', { parentId: 'root-id', depth: 1, createdAt: exactTime, replyCount: undefined, permalink: '/reports/report-one#comment-reply-id' });
 const replyHtml = render(DiscussionComment, { comment: reply }); save('compact-reply', replyHtml);
 assert.match(replyHtml, /<summary>Reply details<\/summary>/); assert.match(replyHtml, /Comment <code>reply-id<\/code> · Parent <code>root-id<\/code>/);
 assert.match(replyHtml, /href="\/reports\/report-one#comment-reply-id"/); assert.doesNotMatch(replyHtml, /href="[^\"]*comment-root-id/);
 assert.match(replyHtml, /Reply loading unavailable\./);
 const wrongLink = render(DiscussionComment, { comment: { ...reply, permalink: '/reports/other#comment-reply-id' } });
 assert.match(wrongLink, /Permalink unavailable/); assert.doesNotMatch(wrongLink, /Comment link<\/a>/);
 for (const state of ['redacted', 'unavailable']) {
  const item = { ...reply, state, authorName: 'stale name must not appear' }; delete item.body;
  const html = render(DiscussionComment, { comment: item }); save(`compact-${state}`, html);
  assert.doesNotMatch(html, /stale name must not appear|Question or partial attempt/);
  assert.match(html, state === 'redacted' ? /Removed comment.*Comment removed/ : /Author unavailable.*Parent context unavailable/);
  assert.match(html, /Reply details/); assert.match(html, /Reply total unknown/);
 }
 const partial = render(DiscussionThread, { page: page([rootComment], { hasMore: true, nextCursor: 'opaque-next' }), onRequestPage() {} });
 save('compact-partial-page', partial);
 assert.match(partial, /1 comment in this list\./); assert.match(partial, /More comments available\./); assert.match(partial, /Load more comments/);
 assert.match(partial, /Drafts stay separate for each comment or reply on this page\. Copy yours before leaving or reloading\./);
 const replyPage = render(DiscussionThread, { page: page([reply], { parentId: 'root-id', ancestors: [rootComment], hasMore: true, nextCursor: 'opaque-replies' }), onRequestPage() {} });
 save('compact-reply-page', replyPage);
 assert.match(replyPage, /1 reply in this list\./); assert.match(replyPage, /More replies available\./);
 const empty = render(DiscussionThread, { page: page() }); assert.match(empty, /0 comments in this list\./); assert.doesNotMatch(empty, /More comments available/);
 const plural = render(DiscussionThread, { page: page([rootComment, comment('second')]) }); assert.match(plural, /2 comments in this list\./);
 const pluralReplies = render(DiscussionThread, { page: page([reply, { ...reply, id: 'second-reply' }], { parentId: 'root-id', ancestors: [rootComment] }) }); assert.match(pluralReplies, /2 replies in this list\./);
 const missing = render(DiscussionThread, { page: page(), selectedContext: { state: 'not-loaded', reportId: ctx.reportId, id: reply.id } });
 assert.match(missing, /Selected comment is not loaded/); assert.match(missing, /saved ID alone does not make its text readable/);
 const selected = render(DiscussionThread, { page: page(), selectedContext: { state: 'loaded', target: reply, ancestors: [rootComment] } });
 save('compact-selected-context', selected); assert.match(selected, /Selected comment context is supplied/); assert.match(selected, /id="comment-reply-id"/);
 // Actual reply/collapse handlers still retain exact target, focus and children.
 let requested, replied, focus = 0;
 const props = { comment: rootComment, onReply: value => { replied = value; }, onRequestPage: value => { requested = value; } };
 let tree = drawComment(props);
 button(tree, 'Reply').props.onClick(); assert.equal(replied, rootComment);
 button(tree, 'Load replies').props.onClick(); assert.equal(requested.reportId, ctx.reportId); assert.equal(requested.parentId, rootComment.id); assert.equal(requested.cursor, null);
 button(tree, 'Collapse replies').props.onClick({ currentTarget: { focus() { focus++; } } });
 tree = drawComment(props); assert.equal(focus, 1); assert.equal(button(tree, 'Show replies').props['aria-expanded'], false);
 assert.ok(all(tree, node => node.props?.hidden === true).length);
 // Only the one signed-out+unknown lifecycle sentence changes in Composer.
 const recoveryOld = 'Draft and request ID are local to this mounted panel. Signing in may reload it; retain the exact attempt before leaving.';
 const recoveryNew = 'Keep the draft and request ID before signing in or reloading; they may be cleared.';
 const composerSource = fs.readFileSync(new URL('components/discussion/composer.tsx', root), 'utf8');
 const composerBefore = fs.readFileSync(path.join(baseline, 'composer.tsx'), 'utf8');
 assert.equal(composerSource.split(recoveryNew).length - 1, 1); assert.equal(composerSource.replace(recoveryNew, recoveryOld), composerBefore);
 const drawComposer = hooks('components/discussion/composer.tsx', 'DiscussionComposer');
 let calls = 0; const onCreate = async () => { calls++; return { status: 'unknown' }; };
 const composerProps = { ...ctx, capability: 'can-comment', onCreate };
 let form = drawComposer(composerProps); all(form, node => node.type === 'textarea')[0].props.onChange({ currentTarget: { value: 'raw draft\r\n' } });
 await drawComposer(composerProps).props.onSubmit({ preventDefault() {} });
 form = drawComposer({ ...composerProps, capability: 'signed-out' });
 assert.equal(calls, 1); assert.equal(all(form, node => node.type === 'textarea')[0].props.value, 'raw draft\r\n');
 assert.ok(all(form, node => node.type === 'textarea')[0].props.readOnly); assert.ok(button(form, 'Retry exact attempt').props.disabled);
 assert.match(text(form), /Keep the draft and request ID before signing in or reloading; they may be cleared/);
 assert.match(text(form), /Save outcome unknown/); assert.match(text(form), /Request ID:/); save('compact-hidden-recovery', renderToStaticMarkup(form));
 // Source boundary: every existing event/action/key/state guard attribute and
 // all non-return setup statements match the pinned PR20 before source exactly.
 const preserved = {};
 for (const name of ['comment.tsx', 'thread.tsx']) {
  const beforeText = fs.readFileSync(path.join(baseline, name), 'utf8');
  const afterText = fs.readFileSync(new URL(`components/discussion/${name}`, root), 'utf8');
  function contract(source) {
   const parsed = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), attrs = [], setup = {};
   function visit(node) {
    if (ts.isJsxAttribute(node) && (/^on[A-Z]/.test(node.name.text) || ['key', 'disabled', 'readOnly', 'hidden', 'aria-expanded', 'aria-controls'].includes(node.name.text))) attrs.push(node.getText(parsed));
    ts.forEachChild(node, visit);
   }
   visit(parsed);
   for (const fn of parsed.statements.filter(ts.isFunctionDeclaration)) {
    if (fn.name.text === 'readableTimestamp') continue;
    setup[fn.name.text] = fn.body.statements.filter(statement => !ts.isReturnStatement(statement)).map(statement => statement.getText(parsed));
   }
   return { attrs, setup };
  }
  assert.deepEqual(contract(afterText), contract(beforeText)); preserved[name] = 'event/action/key/guard attributes and non-return setup exact';
 }
 fs.writeFileSync(path.join(output, 'compact-observations.json'), JSON.stringify({ recognized: exactTime, primary: '31 Oct 2026, 22:18 UTC', fullPrecisionPreserved: true, closedNativeDetails: true, timezoneOutputsEqual: true, timestampCases: cases, recognitionLimit: 'Validated canonical UTC Z only. Offset/invalid/unrecognized strings retain raw display; no date normalization or precision inference.', composerInverseLiteralRestoresBefore: true, preserved }, null, 2) + '\n');
});
console.log(JSON.stringify({ status: 'PASS', mode: compactOnly ? 'compact-metadata' : 'presentation', checks, sources,
 limits: 'Actual component React SSR plus actual exported local state/handler units with explicit mocked hooks/focus. CSS stubbed; structure checked, no computed layout. No DOM, hydration, real React update reconciliation, IAB/browser, transport, authorization, backend idempotency, DB or deployment proof. Presentation remains unwired.',
}, null, 2));
