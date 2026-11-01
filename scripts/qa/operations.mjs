// Synthetic metadata only; no network, credentials, user data or listening server.
// Run: node scripts/qa/operations.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
async function discussionChecks() {
 const baselineArg = process.argv.indexOf('--baseline-root');
 assert(baselineArg >= 0 && process.argv[baselineArg + 1], 'Supply exact archived baseline root');
 const baseline = new URL(`file://${process.argv[baselineArg + 1]}/`);
 const root = new URL('../../', import.meta.url);
 const norm = value => JSON.parse(JSON.stringify(value));
 const read = (name, before = false) => fs.readFileSync(new URL(name, before ? baseline : root), 'utf8');
 const logs = [], captures = [], starts = [];
 const sentinel = 'PRIVATE_fixture@example.invalid token=PRIVATE_fixture SELECT PRIVATE';
 const forged = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 const env = { TOKENOVERFLOW_TELEMETRY_ENABLED: 'true', POSTHOG_PROJECT_TOKEN: 'phc_controlled_no_network', POSTHOG_HOST: 'https://us.i.posthog.com', VERCEL_ENV: 'production', TOKENOVERFLOW_RELEASE: 'f'.repeat(40) };
 function load(name, mocks = {}, before = false, globals = {}) {
  const loaded = { exports: {} };
  const code = ts.transpileModule(read(name, before), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module: loaded, exports: loaded.exports, require: id => {
   if (Object.hasOwn(mocks, id)) return mocks[id];
   if (['zod', 'node:crypto'].includes(id)) return require(id);
   throw new Error('Unapproved controlled import');
  }, Error, Set, Buffer, URL, Request, Response, Headers, TextEncoder, performance, process: { env }, console: { error: line => logs.push(line) }, ...globals }, { filename: name });
  return loaded.exports;
 }
 const shared = load('lib/telemetry-shared.ts');
 const sink = load('lib/telemetry-server.ts', { 'server-only': {}, 'next/server': { after: () => assert.fail('No lifecycle or SDK delivery in focused schema check') }, './telemetry-shared': shared, './telemetry-queue': { createTelemetryQueue: () => ({ enqueue: event => captures.push(norm(event)) }) } });
 const real = load('lib/observability.ts', { 'server-only': {}, './telemetry-server': sink });
 const observation = { ...real, startOperation: (...args) => { starts.push(args); return real.startOperation(...args); } };
 const baselineObservation = { requestTelemetryContext: sink.requestTelemetryContext, startOperation: () => ({ requestId: forged, complete() {}, fail() {}, finish: response => response }) };
 const validation = load('lib/discussion-validation.ts');
 const errors = load('server/services/discussion-errors.ts');
 const report = '20000000-0000-4000-8000-000000000001';
 const comment = '30000000-0000-4000-8000-000000000001';
 const stamp = '2026-10-31T12:34:56.123456Z';
 const row = { id: comment, report_id: report, parent_id: null, root_id: comment, depth: 0, author_name: sentinel, body: sentinel, created_at: stamp, redacted_at: null };
 const page = { report_id: report, parent_id: null, parent: null, ancestors: [], comments: [row], has_more: false, next_cursor: null };
 const available = { report_id: report, status: 'available', comment: row, ancestors: [] };
 const tombstone = { ...available, comment: { ...row, body: null, author_name: null, redacted_at: stamp } };
 const unavailable = { report_id: report, status: 'unavailable', comment: null, ancestors: [] };
 let value = page, failure = null;
 const service = { listDiscussionComments: async () => { if (failure) throw failure; return value; }, getDiscussionContext: async () => { if (failure) throw failure; return value; } };
 const deps = { '@/lib/discussion-validation': validation, '@/server/services/discussions': service, '@/server/services/discussion-errors': errors, '@/lib/observability': observation };
 const oldDeps = { ...deps, '@/lib/observability': baselineObservation };
 const pagePath = 'app/api/v1/reports/[id]/comments/route.ts';
 const contextPath = 'app/api/v1/reports/[id]/comments/[commentId]/route.ts';
 const current = [load(pagePath, deps), load(contextPath, deps)];
 const original = [load(pagePath, oldDeps, true), load(contextPath, oldDeps, true)];
 const schemas = new Map();
 let checked = 0;
 function sample(beforeCount, route, operation, status, id, synthetic = true) {
  assert.equal(captures.length, beforeCount + 1, 'Exactly one accepted terminal sample');
  const event = captures.at(-1), p = event.properties;
  assert.equal(event.event, 'to_operation_completed');
  assert.equal(p.route, route); assert.equal(p.operation, operation); assert.equal(p.status, status);
  assert.equal(p.scope, 'operation'); assert.equal(p.request_id, id);
  assert.equal(p.traffic_class, synthetic ? 'synthetic' : 'unclassified');
  assert.equal(p.outcome, status < 400 ? 'success' : status < 500 ? 'expected_rejection' : 'failure');
  assert.equal(p.release, env.TOKENOVERFLOW_RELEASE); assert.equal(p.environment, 'production');
  assert(Number.isInteger(p.duration_ms));
  assert(!JSON.stringify(captures).includes(sentinel)); assert(!logs.join('').includes(sentinel));
  for (const line of logs) assert.deepEqual(Object.keys(JSON.parse(line)).sort(), ['schema_version', 'event', 'request_id', 'route', 'operation', 'status', 'duration_ms', 'error_code'].sort());
  checked++;
 }
 const restCases = [
  [0, page, null, '', 200], [0, page, null, '?unknown=PRIVATE_fixture', 400],
  [0, page, { code: 'PT404', message: sentinel }, '', 404], [0, page, new Error(sentinel), '', 500],
  [1, available, null, '', 200], [1, tombstone, null, '', 200], [1, unavailable, null, '', 404],
  [1, available, null, '?secret=PRIVATE_fixture', 400], [1, available, { code: 'PT429', message: sentinel }, '', 429], [1, available, new Error(sentinel), '', 500],
 ];
 for (const [which, output, err, query, status] of restCases) {
  value = output; failure = err;
  const request = () => new Request(`https://controlled.invalid/comments${query}`, { headers: { 'X-Request-ID': forged, 'X-TokenOverflow-Synthetic': '1', authorization: sentinel, cookie: sentinel } });
  const params = () => ({ params: Promise.resolve({ id: report, ...(which ? { commentId: comment } : {}) }) });
  const old = await original[which].GET(request(), params()); const body = await old.text();
  const beforeCount = captures.length, logCount = logs.length;
  const actual = await current[which].GET(request(), params());
  assert.equal(await actual.text(), body); assert.equal(actual.status, old.status); assert.equal(actual.status, status);
  const headers = Object.fromEntries(actual.headers); delete headers['x-request-id'];
  assert.deepEqual(headers, Object.fromEntries(old.headers)); assert.equal(headers['cache-control'], 'no-store'); assert(!('x-content-type-options' in headers));
  const id = actual.headers.get('x-request-id'); assert.match(id, /^[0-9a-f-]{36}$/); assert.notEqual(id, forged);
  const route = which ? '/api/v1/reports/[id]/comments/[commentId]' : '/api/v1/reports/[id]/comments';
  sample(beforeCount, route, which ? 'get_comment_context' : 'list_comments', status, id);
  assert.equal(logs.length - logCount, status >= 400 ? 1 : 0, 'Success silent, failure-only console');
 }
 // Start precedes params await; rejected params retain the original safe 500 response.
 const startCount = starts.length, capCount = captures.length;
 const rejectedParams = new Promise((_, reject) => { queueMicrotask(() => reject(new Error(sentinel))); });
 const pending = current[0].GET(new Request('https://controlled.invalid/comments'), { params: rejectedParams });
 assert.equal(starts.length, startCount + 1);
 const rejected = await pending; assert.equal(rejected.status, 500);
 sample(capCount, '/api/v1/reports/[id]/comments', 'list_comments', 500, rejected.headers.get('x-request-id'), false);
 function register(before = false) {
  const tools = new Map();
  const helper = load('server/mcp/discussion-read-tools.ts', before ? oldDeps : deps, before);
  const context = { requestId: '40000000-0000-4000-8000-000000000001', synthetic: true };
  helper.registerDiscussionReadTools({ registerTool: (name, config, callback) => { tools.set(name, callback); schemas.set(name, config); } }, context);
  return { tools, helper, context };
 }
 const prior = register(true), next = register();
 for (const [name, output, err, args, status] of [
  ['list_comments', page, null, { report_id: report }, 200],
  ['list_comments', page, null, { report_id: 'PRIVATE_fixture' }, 400],
  ['list_comments', page, { code: 'PT404', message: sentinel }, { report_id: report }, 404],
  ['list_comments', page, new Error(sentinel), { report_id: report }, 500],
  ['get_comment_context', tombstone, null, { report_id: report, comment_id: comment }, 200],
  ['get_comment_context', unavailable, null, { report_id: report, comment_id: comment }, 404],
  ['get_comment_context', available, null, { report_id: report, comment_id: 'PRIVATE_fixture' }, 400],
  ['get_comment_context', available, { code: 'PT429', message: sentinel }, { report_id: report, comment_id: comment }, 429],
  ['get_comment_context', { ...available, comment: { ...row, created_at: 'invalid' } }, null, { report_id: report, comment_id: comment }, 400],
 ]) {
  value = output; failure = err;
  const expected = await prior.tools.get(name)(args), beforeCount = captures.length, logCount = logs.length;
  const actual = await next.tools.get(name)(args);
  assert.deepEqual(norm(actual), norm(expected));
  assert.deepEqual(JSON.parse(actual.content[0].text), norm(actual.structuredContent));
  assert.equal(Boolean(actual.isError), status >= 400);
  if (status < 400 || actual.structuredContent.status === 'unavailable') schemas.get(name).outputSchema.parse(actual.structuredContent);
  sample(beforeCount, '/api/mcp', name, status, next.context.requestId);
  assert.equal(logs.length - logCount, status >= 400 ? 1 : 0);
 }
 // Run actual serve/factory against a controlled SDK handler boundary. No SDK
 // transport or server is instantiated; SDK pre-callback rejection remains transport-only.
 let currentTools, registrarContext, sdkReject = false;
 const strictValidation = load('lib/validation.ts', { './types': load('lib/types.ts') });
 const factoryDeps = {
  ...deps, '@/lib/validation': strictValidation, '@/lib/api': {}, '@/lib/data': {}, '@/server/services/reports': {}, '@/lib/mcp-evidence': {}, '@/server/services/contribution-source': {},
  '@/server/mcp/discussion-read-tools': { registerDiscussionReadTools(server, context) { registrarContext = context; next.helper.registerDiscussionReadTools(server, context); } },
  '@modelcontextprotocol/server': {
   McpServer: class { constructor() { currentTools = new Map(); } registerTool(name, config, callback) { currentTools.set(name, callback); } },
   hostHeaderValidationResponse: () => null, originValidationResponse: () => null,
   createMcpHandler: factory => ({ fetch: async request => {
    factory({ requestInfo: { headers: request.headers } });
    if (sdkReject) return Response.json({ jsonrpc: '2.0', id: 1, error: { code: -32602, message: 'Controlled pre-callback rejection' } });
    const rpc = await request.json(); const result = await currentTools.get(rpc.params.name)(rpc.params.arguments);
    return Response.json({ jsonrpc: '2.0', id: 1, result });
   } }),
  },
 };
 const route = load('app/api/mcp/route.ts', factoryDeps);
 for (const [args, status] of [[{ report_id: report }, 200], [{ report_id: report, requestId: forged, synthetic: false }, 400]]) {
  value = page; failure = null;
  const count = captures.length;
  const response = await route.POST(new Request('https://controlled.invalid/api/mcp', { method: 'POST', headers: { 'content-type': 'application/json', 'X-Request-ID': forged, 'X-TokenOverflow-Synthetic': '1' }, body: JSON.stringify({ params: { name: 'list_comments', arguments: args } }) }));
  assert.equal(response.status, 200); const wire = await response.json();
  assert.equal(Boolean(wire.result.isError), status >= 400);
  assert.deepEqual(JSON.parse(wire.result.content[0].text), wire.result.structuredContent);
  const id = response.headers.get('x-request-id'); assert.notEqual(id, forged);
  assert.deepEqual(Object.keys(registrarContext).sort(), ['requestId', 'synthetic']); assert.equal(registrarContext.requestId, id); assert.equal(registrarContext.synthetic, true);
  assert.equal(captures.length, count + 2);
  const logical = captures[count], transport = captures[count + 1];
  assert.equal(logical.properties.request_id, id); assert.equal(logical.properties.operation, 'list_comments'); assert.equal(logical.properties.status, status);
  assert.equal(transport.properties.request_id, id); assert.equal(transport.properties.scope, 'transport'); assert.equal(transport.properties.status, 200);
 }
 sdkReject = true; const pre = captures.length;
 const rejectedWire = await route.POST(new Request('https://controlled.invalid/api/mcp', { method: 'POST', headers: { 'X-TokenOverflow-Synthetic': '1' }, body: '{}' }));
 assert.equal(rejectedWire.status, 200); assert.equal(captures.length, pre + 1); assert.equal(captures.at(-1).properties.scope, 'transport');
 // Strict sink rejects unknown labels and extra raw fields; only the admitted
 // templates/tool names reached captures above. Disabled capture stays no-op.
 const schemaInput = { route: '/api/mcp', operation: 'list_comments', status: 200, duration_ms: 1, request_id: next.context.requestId, error_code: null, scope: 'operation', synthetic: true };
 assert.equal(sink.operationTelemetrySchema.safeParse(schemaInput).success, true);
 const acceptedCount = captures.length;
 for (const bad of [{ ...schemaInput, operation: sentinel }, { ...schemaInput, route: `/api/mcp?${sentinel}` }, { ...schemaInput, payload: sentinel }]) sink.captureOperationTelemetry(bad);
 assert.equal(captures.length, acceptedCount);
 env.TOKENOVERFLOW_TELEMETRY_ENABLED = 'false'; value = page; failure = null;
 const disabled = await current[0].GET(new Request('https://controlled.invalid/comments'), { params: Promise.resolve({ id: report }) });
 assert.equal(disabled.status, 200);
 await next.tools.get('list_comments')({ report_id: report });
 assert.equal(captures.length, acceptedCount);
 assert(!JSON.stringify(captures).includes(sentinel)); assert(!logs.join('').includes(sentinel));
 console.log(JSON.stringify({ status: 'PASS', mode: 'discussion', terminal_contract_cases: checked, controlled_samples: captures.length, checks: ['actual archived before/post REST JSON/status/header equality', 'internally generated UUID before params, inbound ID ignored', 'actual registrar DTO/error/tombstone/text-structured parity', 'logical mapped status and terminal-once strict sink admission', 'actual serve/factory trusted UUID + synthetic-only context', 'controlled SDK pre-callback rejection transport-only', 'wire HTTP200 versus logical failure', 'disabled no-op, failure-only eight-field console and sentinel exclusion'], limits: 'Controlled in-process module/schema boundaries only; no real SDK protocol/converter, queue delivery, browser/server/DB/Auth/provider/network/cloud/project ingestion or deployed attribution.' }));
}

if(process.argv.includes('--discussion')) { await discussionChecks(); } else {
const testModule={exports:{}};
const source=fs.readFileSync(new URL('../../lib/observability.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(code,{module:testModule,exports:testModule.exports,require:name=>name==='server-only'?{}:name==='./telemetry-server'?{captureOperationTelemetry:()=>{},requestTelemetryContext:()=>({synthetic:true})}:require(name),performance,console});
const {startOperation}=testModule.exports;
const lines=[];
const original=console.error;
console.error=line=>lines.push(line);
try {
 const secret='synthetic-secret@example.invalid?token=synthetic-token';
 const op=startOperation('/api/v1/reports','search_reports',secret);
 const response=op.finish(Response.json({error:secret},{status:503}));
 op.fail(500,'INTERNAL_ERROR');
 assert.equal(lines.length,1,'An operation should emit one failure event');
 const event=JSON.parse(lines[0]);
 assert.deepEqual(Object.keys(event).sort(),['schema_version','event','request_id','route','operation','status','duration_ms','error_code'].sort());
 assert.match(event.request_id,/^[a-f0-9-]{36}$/);
 assert.equal(response.headers.get('x-request-id'),event.request_id);
 assert.equal(event.error_code,'DEPENDENCY_UNAVAILABLE');
 assert.equal(event.status,503);
 assert.ok(Number.isInteger(event.duration_ms)&&event.duration_ms>=0);
 assert.ok(!lines[0].includes(secret));
 assert.ok(!lines[0].includes('token=')&&!lines[0].includes('@'));
 startOperation('/api/v1/reports','search_reports').finish(Response.json({reports:[]}));
 assert.equal(lines.length,1,'Successful requests are not logged');
 const correlated=startOperation('/api/mcp','get_report',event.request_id);
 correlated.fail(404);
 assert.equal(JSON.parse(lines[1]).request_id,event.request_id);
 assert.equal(JSON.parse(lines[1]).error_code,'NOT_FOUND');
 const healthModule={exports:{}};
 const healthSource=fs.readFileSync(new URL('../../app/api/health/route.ts',import.meta.url),'utf8');
 const healthCode=ts.transpileModule(healthSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(healthCode,{module:healthModule,exports:healthModule.exports,setTimeout,clearTimeout,Promise,require:name=>{
  if(name==='@/lib/api')return {apiJson:(data,status)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}})};
  if(name==='@/lib/observability')return {startOperation};
  if(name==='@/server/services/health')return {backendHealthy:async()=>false,hasPublicServiceConfiguration:()=>false};
  throw new Error('Unexpected health import');
 }});
 const degraded=await healthModule.exports.GET();
 assert.equal(degraded.status,503);
 assert.deepEqual(await degraded.json(),{status:'degraded'});
 assert.equal(degraded.headers.get('cache-control'),'no-store');
 assert.equal(JSON.parse(lines.at(-1)).error_code,'CONFIGURATION_MISSING');
 assert.equal(degraded.headers.get('x-request-id'),JSON.parse(lines.at(-1)).request_id);
}finally{console.error=original;}
console.log('PASS failure event allowlist, secret exclusion, correlation, deduplication, success silence and degraded health contract');

}
