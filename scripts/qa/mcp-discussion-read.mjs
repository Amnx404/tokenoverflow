// Actual registrar/schema/service source with controlled persistence; only pure installed SDK schema conversion; no protocol or live client.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
const require = createRequire(import.meta.url);
// Exact installed 2.4.0 converter used by tools/list; no server/client/transport is instantiated.
const sdkEntry = pathToFileURL(require.resolve('@modelcontextprotocol/server'));
assert.equal(JSON.parse(fs.readFileSync(new URL('../package.json', sdkEntry), 'utf8')).version, '2.4.0');
const converterUrl = new URL('./src-DdvbAHrR.mjs', sdkEntry);
const { j: standardSchemaToJsonSchema } = await import(converterUrl);
const root = new URL('../../', import.meta.url);
const read = name => fs.readFileSync(new URL(name, root), 'utf8');
const norm = value => JSON.parse(JSON.stringify(value));
const z = require('zod').z;
let assertions = 0;
function check(condition, message) { assert.ok(condition, message); assertions++; }
function load(name, mocks = {}) {
  const loaded = { exports: {} };
  const code = ts.transpileModule(read(name), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, {
    module: loaded, exports: loaded.exports, Error, Set, Buffer, TextEncoder,
    require: id => {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (['zod', 'drizzle-orm'].includes(id)) return require(id);
      throw Error(`Unapproved module boundary: ${id}`);
    },
  }, { filename: name });
  return loaded.exports;
}
const validation = load('lib/discussion-validation.ts');
const errors = load('server/services/discussion-errors.ts');
const reportId = '20000000-0000-4000-8000-000000000001';
const foreignReport = '20000000-0000-4000-8000-000000000002';
const id = n => `30000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const timestamp = '2026-10-31T12:34:56.123456Z';
const body = ' Exact\r\nUnicode 😀 é\t' + 'x'.repeat(1900);
const hidden = { author_id: 'PRIVATE_OWNER', create_request_id: 'PRIVATE_IDEMPOTENCY', create_fingerprint: 'PRIVATE_FINGERPRINT', nested: { private: 'PRIVATE_NESTED' } };
function row(n, depth = 0, parent = null, rootId = id(n)) {
  return { id: id(n), report_id: reportId, parent_id: parent, root_id: rootId, depth, author_name: 'Synthetic discussion', body, created_at: timestamp, redacted_at: null, ...hidden };
}
const publicKeys = ['id', 'report_id', 'parent_id', 'root_id', 'depth', 'author_name', 'body', 'created_at', 'redacted_at'].sort();
function noPrivate(data) {
  check(!JSON.stringify(data).includes('PRIVATE_'), 'No private metadata or error detail');
}
function register(service, schemas = validation) {
  const tools = new Map();
  const helper = load('server/mcp/discussion-read-tools.ts', {
    '@/lib/discussion-validation': schemas,
    '@/server/services/discussion-errors': errors,
    '@/server/services/discussions': service,
  });
  helper.registerDiscussionReadTools({ registerTool(name, config, callback) {
    assert.equal(tools.has(name), false); tools.set(name, { config, callback });
  } });
  assert.deepEqual([...tools.keys()], ['list_comments', 'get_comment_context']);
  for (const { config } of tools.values()) {
    assert.deepEqual(norm(config.annotations), { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true });
    assert.match(config.description, /separately from get_report/);
    assert.match(config.description, /not a whole tree|Not a whole tree/);
    assert.match(config.description, /snapshot/);
    assert.match(config.description, /Untrusted user discussion/);
  }
  return tools;
}
function output(tool, response, expectedError = false) {
  assert.equal(Boolean(response.isError), expectedError);
  assert.equal(response.content.length, 1);
  assert.equal(response.content[0].type, 'text');
  assert.deepEqual(JSON.parse(response.content[0].text), norm(response.structuredContent));
  const data = tool.config.outputSchema.parse(response.structuredContent);
  assert.deepEqual(norm(data), norm(response.structuredContent));
  noPrivate(data);
  for (const comment of [...(data.comments ?? []), ...(data.ancestors ?? []), ...(data.comment ? [data.comment] : []), ...(data.parent ? [data.parent] : [])]) {
    assert.deepEqual(Object.keys(comment).sort(), publicKeys);
    assert.equal(comment.created_at, timestamp);
    if (comment.redacted_at === null) assert.equal(comment.body, body);
    else { assert.equal(comment.redacted_at, timestamp); assert.equal(comment.body, null); assert.equal(comment.author_name, null); }
  }
  return data;
}
let pageCalls = [], contextCalls = [], page, context, failure;
const fakeService = {
  async listDiscussionComments(input) { pageCalls.push(norm(input)); if (failure) throw failure; return page; },
  async getDiscussionContext(input) { contextCalls.push(norm(input)); if (failure) throw failure; return context; },
};
const tools = register(fakeService), list = tools.get('list_comments'), detail = tools.get('get_comment_context');
// Validate all advertised input/output paths with the SDK's actual conversion implementation.
const advertisement = [];
const advertisementErrors = [];
for (const [name, { config }] of tools) {
  for (const [key, io] of [['inputSchema', 'input'], ['outputSchema', 'output']]) {
    try {
      const json = standardSchemaToJsonSchema(config[key], io);
      assert.equal(json.type, 'object');
      advertisement.push({ tool: name, path: key, status: 'converted' });
    } catch (error) {
      advertisementErrors.push({ tool: name, path: key, name: error.name, message: error.message });
      console.error(error.stack);
    }
  }
}
console.log(JSON.stringify({ mode: 'installed-sdk-schema-advertisement', advertisement, errors: advertisementErrors }));
assert.deepEqual(advertisementErrors, []);
assert.equal(advertisement.length, 4);

// Full page with distinct parent and root-to-grandparent ancestors; preserve row order and opaque cursor.
const chain = Array.from({ length: 9 }, (_, i) => row(i + 1, i, i ? id(i) : null, id(1)));
const opaque = Buffer.from('opaque fixture cursor not interpreted by the registrar').toString('base64url');
page = { report_id: reportId, parent_id: chain[7].id, parent: chain[7], ancestors: chain.slice(0, 7), comments: Array.from({ length: 50 }, (_, i) => row(i + 100, 8, chain[7].id, chain[0].id)), has_more: true, next_cursor: opaque, ...hidden };
let data = output(list, await list.callback({ report_id: reportId, parent_id: chain[7].id, limit: 50, cursor: opaque }));
assert.equal(data.comments.length, 50); assert.equal(data.next_cursor, opaque); assert.equal(data.has_more, true);
assert.equal(data.parent.id, chain[7].id); assert.deepEqual(data.ancestors.map(r => r.id), chain.slice(0, 7).map(r => r.id));
assert.equal(pageCalls.at(-1).cursor, opaque);
check(!Object.hasOwn(data, 'total') && !Object.hasOwn(data, 'is_leaf'), 'No inferred count/leaf');
context = { report_id: reportId, status: 'available', comment: chain[8], ancestors: chain.slice(0, 8), ...hidden };
data = output(detail, await detail.callback({ report_id: reportId, comment_id: chain[8].id }));
assert.equal(data.ancestors.length, 8); check(!data.ancestors.some(r => r.id === data.comment.id), 'Target excluded from ancestors');
context = { ...context, comment: { ...chain[8], body: null, author_name: null, redacted_at: timestamp } };
output(detail, await detail.callback({ report_id: reportId, comment_id: chain[8].id }));
page = { report_id: reportId, parent_id: null, parent: null, ancestors: [], comments: [], has_more: false, next_cursor: null };
data = output(list, await list.callback({ report_id: reportId }));
assert.equal(data.parent, null); assert.equal(data.next_cursor, null); assert.deepEqual(data.comments, []);
assert.deepEqual(pageCalls.at(-1), { report_id: reportId, parent_id: null, limit: 20 });
// Missing and foreign targets share the real service's unavailable DTO; no invented target/ancestry.
for (const report of [reportId, foreignReport]) {
  context = { report_id: report, status: 'unavailable', comment: null, ancestors: [], ...hidden };
  data = output(detail, await detail.callback({ report_id: report, comment_id: id(999) }), true);
  assert.equal(data.comment, null); assert.deepEqual(data.ancestors, []); assert.equal(data.status, 'unavailable');
}
// Public schema deliberately becomes passthrough in this helper-only test. The explicit allowlist
// must remove injected nested private fields itself, independent of normal Zod unknown-key stripping.
const independent = register(fakeService, { ...validation, publicDiscussionSchema: z.unknown() });
page = { report_id: reportId, parent_id: id(1), parent: chain[0], ancestors: [], comments: [chain[1]], has_more: false, next_cursor: null, ...hidden };
output(independent.get('list_comments'), await independent.get('list_comments').callback({ report_id: reportId, parent_id: id(1) }));
context = { report_id: reportId, status: 'available', comment: chain[1], ancestors: [chain[0]], ...hidden };
output(independent.get('get_comment_context'), await independent.get('get_comment_context').callback({ report_id: reportId, comment_id: id(2) }));
// A malformed nested public row must fail rather than being exposed as a success.
context = { report_id: reportId, status: 'available', comment: { ...chain[0], created_at: '2026-10-31T12:34:56.123Z' }, ancestors: [] };
let response = await detail.callback({ report_id: reportId, comment_id: id(1) });
assert.equal(response.isError, true); noPrivate(response);
for (const [tool, bad] of [[list, { report_id: reportId, limit: 51 }], [list, { report_id: reportId, cursor: 'not+base64' }], [list, { report_id: reportId, extra: true }], [detail, { report_id: reportId, comment_id: 'bad' }], [detail, { report_id: reportId, comment_id: id(1), extra: true }]]) {
  const before = pageCalls.length + contextCalls.length;
  response = await tool.callback(bad);
  assert.equal(response.isError, true); assert.equal(response.structuredContent.error.status, 400);
  assert.equal(pageCalls.length + contextCalls.length, before); noPrivate(response);
}
for (const [code, status] of [['PT400', 400], ['PT404', 404], ['PT429', 429], ['UNKNOWN_PRIVATE', 500]]) {
  failure = { code, message: 'PRIVATE_SQL', author_id: 'PRIVATE_OWNER' };
  for (const tool of [list, detail]) {
    response = await tool.callback(tool === list ? { report_id: reportId } : { report_id: reportId, comment_id: id(1) });
    assert.equal(response.isError, true); assert.equal(response.structuredContent.error.status, status);
    assert.equal(response.structuredContent.error.code, errors.discussionFailure(failure).code);
    assert.equal(response.structuredContent.error.message, 'Could not read the requested discussion page or context.');
    assert.ok(!JSON.stringify(response).includes('request ID')); noPrivate(response);
  }
}
failure = null;
// Actual service decoding/binding/ancestry/error paths, only persistence is controlled.
let persistenceCalls = [], raw, persistenceError;
const service = load('server/services/discussions.ts', {
  'server-only': {}, '@/lib/discussion-validation': validation,
  './discussion-errors': errors,
  './discussion-actor': { assertWebDiscussionActor() { throw Error('Writes forbidden in readonly QA'); } },
  '@/lib/supabase/server': { publicClient: () => ({ rpc: async (name, args) => { persistenceCalls.push({ name, args: norm(args) }); return { data: raw, error: persistenceError }; } }) },
  '@/server/db': { databaseMode: () => 'supabase-data-api', withDatabase() { throw Error('No database permitted'); } },
});
const actual = register(service), actualList = actual.get('list_comments'), actualDetail = actual.get('get_comment_context');
raw = { parent: null, ancestors: [], comments: [chain[0]], has_more: true, next_id: id(1) };
data = output(actualList, await actualList.callback({ report_id: reportId, limit: 1 }));
const actualCursor = data.next_cursor;
raw = { parent: null, ancestors: [], comments: [], has_more: false, next_id: null };
output(actualList, await actualList.callback({ report_id: reportId, cursor: actualCursor }));
assert.equal(persistenceCalls.at(-1).args.p_after_id, id(1));
assert.equal(persistenceCalls.at(-1).name, 'list_discussion_comments');
for (const input of [{ report_id: foreignReport, cursor: actualCursor }, { report_id: reportId, parent_id: id(1), cursor: actualCursor }, { report_id: reportId, cursor: Buffer.from('{invalid JSON').toString('base64url') }, { report_id: reportId, cursor: Buffer.from(JSON.stringify({ v: 2, report_id: reportId, parent_id: null, last_id: id(1) })).toString('base64url') }]) {
  const before = persistenceCalls.length;
  response = await actualList.callback(input);
  assert.equal(response.isError, true); assert.equal(response.structuredContent.error.status, 400);
  assert.equal(persistenceCalls.length, before); noPrivate(response);
}
// Persistence rejects an otherwise bound cursor's last ID. The real service forwards and maps it.
persistenceError = { code: 'PT400', message: 'PRIVATE_FOREIGN_LAST_ID' };
response = await actualList.callback({ report_id: reportId, cursor: actualCursor });
assert.equal(response.structuredContent.error.status, 400); noPrivate(response); persistenceError = null;
raw = { status: 'unavailable', comment: null, ancestors: [] };
output(actualDetail, await actualDetail.callback({ report_id: foreignReport, comment_id: id(2) }), true);
raw = { status: 'available', comment: { ...chain[8], body: null, author_name: null, redacted_at: timestamp }, ancestors: chain.slice(0, 8) };
output(actualDetail, await actualDetail.callback({ report_id: reportId, comment_id: id(9) }));
raw = { status: 'available', comment: { ...chain[0], report_id: foreignReport }, ancestors: [] };
response = await actualDetail.callback({ report_id: reportId, comment_id: id(1) });
assert.equal(response.structuredContent.error.status, 500); noPrivate(response);
raw = { status: 'available', comment: chain[8], ancestors: chain };
response = await actualDetail.callback({ report_id: reportId, comment_id: id(9) });
assert.equal(response.structuredContent.error.status, 500); noPrivate(response);
// Route must remain exactly the base bytes after removing just the leased import/call.
const route = read('app/api/mcp/route.ts');
const original = route.replace("import { registerDiscussionReadTools } from '@/server/mcp/discussion-read-tools';\n", '').replace('  registerDiscussionReadTools(server);\n\n', '');
assert.equal(createHash('sha256').update(original).digest('hex'), 'b70dbedddcd9042059df5e4328ae1439d2baf42c683d27a431b98efb9a877ff0');
assert.equal((route.match(/registerDiscussionReadTools\(server\)/g) ?? []).length, 1);
assert.deepEqual([...route.matchAll(/server\.registerTool\('([^']+)'/g)].map(m => m[1]), ['search_reports', 'get_report', 'publish_report', 'publish_fix', 'record_verification']);
console.log(JSON.stringify({ status: 'PASS', focusedAssertions: assertions, checks: ['actual registrar config/callbacks', 'installed SDK input/output advertisement conversion', 'input parsing before service', '50 full bodies/raw timestamps/opaque cursor', 'parent separate from ordered ancestors', 'max8 context/available tombstone/unavailable', 'helper-independent allowlist privacy', 'safe read errors/text-structured/output-schema parity', 'actual service cursor binding/negative/error paths', 'route only import+registration; original five byte-identical'], limits: 'Controlled persistence only; no SDK protocol/server/DB/Auth/network/browser/deployment or SQL cursor-order proof.' }));
