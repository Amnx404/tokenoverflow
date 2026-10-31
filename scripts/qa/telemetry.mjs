// Controlled capture sink: actual pinned PostHog SDK serialization, no network,
// project token, customer data, real identity or listening server.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { gunzipSync } from 'node:zlib';
import { PostHog as ActualPostHog } from 'posthog-node';
// Assertion diffs may contain the deliberate private-payload sentinel.
process.on('uncaughtException', () => {
 console.error('Controlled telemetry suite failed; assertion details suppressed for fixture privacy.');
 process.exitCode = 1;
});
const require = createRequire(import.meta.url);
const root = new URL('../../', import.meta.url);
function load(file, mocks = {}, globals = {}) {
 const testModule = { exports: {} };
 const code = ts.transpileModule(fs.readFileSync(new URL(file, root), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
 vm.runInNewContext(code, { module: testModule, exports: testModule.exports, require: name => name in mocks ? mocks[name] : require(name), console, performance, Response, Request, Headers, URL, AbortSignal, TextEncoder, TextDecoder, Uint8Array, setTimeout, clearTimeout, ...globals });
 return testModule.exports;
}
const sentinel = 'SECRET@example.invalid?query=private-prompt&token=private-key SELECT private_params';
const env = { POSTHOG_PROJECT_TOKEN: 'phc_synthetic_fixture', POSTHOG_HOST: 'https://us.i.posthog.com', TOKENOVERFLOW_TELEMETRY_ENABLED: 'true', TOKENOVERFLOW_RELEASE: 'f'.repeat(40), VERCEL_ENV: 'production', NODE_ENV: 'production' };
const requests = [];
const callbacks = [];
let failDelivery = false;
let rejectedDeliveryAttempts = 0;
class CapturePostHog extends ActualPostHog {
 constructor(token, options) {
  assert.equal(token, env.POSTHOG_PROJECT_TOKEN);
  assert.equal(options.enableExceptionAutocapture, false);
  assert.equal(options.enableLocalEvaluation, false);
  assert.equal(options.disableGeoip, true);
  assert.equal(options.fetchRetryCount, 0);
  assert.equal(options.requestTimeout, 1000);
  super(token, { ...options, fetch: async (url, request) => {
   if (failDelivery === 'timeout') await new Promise((_, reject) => request.signal.addEventListener('abort', () => reject(new Error(sentinel)), { once: true }));
   if (failDelivery === 'http503') { rejectedDeliveryAttempts++; return new Response(sentinel, { status: 503 }); }
   if (failDelivery) throw new Error(sentinel);
   const raw = typeof request.body === 'string' ? request.body : request.body instanceof Blob ? Buffer.from(await request.body.arrayBuffer()) : Buffer.from(request.body);
   const body = request.headers['Content-Encoding'] === 'gzip' ? gunzipSync(raw).toString() : String(raw);
   requests.push({ url, body: JSON.parse(body) });
   return new Response('{"status":1}', { status: 200 });
  } });
 }
}
const shared = load('lib/telemetry-shared.ts');
const queueModule = load('lib/telemetry-queue.ts');
let sdkModuleAccesses = 0;
const sdkMocks = { get 'posthog-node'() { sdkModuleAccesses++; return { PostHog: CapturePostHog }; } };
const disabledServer = load('lib/telemetry-server.ts', { 'server-only': {}, 'next/server': { after: () => assert.fail('Disabled capture must not schedule') }, get 'posthog-node'() { return sdkMocks['posthog-node']; }, './telemetry-queue': queueModule, './telemetry-shared': shared }, { process: { env: { ...env, TOKENOVERFLOW_TELEMETRY_ENABLED: 'false' } } });
disabledServer.captureServerRenderError('/', 'render');
await disabledServer.deliverTelemetryBatch([{ event: 'to_page_view', properties: { route: '/' } }]);
assert.equal(sdkModuleAccesses, 0, 'Fresh disabled server does not access SDK module');
let authHeaderReads = 0;
const server = load('lib/telemetry-server.ts', { 'next/headers': { headers: async () => ({ get: name => { assert.equal(name, 'X-TokenOverflow-Synthetic'); authHeaderReads++; return '1'; } }) }, 'server-only': {}, 'next/server': { after: work => callbacks.push(work) }, get 'posthog-node'() { return sdkMocks['posthog-node']; }, './telemetry-queue': queueModule, './telemetry-shared': shared }, { process: { env } });
const lines = [];
const observation = load('lib/observability.ts', { 'server-only': {}, './telemetry-server': server }, { console: { error: line => lines.push(line) } });
const flush = async () => { while (callbacks.length) await callbacks.shift()(); };
const operation = observation.startOperation('/api/v1/reports', 'search_reports', sentinel);
operation.finish(Response.json({ query: sentinel }));
operation.fail(500); // Terminal deduplication must retain the original success.
const denied = observation.startOperation('/api/mcp', 'publish_fix', undefined, { synthetic: true });
denied.fail(401);
denied.finish(Response.json({ error: sentinel }, { status: 401 }));
observation.startOperation('/api/mcp', 'mcp_transport', denied.requestId, { synthetic: true, scope: 'transport' }).complete(200);
observation.startOperation('/api/trpc', 'get_report').fail(503, 'DEPENDENCY_UNAVAILABLE');
assert.equal(lines.length, 2);
assert.equal(Object.keys(JSON.parse(lines[0])).length, 8, 'Existing failure log schema stays eight fields');
assert(!lines.join('').includes(sentinel));
assert.equal(requests.length, 0, 'SDK delivery is scheduled after the response');
assert.equal(sdkModuleAccesses, 0, 'Enabled capture does not access SDK before lifecycle callback');
await flush();
assert.equal(requests.length, 1);
assert.equal(sdkModuleAccesses, 1, 'First lifecycle delivery loads SDK');
const events = requests[0].body.batch;
assert.equal(events.length, 4);
assert.deepEqual(events.map(e => e.properties.outcome), ['success', 'expected_rejection', 'success', 'failure']);
assert.equal(events[0].properties.traffic_class, 'unclassified');
assert.equal(events[1].properties.traffic_class, 'synthetic');
assert.equal(events[1].properties.request_id, events[2].properties.request_id);
assert.equal(events[1].properties.scope, 'operation');
assert.equal(events[2].properties.scope, 'transport');
for (const event of events) {
 assert.equal(event.properties.release, 'f'.repeat(40));
 assert.equal(event.properties.$process_person_profile, false);
 assert.equal(event.properties.$geoip_disable, true);
 assert.match(event.distinct_id, /^event:[a-f0-9-]{36}$/);
 assert(Number.isInteger(event.properties.duration_ms));
 assert(!('$current_url' in event.properties));
 assert(!('$ip' in event.properties));
 assert(!('$session_id' in event.properties));
 assert(!('$set' in event.properties));
}
assert(!JSON.stringify(requests).includes(sentinel));

const framework = load('instrumentation.ts', { './lib/telemetry-server': server }, { process: { env: { NEXT_RUNTIME: 'nodejs' } } });
await framework.onRequestError(new Error(sentinel), { path: `/reports/11111111-1111-4111-8111-111111111111?q=${encodeURIComponent(sentinel)}`, headers: { authorization: sentinel } }, { routeType: 'render' });
await flush();
const renderError = requests.at(-1).body.batch[0];
assert.equal(renderError.event, 'to_server_render_error');
assert.equal(renderError.properties.route, '/reports/[id]');
assert.equal(renderError.properties.route_type, 'render');
assert(!JSON.stringify(requests).includes(sentinel));
await framework.onRequestError(new Error(sentinel), { path: `/reports/new?input=${encodeURIComponent(sentinel)}`, headers: { cookie: sentinel } }, { routeType: 'action' });
await flush();
const actionError = requests.at(-1).body.batch[0];
assert.equal(actionError.event, 'to_server_render_error');
assert.equal(actionError.properties.route, '/reports/new');
assert.equal(actionError.properties.route_type, 'action');
assert(!JSON.stringify(requests).includes(sentinel));
const beforeExcludedFramework = requests.length;
for (const routeType of ['route', 'proxy']) await framework.onRequestError(new Error(sentinel), { path: '/api/telemetry' }, { routeType });
const edgeFramework = load('instrumentation.ts', { './lib/telemetry-server': server }, { process: { env: { NEXT_RUNTIME: 'edge' } } });
await edgeFramework.onRequestError(new Error(sentinel), { path: '/' }, { routeType: 'render' });
await flush();
assert.equal(requests.length, beforeExcludedFramework, 'Route/proxy and edge errors do not duplicate operation events');

const route = load('app/api/telemetry/route.ts', { '@/lib/telemetry-server': server }, { process: { env } });
const valid = { event: 'to_page_view', route: '/reports/[id]', duration_ms: 12, timing_kind: 'initial_observer_commit', synthetic: true };
function request(body, extra = {}) {
 return new Request('https://tokenoverflow.app/api/telemetry', { method: 'POST', headers: { origin: 'https://tokenoverflow.app', 'content-type': 'application/json', cookie: sentinel, 'user-agent': sentinel, ...extra }, body: typeof body === 'string' ? body : JSON.stringify(body) });
}
const accepted = await route.POST(request(valid));
assert.equal(accepted.status, 204);
assert.match(accepted.headers.get('x-request-id'), /^[a-f0-9-]{36}$/);
assert.equal((await route.POST(request({ ...valid, query: sentinel }))).status, 400);
assert.equal((await route.POST(request({ ...valid, route: `/?q=${sentinel}` }))).status, 400);
assert.equal((await route.POST(request({ ...valid, event: '$identify' }))).status, 400);
assert.equal((await route.POST(request({ ...valid, duration_ms: -1 }))).status, 400);
assert.equal((await route.POST(request('x'.repeat(1600)))).status, 413);
assert.equal((await route.POST(request(valid, { origin: 'https://attacker.invalid' }))).status, 403);
assert.equal((await route.POST(request(valid, { host: 'attacker.invalid' }))).status, 403);
assert.equal((await route.POST(request(valid, { 'content-type': 'text/plain' }))).status, 415);
await flush();
const browser = requests.at(-1).body.batch[0];
assert.equal(browser.event, 'to_page_view');
assert.equal(browser.properties.route, '/reports/[id]');
assert.equal(browser.properties.request_id, accepted.headers.get('x-request-id'));
assert(!JSON.stringify(requests).includes(sentinel));

// Signup remains a categorical submit intent; no auth fields or URL values.
const signupRoute = shared.telemetryPage(`/signup?input=${encodeURIComponent(sentinel)}#${encodeURIComponent(sentinel)}`);
assert.equal(signupRoute, '/signup');
const signupAccepted = await route.POST(request({ event: 'to_ui_action', route: signupRoute, action: 'signup_submit', synthetic: true }));
assert.equal(signupAccepted.status, 204);
await flush();
const signupEvent = requests.at(-1).body.batch[0];
assert.equal(signupEvent.properties.route, '/signup');
assert.equal(signupEvent.properties.action, 'signup_submit');
assert.equal(signupEvent.properties.request_id, signupAccepted.headers.get('x-request-id'));
assert(!JSON.stringify(requests).includes(sentinel));

// Execute actual auth modules with controlled provider calls and real Next
// redirect control flow; wire capture below is the installed PostHog SDK.
const authValidation = load('lib/validation.ts', { './types': load('lib/types.ts') });
const authConfig = load('lib/auth-config.ts', { 'server-only': {}, './validation': authValidation }, { process: { env: { NODE_ENV: 'production', AUTH_SITE_URL: 'https://tokenoverflow.app' } } });
const actualRedirect = require('next/navigation').redirect;
const norm = value => JSON.parse(JSON.stringify(value));
const authUser = { id: sentinel, email: 'auth-private@example.invalid' };
const authSession = { access_token: sentinel, refresh_token: sentinel };
const authGood = { data: { user: authUser, session: authSession }, error: null };
function authForm() {
 const value = new FormData();
 value.set('email', '  auth-private@example.invalid  '); value.set('password', sentinel);
 value.set('display_name', sentinel.slice(0, 70)); value.set('next', '/reports/new');
 return value;
}
function controlledAuth({ result = authGood, verified = { data: { user: authUser }, error: null }, throws = false } = {}) {
 const calls = [];
 const thrown = new Error(sentinel);
 const auth = {};
 for (const method of ['signInWithPassword', 'signUp', 'signOut', 'exchangeCodeForSession', 'verifyOtp']) auth[method] = async (...args) => { calls.push([method, ...args]); if (throws) throw thrown; return result; };
 auth.getUser = async () => { calls.push(['getUser']); return verified; };
 const mocks = {
  '@/lib/telemetry-server': server, '@/lib/supabase/server': { serverClient: async () => { calls.push(['serverClient']); return { auth }; } },
  '@/lib/auth-config': authConfig, '@/lib/validation': authValidation, '@/trpc/server': { api: {} },
  '@/server/services/contribution-source': { contributionReportId: async () => { throw new Error('Unexpected contribution lookup in auth telemetry QA.'); } },
  'next/cache': { revalidatePath: (...args) => calls.push(['revalidate', ...args]) },
  'next/navigation': { redirect: actualRedirect },
 };
 return { calls, thrown, mocks, actions: load('app/actions.ts', mocks) };
}
async function authWire(operation, status, invoke) {
 const before = requests.length;
 const result = await invoke();
 await flush();
 const emitted = requests.slice(before).flatMap(request => request.body.batch).filter(event => event.event === 'to_auth_outcome');
 assert.equal(emitted.length, 1, 'Exactly one terminal auth sample per branch');
 const properties = emitted[0].properties;
 assert.equal(properties.operation, operation); assert.equal(properties.auth_status, status);
 assert.equal(properties.traffic_class, 'synthetic'); assert.equal(properties.release, env.TOKENOVERFLOW_RELEASE);
 assert.match(properties.request_id, /^[a-f0-9-]{36}$/); assert(Number.isInteger(properties.duration_ms));
 assert(!('status' in properties) && !('outcome' in properties), 'Auth stages do not fabricate HTTP outcomes');
 assert(!JSON.stringify(requests).includes(sentinel));
 assert(!JSON.stringify(requests).includes('auth-private@example.invalid'));
 return result;
}
const authFailure = 'Sign-in could not be completed. Please try again.';
const signupFailure = 'Account creation could not be completed. Please try again.';
const neutral = 'If this address can be registered, check your email for a confirmation link.';
for (const [code, status, message] of [
 ['user_already_exists', 'neutral_confirmation_prompt', neutral], ['email_exists', 'neutral_confirmation_prompt', neutral],
 ['weak_password', 'input_rejected', 'Choose a stronger password and try again.'],
 ['over_email_send_rate_limit', 'rate_limited', 'Please wait before trying again.'], ['over_request_rate_limit', 'rate_limited', 'Please wait before trying again.'],
 ['email_exists_lookalike', 'provider_rejected', signupFailure],
]) {
 const run = controlledAuth({ result: { data: { session: null, user: null }, error: { code, message: sentinel } } });
 const state = await authWire('email_signup', status, () => run.actions.signUpWithEmail({}, authForm()));
 assert.deepEqual(norm(state), message === neutral ? { message } : { error: message });
 assert.equal(run.calls.filter(call => call[0] === 'getUser').length, 0);
 assert.deepEqual(norm(run.calls[1]), ['signUp', { email: 'auth-private@example.invalid', password: sentinel, options: { emailRedirectTo: authConfig.authCallbackUrl('/reports/new'), data: { display_name: sentinel.slice(0, 70) } } }]);
}
{
 const run = controlledAuth({ result: { data: { session: null, user: null }, error: null } });
 assert.deepEqual(norm(await authWire('email_signup', 'neutral_confirmation_prompt', () => run.actions.signUpWithEmail({}, authForm()))), { message: neutral });
 assert.deepEqual(run.calls.map(call => call[0]), ['serverClient', 'signUp']);
}
for (const [method, operation, failure] of [['signInWithEmail', 'email_signin', authFailure], ['signUpWithEmail', 'email_signup', signupFailure]]) {
 const invalid = authForm(); invalid.set('email', 'invalid');
 const rejected = controlledAuth();
 assert.deepEqual(norm(await authWire(operation, 'input_rejected', () => rejected.actions[method]({}, invalid))), { error: failure });
 assert.equal(rejected.calls.length, 0);
 for (const [options, status] of [[{ throws: true }, 'unavailable'], [{ verified: { data: { user: null }, error: { message: sentinel } } }, 'session_unverified']]) {
  const run = controlledAuth(options);
  assert.deepEqual(norm(await authWire(operation, status, () => run.actions[method]({}, authForm()))), { error: failure });
 }
 const run = controlledAuth();
 await authWire(operation, 'server_session_verified', () => assert.rejects(() => run.actions[method]({}, authForm()), error => error.digest === 'NEXT_REDIRECT;replace;https://tokenoverflow.app/reports/new;307;'));
 assert.deepEqual(run.calls.map(call => call[0]), ['serverClient', method === 'signInWithEmail' ? 'signInWithPassword' : 'signUp', 'getUser', 'revalidate']);
 assert.equal(run.calls[1][1].password, sentinel);
 assert.deepEqual(run.calls.at(-1), ['revalidate', '/', 'layout']);
}
for (const [result, status] of [[{ data: { session: null, user: null }, error: { message: sentinel } }, 'provider_rejected'], [{ data: { session: null, user: authUser }, error: null }, 'session_unverified']]) {
 const run = controlledAuth({ result });
 assert.deepEqual(norm(await authWire('email_signin', status, () => run.actions.signInWithEmail({}, authForm()))), { error: authFailure });
 assert.deepEqual(norm(run.calls[1]), ['signInWithPassword', { email: 'auth-private@example.invalid', password: sentinel }]);
}
{
 const run = controlledAuth({ result: { error: { message: sentinel } } });
 await authWire('signout', 'signout_returned', () => assert.rejects(() => run.actions.signOut(), error => error.digest === 'NEXT_REDIRECT;replace;/;307;'));
 assert.deepEqual(run.calls.map(call => call[0]), ['serverClient', 'signOut', 'revalidate']);
 const failing = controlledAuth({ throws: true });
 await authWire('signout', 'unavailable', () => assert.rejects(() => failing.actions.signOut(), error => error === failing.thrown));
}
for (const [file, operation, method, query] of [
 ['app/auth/callback/route.ts', 'auth_callback', 'exchangeCodeForSession', `code=${encodeURIComponent(sentinel)}`],
 ['app/auth/confirm/route.ts', 'email_confirm', 'verifyOtp', `token_hash=${encodeURIComponent(sentinel)}&type=signup`],
]) {
 for (const [options, suffix, status] of [[{}, query, 'session_returned'], [{ result: { data: { session: null }, error: null } }, query, 'session_unverified'], [{ result: { data: { session: null }, error: { message: sentinel } } }, query, 'provider_rejected'], [{ throws: true }, query, 'unavailable'], [{}, '', 'input_rejected'], [{}, `${query}&error=${encodeURIComponent(sentinel)}`, 'input_rejected']]) {
  const run = controlledAuth(options);
  const route = load(file, run.mocks);
  const response = await authWire(operation, status, () => route.GET(new Request(`https://attacker.invalid/auth?${suffix}&next=%2Freports%2Fnew`)));
  assert.equal(response.status, 307); assert.equal(response.headers.get('cache-control'), 'no-store');
  const location = new URL(response.headers.get('location'));
  assert.equal(location.origin, 'https://tokenoverflow.app'); assert.equal(location.pathname, status === 'session_returned' ? '/reports/new' : '/login');
  if (status === 'session_returned') assert.deepEqual(norm(run.calls[1]), method === 'verifyOtp' ? [method, { token_hash: sentinel, type: 'signup' }] : [method, sentinel]);
  assert(!run.calls.some(call => call[0] === 'getUser'), 'Callback session is not relabeled as fresh verification');
 }
}
const once = await server.startAuthTelemetry('email_signup');
once.finish('neutral_confirmation_prompt'); once.finish('server_session_verified');
await flush();
assert.equal(requests.at(-1).body.batch.filter(event => event.event === 'to_auth_outcome').length, 1);
assert.equal(requests.at(-1).body.batch[0].properties.auth_status, 'neutral_confirmation_prompt');
const beforeUnknownAuth = requests.length;
const unknownOperation = await server.startAuthTelemetry('untrusted_operation');
unknownOperation.finish('server_session_verified');
const unknownStatus = await server.startAuthTelemetry('email_signup');
unknownStatus.finish('untrusted_status');
assert.equal((await route.POST(request({ event: 'to_auth_outcome', route: '/signup', operation: 'email_signup', auth_status: 'server_session_verified', synthetic: true }))).status, 400, 'Browser cannot forge an auth outcome');
await flush();
assert.equal(requests.length, beforeUnknownAuth, 'Unknown auth operation/status and forged browser outcome never enqueue');
const disabledAuthRequests = requests.length;
const disabledAuthHeaders = authHeaderReads;
env.TOKENOVERFLOW_TELEMETRY_ENABLED = 'false';
const disabledAuthRun = controlledAuth();
const disabledInput = authForm(); disabledInput.set('email', 'invalid');
assert.deepEqual(norm(await disabledAuthRun.actions.signInWithEmail({}, disabledInput)), { error: authFailure });
assert.equal(authHeaderReads, disabledAuthHeaders, 'Disabled auth helper never reads request headers');
assert.equal(callbacks.length, 0); assert.equal(requests.length, disabledAuthRequests);
env.TOKENOVERFLOW_TELEMETRY_ENABLED = 'true';

// Exercise streaming boundaries rather than trusting Content-Length or a
// buffered Request body. Every rejected body must produce no capture callback.
function streamRequest(stream) {
 return new Request('https://tokenoverflow.app/api/telemetry', { method: 'POST', headers: { origin: 'https://tokenoverflow.app', 'content-type': 'application/json' }, body: stream, duplex: 'half' });
}
let oversizedCancelled = false;
const oversized = streamRequest(new ReadableStream({
 start(controller) { controller.enqueue(new Uint8Array(1000)); controller.enqueue(new Uint8Array(537)); },
 cancel() { oversizedCancelled = true; },
}));
assert.equal((await route.POST(oversized)).status, 413);
assert.equal(oversizedCancelled, true, 'Oversize streamed bodies are cancelled');
assert.equal((await route.POST(streamRequest(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([0xc3, 0x28])); controller.close(); } })))).status, 400, 'Invalid UTF-8 is rejected');
let slowCancelled = false;
const slow = streamRequest(new ReadableStream({ cancel() { slowCancelled = true; } }));
const slowStarted = performance.now();
assert.equal((await route.POST(slow)).status, 408, 'A stalled stream expires without ingestion');
assert.equal(slowCancelled, true);
assert(performance.now() - slowStarted < 1800, 'Collector stream deadline stays bounded');
assert.equal(callbacks.length, 0, 'Rejected streams never schedule capture');

// A fresh collector and controlled clock isolate its abuse cap from SDK caps.
let collectorTime = 120_000;
const collectorCaptures = [];
const cappedCollector = load('app/api/telemetry/route.ts', { '@/lib/telemetry-server': { ...server, captureBrowserTelemetryServer: (...args) => collectorCaptures.push(args) } }, { process: { env }, Date: { now: () => collectorTime } });
for (let i = 0; i < 120; i++) assert.equal((await cappedCollector.POST(request(valid))).status, 204);
assert.equal((await cappedCollector.POST(request(valid))).status, 429);
assert.equal(collectorCaptures.length, 120, 'Over-cap collector traffic never reaches capture');
collectorTime += 60_000;
assert.equal((await cappedCollector.POST(request(valid))).status, 204);
assert.equal(collectorCaptures.length, 121, 'Collector cap resets next minute');

const beforeDisabled = requests.length;
env.TOKENOVERFLOW_TELEMETRY_ENABLED = 'false';
observation.startOperation('/api/v1/reports', 'search_reports').complete(200);
assert.equal((await route.POST(request(valid))).status, 204);
await flush();
assert.equal(requests.length, beforeDisabled);
env.TOKENOVERFLOW_TELEMETRY_ENABLED = 'true';
delete env.POSTHOG_PROJECT_TOKEN;
observation.startOperation('/api/v1/reports', 'search_reports').complete(200);
assert.equal(callbacks.length, 0);
env.POSTHOG_PROJECT_TOKEN = 'phc_synthetic_fixture';
env.POSTHOG_HOST = 'https://attacker.invalid';
assert.equal(server.telemetryEnabled(), false);
env.POSTHOG_HOST = 'https://us.i.posthog.com';
env.NEXT_PHASE = 'phase-production-build';
observation.startOperation('/api/trpc', 'search_reports').complete(200);
assert.equal(callbacks.length, 0, 'Prerender/build work is not captured as requests');
delete env.NEXT_PHASE;
failDelivery = true;
observation.startOperation('/api/v1/reports', 'search_reports').complete(200);
const sdkErrors = [];
const originalError = console.error;
const originalWarn = console.warn;
const originalLog = console.log;
const otherSdkConsole = [];
console.warn = (...args) => otherSdkConsole.push(args);
console.log = (...args) => otherSdkConsole.push(args);
console.error = (...args) => sdkErrors.push(args);
try {
 await flush(); // A delivery failure never replaces app success or logs its body.
 failDelivery = 'timeout';
 const start = performance.now();
 observation.startOperation('/api/v1/reports', 'search_reports').complete(200);
 let deadline;
 try { await Promise.race([flush(), new Promise((_, reject) => { deadline = setTimeout(() => reject(new Error('Bounded flush deadline exceeded')), 1800); })]); }
 finally { clearTimeout(deadline); }
 assert(performance.now() - start < 1800, 'SDK flush wait stays bounded');
 failDelivery = 'http503';
 const successfulBody = JSON.stringify({ accepted: true });
 const successfulResponse = observation.startOperation('/api/v1/reports', 'search_reports').finish(new Response(successfulBody, { status: 200 }));
 await flush(); // Actual SDK receives a rejected HTTP response with private body.
 assert.equal(rejectedDeliveryAttempts, 1, 'Non-2xx delivery uses explicit flush without SDK retry');
 assert.equal(successfulResponse.status, 200, 'HTTP telemetry rejection does not replace application status');
 assert.equal(await successfulResponse.text(), successfulBody, 'HTTP telemetry rejection does not replace application body');
} finally { console.error = originalError; console.warn = originalWarn; console.log = originalLog; }
assert.equal(otherSdkConsole.length, 0, 'No SDK warning/log output for rejected delivery');
assert.equal(sdkErrors.length, 0, 'No raw SDK flush error output');

assert.equal(sdkModuleAccesses, 1, 'Later explicit flushes reuse the SDK client');

const work = [];
const bounded = queueModule.createTelemetryQueue(async () => { throw new Error(sentinel); }, callback => work.push(callback), 2);
for (let i = 0; i < 5; i++) bounded.enqueue({ event: 'to_page_view', properties: { route: '/' } });
assert.equal(work.length, 1);
assert.equal(bounded.stats().dropped, 3);
await work.shift()();
assert.equal(bounded.stats().queued, 0);
assert.equal(bounded.stats().failedBatches, 1);
const unavailableLifecycle = queueModule.createTelemetryQueue(async () => assert.fail('Must not send without lifecycle'), () => { throw new Error(sentinel); });
unavailableLifecycle.enqueue({ event: 'to_page_view', properties: { route: '/' } });
assert.equal(unavailableLifecycle.stats().dropped, 1);

// An overall queue deadline must not accumulate underlying orphan deliveries.
const deadlineConsole = [];
const deadlineQueueModule = load('lib/telemetry-queue.ts', {}, { console: { error: () => deadlineConsole.push(true), warn: () => deadlineConsole.push(true), log: () => deadlineConsole.push(true) } });
for (const settlement of ['resolve', 'reject']) {
 const pendingWork = [];
 let underlyingCalls = 0;
 let settle;
 const latched = deadlineQueueModule.createTelemetryQueue(() => {
  underlyingCalls++;
  return underlyingCalls === 1 ? new Promise((resolve, reject) => { settle = settlement === 'resolve' ? resolve : () => reject(new Error(sentinel)); }) : Promise.resolve();
 }, callback => pendingWork.push(callback), 2, 20);
 const sample = { event: 'to_page_view', properties: { route: '/' } };
 const deadlineObservation = load('lib/observability.ts', { 'server-only': {}, './telemetry-server': { captureOperationTelemetry: () => latched.enqueue(sample) } });
 const response = deadlineObservation.startOperation('/api/v1/reports', 'search_reports').finish(Response.json({ accepted: true }));
 const started = performance.now();
 const callback = pendingWork.shift()();
 await Promise.resolve(); // First delivery has started; this event queues behind it.
 latched.enqueue(sample);
 await callback;
 assert(performance.now() - started < 500, 'Queue callback returns despite an unsettled delivery');
 assert.equal(latched.stats().suspended, true);
 assert.equal(latched.stats().queued, 0);
 assert.equal(latched.stats().dropped, 1, 'Timeout drops events queued during delivery');
 for (let i = 0; i < 5; i++) latched.enqueue(sample);
 assert.equal(latched.stats().dropped, 6, 'Suspended queue drops new events');
 assert.equal(pendingWork.length, 0);
 assert.equal(underlyingCalls, 1, 'Only one underlying promise exists while suspended');
 const unhandled = [];
 const onUnhandled = () => unhandled.push(true);
 process.on('unhandledRejection', onUnhandled);
 try {
  settle();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(unhandled.length, 0, 'Late rejection is handled without exposing its error');
 } finally { process.off('unhandledRejection', onUnhandled); }
 assert.equal(latched.stats().suspended, false, 'Queue resumes only after underlying settlement');
 latched.enqueue(sample);
 assert.equal(pendingWork.length, 1);
 await pendingWork.shift()();
 assert.equal(underlyingCalls, 2);
 assert.equal(response.status, 200);
 assert.deepEqual(await response.json(), { accepted: true }, 'Deadline and late rejection preserve application result');
}
assert.equal(deadlineConsole.length, 0, 'Queue deadlines and late rejections produce no raw console output');
const arrivingWork = [];
let arrivingBatches = 0;
const arrivingQueue = queueModule.createTelemetryQueue(async () => {
 arrivingBatches++;
 arrivingQueue.enqueue({ event: 'to_page_view', properties: { route: '/' } });
}, callback => arrivingWork.push(callback), 2, 20);
arrivingQueue.enqueue({ event: 'to_page_view', properties: { route: '/' } });
await arrivingWork.shift()();
assert.equal(arrivingBatches, 2, 'Ongoing arrivals do not extend lifecycle beyond two batches');
assert.equal(arrivingQueue.stats().dropped, 1);
assert.equal(arrivingQueue.stats().queued, 0);
assert.equal(arrivingWork.length, 0);

const browserRequests = [];
const navigator = { doNotTrack: '0', webdriver: true };
let now = 100;
const browserEmitter = load('lib/telemetry-browser.ts', { './telemetry-shared': shared }, {
 process: { env: { NEXT_PUBLIC_TELEMETRY_ENABLED: 'true' } }, navigator,
 window: { location: { pathname: '/' } }, performance: { now: () => now },
 fetch: async (url, options) => { browserRequests.push({ url, ...options, body: JSON.parse(options.body) }); return new Response(null, { status: 204 }); },
});
browserEmitter.captureTelemetryPage('/');
browserEmitter.markTelemetryNavigation(`/?q=${encodeURIComponent(sentinel)}&examples=true`);
now = 190;
browserEmitter.captureTelemetryPage('/');
assert.equal(browserRequests[1].body.duration_ms, 90);
assert.equal(browserRequests[1].body.timing_kind, 'navigation_route_commit');
assert.equal(browserRequests[1].body.route, '/');
browserEmitter.markTelemetryNavigation(`/reports/${sentinel}`);
now = 240;
browserEmitter.captureTelemetryPage('/reports/11111111-1111-4111-8111-111111111111');
assert.equal(browserRequests[2].body.duration_ms, 50);
assert.equal(browserRequests[2].body.route, '/reports/[id]');
assert(browserRequests.every(r => r.credentials === 'omit' && r.referrerPolicy === 'no-referrer' && r.url === '/api/telemetry'));
assert(!JSON.stringify(browserRequests).includes(sentinel));
navigator.doNotTrack = '1';
browserEmitter.captureTelemetryCopy();
assert.equal(browserRequests.length, 3, 'DNT suppresses browser event requests');
navigator.doNotTrack = '0';
navigator.globalPrivacyControl = true;
browserEmitter.captureTelemetryCopy();
assert.equal(browserRequests.length, 3, 'GPC independently suppresses browser event requests');
navigator.globalPrivacyControl = false;
let disabledBrowserAttempts = 0;
const disabledBrowser = load('lib/telemetry-browser.ts', { './telemetry-shared': shared }, {
 process: { env: { NEXT_PUBLIC_TELEMETRY_ENABLED: 'false' } }, navigator,
 window: { location: { pathname: '/' } },
 fetch: async () => { disabledBrowserAttempts++; return new Response(null, { status: 204 }); },
});
disabledBrowser.captureTelemetryCopy();
assert.equal(disabledBrowserAttempts, 0, 'Disabled browser never attempts fetch');
let browserTime = 120_000;
let browserAttempts = 0;
const cappedBrowser = load('lib/telemetry-browser.ts', { './telemetry-shared': shared }, {
 process: { env: { NEXT_PUBLIC_TELEMETRY_ENABLED: 'true' } }, navigator,
 window: { location: { pathname: '/' } }, Date: { now: () => browserTime },
 fetch: async () => { browserAttempts++; return new Response(null, { status: 204 }); },
});
for (let i = 0; i < 31; i++) cappedBrowser.captureTelemetryCopy();
assert.equal(browserAttempts, 30, 'Browser cap bounds actual fetch attempts');
browserTime += 60_000;
cappedBrowser.captureTelemetryCopy();
assert.equal(browserAttempts, 31, 'Browser cap resets next minute');
const componentSource = fs.readFileSync(new URL('components/telemetry.tsx', root), 'utf8');
assert(componentSource.includes('useSearchParams()') && componentSource.includes('[pathname, search]'), 'Query-only commit identity triggers the page observer');
assert(!componentSource.includes('search.toString') && !componentSource.includes('JSON.stringify(search)'), 'Raw query is not serialized for tracking');

console.log(JSON.stringify({ sdk: 'posthog-node 5.61.1', controlled_sink: 'pass', terminal_dedup: 'pass', expected_rejection_vs_failure: 'pass', release_request_correlation: 'pass', privacy_sentinels: 'excluded', strict_browser_collector: 'pass', framework_action_and_exclusions: 'pass', streamed_body_deadline_utf8: 'pass', collector_browser_rate_reset: 'pass', disabled_missing_config: 'no delivery', bounded_queue_failure_timeout: 'pass', same_path_query_timing: 'pass', browser_disabled_dnt_gpc_and_payload: 'pass', scope: 'no network/project ingestion/browser runtime/production proof' }));
