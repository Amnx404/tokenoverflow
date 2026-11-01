// Focused integration seams only. Actual source modules, controlled services,
// identity/persistence doubles and explicit mocked client hooks; no live I/O.
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
const { AuthSessionMissingError } = require('@supabase/supabase-js');
const sourceRoot = new URL('../../', import.meta.url);
const logRoot = process.env.DISCUSSION_INTEGRATION_EVIDENCE_DIR;
if (!logRoot) throw new Error('Set DISCUSSION_INTEGRATION_EVIDENCE_DIR to a private output directory.');
fs.mkdirSync(logRoot, { recursive: true });
const observed = (name, value) => fs.appendFileSync(path.join(logRoot, 'observations.jsonl'), `${JSON.stringify({ name, value })}\n`);
const R = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', ROOT = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const OLD = '11111111-1111-4111-8111-111111111111', SELECTED = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const SECOND = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', CHILD = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const REQUEST = 'ffffffff-ffff-4fff-8fff-ffffffffffff', SAVED = '22222222-2222-4222-8222-222222222222';
const TS = '2026-10-31T10:00:00.123456Z';
const ORIGINAL_BODY = '\r\n  code();\n\tpartial clue\r\n';
const row = (id, extra = {}) => ({ id, report_id: R, parent_id: null, root_id: id, depth: 0, author_name: 'Public fixture name', body: '\n  raw question\r\n', created_at: TS, redacted_at: null, ...extra });
const rootRow = row(ROOT), oldRow = row(OLD, { author_name: null, body: null, redacted_at: TS });
const selectedRow = row(SELECTED, { parent_id: OLD, root_id: OLD, depth: 1, body: '<script>untrusted</script>\nhttps://example.test/source' });
const childRow = row(CHILD, { parent_id: ROOT, root_id: ROOT, depth: 1 });
const sources = {}, observations = { pageCalls: [], contextCalls: [], capabilityBatches: [], actorCalls: 0, appendCalls: 0, rowsCreated: 0, revalidations: [] };
const serviceRows = new Set([rootRow, oldRow, selectedRow, childRow]);
const actors = { A: Object.freeze({ identity: { user: { id: '77777777-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } } }), B: Object.freeze({ identity: { user: { id: '66666666-bbbb-4bbb-8bbb-bbbbbbbbbbbb' } } }) };
const currentActor = () => actors[state.account];
const state = { account: 'A', denyActor: false, sdkUserMode: 'present', denyCaps: false, failRead: false, contextUnavailable: false, returnRootTombstone: false, persistThenFail: false, specialPage: undefined };
const receipts = new Map();
const savedInputs = new Map();
let DiscussionError;
const services = {
 async listDiscussionComments(input) {
  observations.pageCalls.push({ ...input });
  if (state.failRead) throw new Error('private service sentinel');
  if (state.specialPage) return state.specialPage;
  if (input.parent_id === ROOT) return { report_id: R, parent_id: ROOT, parent: rootRow, ancestors: [], comments: [childRow], has_more: false, next_cursor: null };
  if (input.parent_id === SELECTED) return { report_id: R, parent_id: SELECTED, parent: selectedRow, ancestors: [oldRow], comments: [], has_more: false, next_cursor: null };
  const comments = input.cursor ? [row(SECOND)] : [rootRow]; comments.forEach(item => serviceRows.add(item));
  return { report_id: R, parent_id: null, parent: null, ancestors: [], comments, has_more: !input.cursor, next_cursor: input.cursor ? null : 'opaque_cursor' };
 },
 async getDiscussionContext(input) {
  observations.contextCalls.push({ ...input });
  if (state.failRead) throw new Error('private context sentinel');
  if (state.contextUnavailable) return { report_id: R, status: 'unavailable', comment: null, ancestors: [] };
  if (input.comment_id === ROOT) {
   const target = state.returnRootTombstone ? { ...rootRow, body: null, author_name: null, redacted_at: TS } : rootRow;
   serviceRows.add(target); return { report_id: R, status: 'available', comment: target, ancestors: [] };
  }
  return { report_id: R, status: 'available', comment: selectedRow, ancestors: [oldRow] };
 },
 async getDiscussionRedactionCapabilities(actualActor, loaded) {
  assert.ok(actualActor === currentActor()); assert.ok(loaded.length <= 59);
  for (const item of loaded) assert.ok(serviceRows.has(item), 'capabilities must receive actual service-returned rows');
  observations.capabilityBatches.push(loaded.map(item => item.id));
  if (state.denyCaps) throw new Error('private capability sentinel');
  return [...loaded.map(item => ({ id: item.id, can_redact: true })), { id: SAVED, can_redact: true }];
 },
 async appendDiscussionComment(actualActor, input) {
  assert.ok(actualActor === currentActor()); observations.appendCalls++;
  const key = `${state.account}:${input.request_id}`;
  let saved = receipts.get(key);
  if (saved) { const original = savedInputs.get(key); assert.equal(input.body, original.body); assert.equal(input.report_id, original.report_id); assert.equal(input.parent_id, original.parent_id); }
  if (!saved) { observations.rowsCreated++; saved = { request_id: input.request_id, id: SAVED, report_id: input.report_id, parent_id: input.parent_id, root_id: input.parent_id === null ? SAVED : ROOT, depth: input.parent_id === null ? 0 : 1, created_at: TS, redacted_at: null, url: `/reports/${R}?comment=${SAVED}#comment-${SAVED}` }; receipts.set(key, saved); savedInputs.set(key, { ...input }); }
  if (state.persistThenFail) { state.persistThenFail = false; throw new DiscussionError(500); }
  return saved;
 },
 async redactDiscussionComment(actualActor, input) {
  assert.ok(actualActor === currentActor()); assert.equal(input.comment_id, ROOT);
  return { id: ROOT, report_id: R, parent_id: null, root_id: ROOT, depth: 0, created_at: TS, redacted_at: TS, url: `/reports/${R}?comment=${ROOT}#comment-${ROOT}` };
 },
};
const supabase = { serverClient: async () => ({ auth: { getUser: async () => {
 if (state.sdkUserMode === 'missing') return { data: { user: null }, error: new AuthSessionMissingError() };
 if (state.sdkUserMode === 'error') return { data: { user: null }, error: new Error('controlled network failure') };
 if (state.sdkUserMode === 'spoof') return { data: { user: null }, error: { name: 'AuthSessionMissingError', status: 400 } };
 return { data: { user: state.sdkUserMode === 'null' ? null : { id: currentActor().identity.user.id } }, error: null };
} } }) };
const actorService = { requireWebDiscussionActor: async () => { observations.actorCalls++; if (state.denyActor || state.sdkUserMode !== 'present') throw new DiscussionError(401); return currentActor(); } };
const formal = Object.freeze({ report: Object.freeze({ id: R, title: 'Formal finding unchanged', summary: 'Recorded symptom', category: 'APIs', author_name: 'Contributor', created_at: TS, tags: ['sdk'], is_example: true, body: 'formal body <raw>', reproduction: '\n exact reproduction\r\n', attempted_fixes: 'No local test', environment: 'Version unknown', evidence_bundle: null }), fixes: Object.freeze([{ id: ROOT, author_name: 'First party', created_at: TS, body: 'Exact proposed change', evidence: 'Actual recorded evidence', environment: 'Known environment', evidence_bundle: null, is_own_fix: false, verifications: [{ id: CHILD, outcome: 'failed', author_name: 'Independent', environment: 'Specific conditions', notes: 'Negative observation retained', evidence_bundle: null }] }]) });
const formalBefore = JSON.stringify(formal);
function moduleGraph(react = require('react')) {
 const cache = new Map();
 function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const source = fs.readFileSync(new URL(file, sourceRoot), 'utf8'); sources[file] = createHash('sha256').update(source).digest('hex');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const testModule = { exports: {} }; cache.set(file, testModule);
  vm.runInNewContext(code, { URL, FormData, TextEncoder, Buffer, crypto: { randomUUID: () => REQUEST }, module: testModule, exports: testModule.exports, require: name => {
   if (name === 'react') return react;
   if (name === '@supabase/supabase-js') return require(name);
   if (name === 'node:crypto') return require(name);
   if (name === 'react/jsx-runtime' || name === 'zod' || name === '@trpc/server') return require(name);
   if (name === 'next/cache') return { revalidatePath: value => { observations.revalidations.push(value); throw new Error('optional revalidation failed'); } };
   if (name === 'next/link') return function ControlledLink({ children, ...props }) { return createElement('a', props, children); };
   if (name === 'next/navigation') return { notFound() { throw new Error('Unexpected formal notFound'); } };
   if (name === 'lucide-react') return { ArrowLeft: () => createElement('svg') };
   if (name === '@/lib/supabase/server') return supabase;
   if (name === '@/server/services/discussion-actor') return actorService;
   if (name === '@/server/services/discussions') return services;
   if (name === '@/trpc/server') return { api: { reports: { byId: async () => formal } } };
   if (name === '@/components/forms') return { CopyButton: ({ value, label }) => createElement('button', { 'data-copy': value }, label), FixForm: () => createElement('p', {}, 'Actual formal form slot'), VerifyForm: () => createElement('p', {}, 'Actual formal verification slot') };
   if (name === '@/lib/types') return { dateLabel: value => value };
   if (name.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_target, key) => `fixture-${String(key)}` }) };
   if (name.startsWith('.') || name.startsWith('@/')) {
    const base = name.startsWith('@/') ? name.slice(2) : path.posix.normalize(path.posix.join(path.posix.dirname(file), name));
    return load(fs.existsSync(new URL(`${base}.tsx`, sourceRoot)) ? `${base}.tsx` : `${base}.ts`);
   }
   throw new Error(`Unexpected controlled integration import ${name}`);
  } });
  return testModule.exports;
 }
 return load;
}
const load = moduleGraph();
DiscussionError = load('server/services/discussion-errors.ts').DiscussionError;
const reads = load('app/discussion-read-actions.ts');
const connected = load('components/discussion/connected-thread.tsx');
const { ComposerSession } = load('components/discussion/composer.tsx');
const checks = [];
const localRecoveryOnly = process.argv.includes('--local-validation-recovery');
const localRecoveryCheck = 'proven local validation permits direct edit; dispatched rejection and unknown retain exact recovery';
async function check(name, run) { if (localRecoveryOnly && name !== localRecoveryCheck) return; await run(); checks.push(name); }
const render = (Component, props) => renderToStaticMarkup(createElement(Component, props));
let rootRead, selectedRead;
await check('actual anonymous read wrappers preserve canonical public data, fresh capability lookup and privacy', async () => {
 rootRow.private_account_id = 'NEVER-SERIALIZE-OWNER';
 rootRead = await reads.readDiscussionPage({ report_id: R.toUpperCase(), parent_id: null });
 selectedRead = await reads.readDiscussionContext({ report_id: R.toUpperCase(), comment_id: SELECTED.toUpperCase() });
 observed('initial reads before assertions', { rootRead, selectedRead });
 assert.equal(rootRead.status, 'available'); assert.equal(rootRead.page.report_id, R); assert.equal(rootRead.page.comments[0].created_at, TS);
 assert.equal(rootRead.capability, 'can-comment'); assert.ok(rootRead.redactableIds.includes(ROOT)); assert.ok(!rootRead.redactableIds.includes(SAVED));
 assert.equal(selectedRead.context.ancestors[0].body, null); assert.equal(selectedRead.context.ancestors[0].author_name, null);
 assert.doesNotMatch(JSON.stringify({ rootRead, selectedRead }), /NEVER-SERIALIZE|private_|identity|session/);
 assert.equal(observations.pageCalls[0].report_id, R); assert.equal(observations.contextCalls[0].comment_id, SELECTED);
 delete rootRow.private_account_id;
});
await check('fresh actor/capability failure closes capabilities without blocking public bodies; malformed inputs cannot choose another report', async () => {
 state.denyActor = true; const anonymous = await reads.readDiscussionPage({ report_id: R }); state.denyActor = false;
 state.denyCaps = true; const capFailure = await reads.readDiscussionPage({ report_id: R }); state.denyCaps = false;
 observed('capability failures before assertions', { anonymous, capFailure });
 for (const output of [anonymous, capFailure]) { assert.equal(output.status, 'available'); assert.equal(output.capability, 'read-only'); assert.equal(output.redactableIds.length, 0); assert.equal(output.page.comments[0].body, rootRow.body); }
 for (const sdkUserMode of ['null', 'missing', 'error', 'spoof']) {
  state.sdkUserMode = sdkUserMode;
  const output = await reads.readDiscussionPage({ report_id: R });
  observed(`SDK anonymous entry ${sdkUserMode} before assertions`, output);
  assert.equal(output.status, 'available'); assert.equal(output.redactableIds.length, 0); assert.equal(output.page.comments[0].body, rootRow.body);
  const html = render(connected.ConnectedDiscussionThread, { reportId: R, initialPage: output, initialContext: selectedRead, selectedCommentId: SELECTED, selectionRequested: true });
  fs.writeFileSync(path.join(logRoot, `auth-entry-${sdkUserMode}.static.html`), html);
  if (sdkUserMode === 'null' || sdkUserMode === 'missing') {
   assert.equal(output.capability, 'signed-out');
   const href = `/login?next=${encodeURIComponent(`/reports/${R}?comment=${SELECTED}`)}`;
   assert.ok(html.includes(`href="${href}"`)); assert.match(html, /Sign in to comment<\/a>/);
  } else { assert.equal(output.capability, 'read-only'); assert.doesNotMatch(html, /Sign in to comment<\/a>/); }
 }
 state.sdkUserMode = 'present';
 const count = observations.contextCalls.length;
 assert.equal((await reads.readDiscussionContext({ report_id: R, comment_id: [SELECTED] })).status, 'unavailable');
 assert.equal((await reads.readDiscussionContext({ report_id: R, comment_id: 'bad' })).status, 'unavailable'); assert.equal(observations.contextCalls.length, count);
 assert.equal((await reads.readDiscussionPage({ report_id: R, rows: [rootRow] })).status, 'unavailable');
});
await check('actual loaded row capability batch stays bounded for a maximum direct-child page', async () => {
 const ancestors = Array.from({ length: 7 }, (_, i) => row(`9000000${i}-0000-4000-8000-000000000000`, { parent_id: i ? `9000000${i - 1}-0000-4000-8000-000000000000` : null, root_id: '90000000-0000-4000-8000-000000000000', depth: i }));
 const parent = row('90000007-0000-4000-8000-000000000000', { parent_id: ancestors.at(-1).id, root_id: ancestors[0].id, depth: 7 });
 const children = Array.from({ length: 50 }, (_, i) => row(`80000000-0000-4000-8000-${String(i).padStart(12, '0')}`, { parent_id: parent.id, root_id: ancestors[0].id, depth: 8 }));
 [...ancestors, parent, ...children].forEach(item => serviceRows.add(item));
 state.specialPage = { report_id: R, parent_id: parent.id, parent, ancestors, comments: children, has_more: false, next_cursor: null };
 const output = await reads.readDiscussionPage({ report_id: R, parent_id: parent.id, limit: 50 }); state.specialPage = undefined;
 observed('bounded loaded capabilities before assertions', { batchLength: observations.capabilityBatches.at(-1).length, returnedRows: output.page.comments.length });
 assert.equal(observations.capabilityBatches.at(-1).length, 58); assert.equal(output.page.comments.length, 50);
 const mapped = connected.adaptDiscussionPage(output); assert.equal(mapped.ancestors.length, 8); assert.equal(mapped.ancestors.at(-1).id, parent.id);
});
await check('actual detail SSR includes canonical root and outside-page selected reply/tombstone while preserving formal finding and counts', async () => {
 const Detail = load('app/reports/[id]/page.tsx').default;
 const html = renderToStaticMarkup(await Detail({ params: Promise.resolve({ id: R }), searchParams: Promise.resolve({ comment: SELECTED.toUpperCase() }) }));
 fs.writeFileSync(path.join(logRoot, 'detail.static.html'), html);
 assert.match(html, /Formal finding unchanged/); assert.match(html, /0 worked results · 1 failed results/); assert.match(html, /Negative observation retained/);
 assert.match(html, /&lt;script&gt;untrusted&lt;\/script&gt;/); assert.match(html, /Removed comment/); assert.match(html, /Load more comments/);
 assert.match(html, new RegExp(`id="comment-${SELECTED}"`)); assert.match(html, new RegExp(`id="comment-${ROOT}"`));
 assert.doesNotMatch(html, /NEVER-SERIALIZE|private_|<script/); assert.equal(JSON.stringify(formal), formalBefore);
 assert.ok(html.indexOf('<h2>Discussion</h2>') > html.indexOf('Negative observation retained'));
 assert.ok(html.includes('data-copy="\n exact reproduction\r\n"'));
 const count = observations.contextCalls.length;
 const malformed = renderToStaticMarkup(await Detail({ params: Promise.resolve({ id: R }), searchParams: Promise.resolve({ comment: [SELECTED] }) }));
 assert.match(malformed, /selection was not loaded/); assert.equal(observations.contextCalls.length, count);
 state.contextUnavailable = true;
 const noSelected = renderToStaticMarkup(await Detail({ params: Promise.resolve({ id: R }), searchParams: Promise.resolve({ comment: SELECTED }) })); state.contextUnavailable = false;
 fs.writeFileSync(path.join(logRoot, 'selected-unavailable.static.html'), noSelected);
 assert.match(noSelected, /Selected comment is not loaded/);
 state.failRead = true;
 const unavailable = renderToStaticMarkup(await Detail({ params: Promise.resolve({ id: R }), searchParams: Promise.resolve({}) })); state.failRead = false;
 assert.match(unavailable, /Formal finding unchanged/); assert.match(unavailable, /Discussion is temporarily unavailable/);
});
await check('fresh selected tombstone replaces same-ID stale loaded body/capability without losing root cursor', async () => {
 state.returnRootTombstone = true;
 const fresh = await reads.readDiscussionContext({ report_id: R, comment_id: ROOT }); state.returnRootTombstone = false;
 const html = render(connected.ConnectedDiscussionThread, { reportId: R, initialPage: rootRead, initialContext: fresh, selectedCommentId: ROOT, selectionRequested: true });
 fs.writeFileSync(path.join(logRoot, 'fresh-context-tombstone.static.html'), html);
 assert.match(html, /Removed comment/); assert.doesNotMatch(html, /raw question|Public fixture name|Remove my comment/);
 assert.match(html, /Load more comments/); assert.equal([...html.matchAll(new RegExp(`id="comment-${ROOT}"`, 'g'))].length, 1);
});
await check('original continuity marker/callback blocks B after unknown A write and A resolves the same one row', async () => {
 const loadedParent = id => id === ROOT ? connected.adaptDiscussionComment(rootRow, [ROOT]) : undefined;
 let parentLoaded = true;
 const find = id => parentLoaded ? loadedParent(id) : undefined;
 const attempts = new Map();
 const target = { reportId: R.toUpperCase(), parentId: ROOT.toUpperCase() };
 const body = ORIGINAL_BODY;
 state.denyActor = true;
 const prepareFailure = await connected.createDiscussionBridge(loadedParent)({ requestId: '99999999-9999-4999-8999-999999999999', reportId: R, parentId: ROOT, body });
 state.denyActor = false;
 observed('prepare failure before assertions', { status: prepareFailure.status, writerCalls: observations.appendCalls });
 assert.equal(prepareFailure.status, 'rejected'); assert.equal(observations.appendCalls, 0);
 let ids = 0; const model = new ComposerSession(() => { ids++; return REQUEST.toUpperCase(); });
 model.edit(target, body); state.persistThenFail = true;
 const original = connected.createDiscussionBridge(find, () => { throw new Error('optional refresh failed'); }, undefined, attempts);
 const firstActorCalls = observations.actorCalls;
 await model.submit(target, original);
 const payload = model.view(target).attempt;
 observed('unknown A attempt before assertions', { status: model.view(target).status, writerCalls: observations.appendCalls, rows: observations.rowsCreated, payload });
 assert.equal(model.view(target).status, 'unknown'); assert.equal(observations.actorCalls - firstActorCalls, 2);
 assert.equal(payload.reportId, R); assert.equal(payload.parentId, ROOT); assert.equal(payload.requestId, REQUEST); assert.equal(payload.body, body);
 const originalSnapshot = attempts.get(REQUEST);
 assert.ok(originalSnapshot && typeof originalSnapshot.marker === 'string');
 let replacementCalls = 0;
 const replacementB = async value => { replacementCalls++; return connected.createDiscussionBridge(find)(value); };
 state.account = 'B'; parentLoaded = false; state.denyActor = true;
 await model.submit(target, replacementB); state.denyActor = false;
 model.correct(target);
 observed('unavailable B retry before assertions', { status: model.view(target).status, writerCalls: observations.appendCalls, replacementCalls });
 assert.equal(model.view(target).status, 'unknown'); assert.equal(model.view(target).attempt, payload); assert.equal(observations.appendCalls, 1);
 // A lost original marker must not be re-prepared under B, even though a new
 // callback was supplied. Keep fixture metadata in memory only, never logs.
 attempts.clear(); await model.submit(target, replacementB);
 assert.equal(model.view(target).status, 'unknown'); assert.equal(observations.appendCalls, 1);
 attempts.set(REQUEST, originalSnapshot);
 const react = { ...require('react'), useId: () => 'controlled-composer', useState: initial => typeof initial === 'function' ? [model, () => {}] : [initial, () => {}] };
 const ActualComposer = moduleGraph(react)('components/discussion/composer.tsx').DiscussionComposer;
 const retryForm = ActualComposer({ reportId: R, parentId: ROOT, capability: 'can-comment', newTargetAvailable: false, onCreate: replacementB });
 const retryButton = walk(retryForm, node => node.type === 'button' && node.props.type === 'submit')[0];
 assert.equal(retryButton.props.disabled, false);
 const beforeB = observations.actorCalls;
 await retryForm.props.onSubmit({ preventDefault() {} });
 observed('verified B mismatch before assertions', { status: model.view(target).status, writerCalls: observations.appendCalls, rows: observations.rowsCreated, replacementCalls, actorLookups: observations.actorCalls - beforeB });
 assert.equal(model.view(target).status, 'unknown'); assert.equal(model.view(target).attempt, payload);
 assert.equal(observations.actorCalls - beforeB, 1); assert.equal(observations.appendCalls, 1); assert.equal(replacementCalls, 0);
 const blocked = await connected.createDiscussionBridge(find)({ ...payload, requestId: '88888888-8888-4888-8888-888888888888' });
 assert.equal(blocked.status, 'rejected'); assert.equal(observations.appendCalls, 1);
 state.account = 'A'; const beforeA = observations.actorCalls;
 await retryForm.props.onSubmit({ preventDefault() {} });
 const saved = model.view(target);
 observed('same A known replay before assertions', { status: saved.status, receipt: saved.receipt, rows: observations.rowsCreated, writerCalls: observations.appendCalls, replacementCalls, actorLookups: observations.actorCalls - beforeA });
 assert.equal(saved.status, 'saved'); assert.equal(saved.receipt.id, SAVED); assert.equal(saved.body, '');
 assert.equal(observations.rowsCreated, 1); assert.equal(observations.appendCalls, 2); assert.equal(ids, 1); assert.equal(replacementCalls, 0); assert.equal(observations.actorCalls - beforeA, 1);
 const optionalLinkFailure = await connected.createDiscussionBridge(loadedParent, () => { throw new Error('optional refresh failed'); }, async () => ({ request_id: REQUEST, receipt: { ...receipts.get(`A:${REQUEST}`), url: 'https://untrusted.test/' } }))(payload);
 assert.equal(optionalLinkFailure.status, 'saved'); assert.equal(optionalLinkFailure.id, SAVED); assert.equal(optionalLinkFailure.permalink, undefined);
 const capture = [];
 await connected.createDiscussionBridge(loadedParent, undefined, async (_state, form) => { capture.push([...form]); return { error: { status: 500, code: 'INTERNAL_SERVER_ERROR', message: 'not displayed' } }; })(payload);
 observed('guarded wire field names before assertions', capture.map(entries => entries.map(([key]) => key)));
 assert.deepEqual(capture[0].map(([key]) => key).sort(), ['body', 'continuity_marker', 'parent_id', 'report_id', 'request_id']);
 assert.equal(capture[0].find(([key]) => key === 'body')[1], body);
 assert.ok(/^[a-f0-9]{64}$/.test(capture[0].find(([key]) => key === 'continuity_marker')[1]));
});
await check('nonnull replay redaction is known saved tombstone, not restored body or a duplicate', async () => {
 receipts.set(`A:${REQUEST}`, { ...receipts.get(`A:${REQUEST}`), redacted_at: TS });
 const find = id => id === ROOT ? connected.adaptDiscussionComment(rootRow, [ROOT]) : undefined;
 const model = new ComposerSession(() => REQUEST); const target = { reportId: R, parentId: ROOT };
 model.edit(target, ORIGINAL_BODY); await model.submit(target, connected.createDiscussionBridge(find));
 const result = model.view(target); observed('tombstone replay before assertions', result);
 assert.equal(result.status, 'saved'); assert.equal(result.receipt.redacted, true); assert.equal(result.body, ''); assert.equal(observations.rowsCreated, 1);
});
await check('actual redact action receipt merges neutral tombstone over loaded row, retaining children and no invented totals', async () => {
 const original = { ...connected.adaptDiscussionComment(rootRow, [ROOT]), replies: { reportId: R, parentId: ROOT, ancestors: [], children: [], hasMore: true, nextCursor: 'opaque_child' } };
 const capture = [];
 const actual = load('app/discussion-actions.ts');
 const result = await connected.redactDiscussionBridge(id => id === ROOT ? original : undefined, async (value, form) => { capture.push([...form]); const saved = await actual.redactDiscussion(value, form); return { ...saved, receipt: { ...saved.receipt, url: undefined } }; })({ reportId: R.toUpperCase(), id: ROOT.toUpperCase() });
 observed('redact mapped result before assertions', result);
 assert.equal(result.status, 'redacted'); assert.equal(result.comment.id, ROOT); assert.equal(result.comment.authorName, null); assert.equal(result.comment.body, undefined); assert.equal(result.comment.replies, original.replies); assert.equal(result.comment.replyCount, undefined);
 assert.deepEqual(capture[0], [['comment_id', ROOT]]);
});
function hookGraph() {
 const slots = []; let cursor = 0;
 const react = { ...require('react'), useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial; return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; }, useRef(initial) { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index]; } };
 const client = moduleGraph(react)('components/discussion/connected-thread.tsx');
 return props => { cursor = 0; return client.ConnectedDiscussionThread(props); };
}
function walk(node, predicate, output = []) { if (Array.isArray(node)) node.forEach(item => walk(item, predicate, output)); else if (node && typeof node === 'object') { if (predicate(node)) output.push(node); walk(node.props?.children, predicate, output); } return output; }
const flush = () => new Promise(resolve => setImmediate(resolve));
await check('actual connected handlers keep independent bounded page/back state and selected context, without merging totals', async () => {
 const draw = hookGraph(), props = { reportId: R, initialPage: rootRead, initialContext: selectedRead, selectionRequested: true };
 const getThread = tree => walk(tree, node => typeof node.type === 'function' && node.type.name === 'DiscussionThread')[0];
 let tree = draw(props), thread = getThread(tree);
 thread.props.onRequestPage({ reportId: R, parentId: null, cursor: 'opaque_cursor' }); await flush();
 tree = draw(props); thread = getThread(tree); observed('connected next page before assertions', { ids: thread.props.page.children.map(item => item.id), selected: thread.props.selectedContext.target.id });
 assert.equal(thread.props.page.children.length, 1); assert.equal(thread.props.page.children[0].id, SECOND); assert.equal(thread.props.selectedContext.target.id, SELECTED);
 const previous = walk(tree, node => node.type === 'button' && node.props.children === 'Previous comments page')[0]; assert.ok(previous); previous.props.onClick();
 tree = draw(props); thread = getThread(tree); assert.equal(thread.props.page.children[0].id, ROOT);
 thread.props.onRequestPage({ reportId: R, parentId: ROOT, cursor: null }); await flush();
 tree = draw(props); thread = getThread(tree); assert.equal(thread.props.page.children[0].replies.children[0].id, CHILD); assert.equal(thread.props.selectedContext.target.id, SELECTED);
 const markup = renderToStaticMarkup(tree); const ids = [...markup.matchAll(/id="(comment-[^"]+)"/g)].map(match => match[1]); assert.equal(new Set(ids).size, ids.length);
 assert.equal(observations.pageCalls.at(-1).parent_id, ROOT); assert.equal(observations.pageCalls.at(-1).cursor, undefined);
});
await check(localRecoveryCheck, async () => {
 // Actual session/component handlers with explicit mounted-hook doubles only.
 const beforeServices = { actorCalls: observations.actorCalls, appendCalls: observations.appendCalls, rowsCreated: observations.rowsCreated };
 const target = { reportId: R.toUpperCase(), parentId: ROOT.toUpperCase() };
 const invalid = '\r\n \t\u2003';
 let ids = 0, calls = 0, release;
 const model = new ComposerSession(() => { ids++; return REQUEST.toUpperCase(); });
 const sent = [];
 const original = payload => { calls++; sent.push(payload); return new Promise(resolve => { release = resolve; }); };
 function draw(session, onCreate, extra = {}) {
  const react = { ...require('react'), useId: () => 'local-recovery-composer', useState: initial => typeof initial === 'function' ? [session, () => {}] : [initial, () => {}] };
  const Actual = moduleGraph(react)('components/discussion/composer.tsx').DiscussionComposer;
  return Actual({ ...target, capability: 'can-comment', onCreate, ...extra });
 }
 const textarea = tree => walk(tree, node => node.type === 'textarea')[0];
 const post = tree => walk(tree, node => node.type === 'button' && node.props.type === 'submit')[0];
 const correct = tree => walk(tree, node => node.type === 'button' && node.props.children === 'Correct this draft')[0];
 const change = (tree, value) => textarea(tree).props.onChange({ currentTarget: { value } });
 const submit = tree => tree.props.onSubmit({ preventDefault() {} });
 let tree = draw(model, original);
 change(tree, invalid); await submit(draw(model, original));
 let draft = model.view(target); tree = draw(model, original);
 observed('local invalid before assertions', { status: draft.status, localError: draft.localError, body: draft.body, ids, calls, hasAttempt: Boolean(draft.attempt), hasCallback: Boolean(draft.createAttempt) });
 assert.equal(draft.status, 'editing'); assert.equal(draft.localError, 'invalid-body'); assert.equal(draft.body, invalid);
 assert.equal(draft.attempt, undefined); assert.equal(draft.createAttempt, undefined); assert.equal(ids, 0); assert.equal(calls, 0);
 assert.equal(textarea(tree).props.readOnly, false); assert.equal(post(tree).props.disabled, false); assert.equal(correct(tree), undefined);
 const invalidHtml = renderToStaticMarkup(tree);
 fs.writeFileSync(path.join(logRoot, 'local-invalid.static.html'), invalidHtml);
 assert.match(invalidHtml, /role="status" aria-live="polite"><p>Use 1–2,000 characters and at most 8 KiB of text\./);
 assert.ok(textarea(tree).props['aria-describedby']);
 change(tree, ' '); tree = draw(model, original);
 assert.equal(model.view(target).localError, undefined); assert.doesNotMatch(renderToStaticMarkup(tree), /Use 1–2,000/);
 assert.equal(ids, 0); assert.equal(calls, 0);
 // Editing is not permission to bypass validation: each explicit Post checks again.
 await submit(tree); assert.equal(model.view(target).localError, 'invalid-body'); assert.equal(ids, 0); assert.equal(calls, 0);
 tree = draw(model, original); change(tree, ORIGINAL_BODY); tree = draw(model, original);
 assert.equal(model.view(target).localError, undefined); assert.equal(model.view(target).body, ORIGINAL_BODY);
 assert.equal(ids, 0); assert.equal(calls, 0); assert.equal(model.view({ reportId: R, parentId: null }).body, '');
 fs.writeFileSync(path.join(logRoot, 'local-corrected.static.html'), renderToStaticMarkup(tree));
 for (const extra of [{ capability: 'read-only' }, { newTargetAvailable: false }]) {
  const unavailable = draw(model, original, extra);
  assert.equal(textarea(unavailable).props.readOnly, true); assert.equal(post(unavailable).props.disabled, true);
  await submit(unavailable); assert.equal(ids, 0); assert.equal(calls, 0);
 }
 const sending = submit(tree); tree = draw(model, original);
 assert.equal(model.view(target).status, 'pending'); assert.equal(textarea(tree).props.readOnly, true); assert.equal(post(tree).props.disabled, true);
 assert.equal(ids, 1); assert.equal(calls, 1); assert.equal(sent[0].requestId, REQUEST); assert.equal(sent[0].reportId, R); assert.equal(sent[0].parentId, ROOT); assert.equal(sent[0].body, ORIGINAL_BODY);
 await submit(tree); assert.equal(calls, 1);
 release({ status: 'saved', id: SAVED, reportId: R, parentId: ROOT, permalink: `/reports/${R}?comment=${SAVED}#comment-${SAVED}` }); await sending;
 assert.equal(model.view(target).status, 'saved'); assert.equal(model.view(target).body, ''); assert.equal(model.view(target).receipt.id, SAVED);
 fs.writeFileSync(path.join(logRoot, 'local-saved.static.html'), renderToStaticMarkup(draw(model, original)));
 // A dispatched 400 invalid-body error has no local provenance. Keep Correct.
 const marker = 'c'.repeat(64), loaded = id => id === ROOT ? connected.adaptDiscussionComment(rootRow, [ROOT]) : undefined;
 let prepareCalls = 0, dispatched = 0, rejectedIds = 0;
 const attempts = new Map(), wire = [];
 const prepare = async () => { prepareCalls++; return { marker }; };
 const serverInvalid = async (_state, form) => { dispatched++; wire.push(Object.fromEntries(form)); return { error: { status: 400 } }; };
 const callback = connected.createDiscussionBridge(loaded, undefined, serverInvalid, attempts, prepare);
 const rejected = new ComposerSession(() => { rejectedIds++; return REQUEST; });
 rejected.edit(target, ORIGINAL_BODY); await rejected.submit(target, callback);
 const rejectedPayload = rejected.view(target).attempt, snapshot = attempts.get(REQUEST);
 tree = draw(rejected, callback); draft = rejected.view(target);
 observed('dispatched invalid-body before assertions', { status: draft.status, error: draft.rejection?.error, ids: rejectedIds, dispatched, prepareCalls, originalCallbackRetained: draft.createAttempt === callback, originalMarkerRetained: snapshot.marker === marker });
 assert.equal(draft.status, 'rejected'); assert.equal(draft.rejection.error, 'invalid-body'); assert.equal(draft.localError, undefined);
 assert.equal(draft.createAttempt, callback); assert.equal(draft.body, ORIGINAL_BODY); assert.equal(textarea(tree).props.readOnly, true); assert.equal(post(tree).props.disabled, true); assert.ok(correct(tree));
 change(tree, 'must not replace a sent body'); await submit(tree);
 assert.equal(rejected.view(target).body, ORIGINAL_BODY); assert.equal(rejected.view(target).attempt, rejectedPayload); assert.equal(rejectedIds, 1); assert.equal(dispatched, 1); assert.equal(prepareCalls, 1);
 assert.equal(wire[0].body, ORIGINAL_BODY); assert.equal(wire[0].continuity_marker, marker); assert.equal(wire[0].request_id, REQUEST); assert.equal(wire[0].report_id, R); assert.equal(wire[0].parent_id, ROOT);
 fs.writeFileSync(path.join(logRoot, 'server-invalid.static.html'), renderToStaticMarkup(tree));
 correct(tree).props.onClick(); draft = rejected.view(target);
 assert.equal(draft.status, 'editing'); assert.equal(draft.body, ORIGINAL_BODY); assert.equal(draft.attempt, undefined); assert.equal(draft.createAttempt, undefined); assert.equal(draft.rejection, undefined);
 // Transport ambiguity, then later denied retry: original callback and marker survive.
 const unknownAttempts = new Map(), unknownWire = [];
 let unknownIds = 0, originalCalls = 0, replacementCalls = 0, unknownPrepare = 0;
 const guardedAction = async (_state, form) => { originalCalls++; unknownWire.push(Object.fromEntries(form)); if (originalCalls === 1) throw new Error('controlled transport unknown'); return { error: { status: 403 } }; };
 const unknownCallback = connected.createDiscussionBridge(loaded, undefined, guardedAction, unknownAttempts, async () => { unknownPrepare++; return { marker }; });
 const replacement = async () => { replacementCalls++; return { status: 'rejected', error: 'invalid-body' }; };
 const unknown = new ComposerSession(() => { unknownIds++; return REQUEST; });
 unknown.edit(target, ORIGINAL_BODY); await unknown.submit(target, unknownCallback);
 const unknownPayload = unknown.view(target).attempt, unknownSnapshot = unknownAttempts.get(REQUEST);
 assert.equal(unknown.view(target).status, 'unknown'); assert.equal(unknown.view(target).createAttempt, unknownCallback);
 tree = draw(unknown, replacement, { newTargetAvailable: false });
 assert.equal(textarea(tree).props.readOnly, true); assert.equal(post(tree).props.disabled, false); assert.equal(post(tree).props.children, 'Retry exact attempt'); assert.equal(correct(tree), undefined);
 change(tree, 'must not change unknown'); unknown.correct(target);
 assert.equal(unknown.view(target).body, ORIGINAL_BODY); assert.equal(unknown.view(target).attempt, unknownPayload);
 await submit(tree); tree = draw(unknown, replacement, { newTargetAvailable: false }); draft = unknown.view(target);
 observed('later denied unknown before assertions', { status: draft.status, error: draft.rejection?.error, unknownIds, originalCalls, replacementCalls, unknownPrepare, originalCallbackRetained: draft.createAttempt === unknownCallback, sameAttempt: draft.attempt === unknownPayload, sameSnapshot: unknownAttempts.get(REQUEST) === unknownSnapshot, markerRetained: unknownSnapshot.marker === marker });
 assert.equal(draft.status, 'unknown'); assert.equal(draft.attempt, unknownPayload); assert.equal(draft.createAttempt, unknownCallback); assert.equal(draft.localError, undefined);
 assert.equal(unknownAttempts.get(REQUEST), unknownSnapshot); assert.equal(unknownSnapshot.marker, marker); assert.equal(unknownSnapshot.guardedAction, guardedAction);
 assert.equal(unknownIds, 1); assert.equal(originalCalls, 2); assert.equal(replacementCalls, 0); assert.equal(unknownPrepare, 1);
 assert.deepEqual(unknownWire[1], unknownWire[0]); assert.equal(unknownWire[1].body, ORIGINAL_BODY);
 assert.equal(textarea(tree).props.readOnly, true); assert.equal(post(tree).props.children, 'Retry exact attempt'); assert.equal(correct(tree), undefined);
 fs.writeFileSync(path.join(logRoot, 'unknown-later-denied.static.html'), renderToStaticMarkup(tree));
 assert.match(renderToStaticMarkup(tree), /Save outcome unknown\. Draft, reply target and request ID are retained/);
 assert.equal(draft.rejection, undefined, 'guarded 403 is unknown, not a proved rejection');
 assert.deepEqual({ actorCalls: observations.actorCalls, appendCalls: observations.appendCalls, rowsCreated: observations.rowsCreated }, beforeServices);
});
observed('final controlled observations', observations);
console.log(JSON.stringify({ status: 'PASS', checks, sources, mode: localRecoveryOnly ? 'local-validation-recovery' : 'integration', controlled_summary: { rows_created: observations.rowsCreated, append_invocations: observations.appendCalls, maximum_capability_batch: observations.capabilityBatches.length ? Math.max(...observations.capabilityBatches.map(batch => batch.length)) : 0 }, limits: 'Actual imported source/Server Functions with strict service/auth/persistence doubles; static React SSR and explicit mocked connected hooks only. No real Next action dispatcher/RSC/hydration/DOM/IAB/browser, live API/Auth/DB/network, build/migration/deployment or backend enforcement proof. Old UI/backend matrices were not executed.' }, null, 2));
