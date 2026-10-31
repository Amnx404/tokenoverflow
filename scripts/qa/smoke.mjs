// Read-only HTTP checks plus requests guaranteed to fail before contribution writes.
// Usage: BASE_URL=http://localhost:3000 node scripts/qa/smoke.mjs
// Local production server: add SMOKE_HOST=tokenoverflow.app for its Host allowlist.
import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import { createTRPCUntypedClient, httpLink } from '@trpc/client';
const base = process.env.BASE_URL || 'http://localhost:3000';
const timeout = Number(process.env.SMOKE_TIMEOUT_MS || 30000);
let passed = 0, failed = 0, id = 0;
async function check(name, fn) {
  try { await fn(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}: ${error.message}`); }
}
async function request(path, options = {}) {
  if (process.env.SMOKE_HOST) {
    // Node fetch ignores a Host override; native HTTP preserves the production authority.
    const url = new URL(path, base);
    return new Promise((resolve, reject) => {
      const req = (url.protocol === 'https:' ? https : http).request(url, {
        method: options.method || 'GET', headers: { Host: process.env.SMOKE_HOST, ...options.headers },
        signal: AbortSignal.timeout(timeout),
      }, res => {
        const chunks = []; res.on('data', chunk => chunks.push(chunk)); res.on('error', reject);
        res.on('end', () => resolve(new Response(Buffer.concat(chunks), { status: res.statusCode, headers: res.headers })));
      });
      req.on('error', reject); req.end(options.body);
    });
  }
  return fetch(new URL(path, base), { redirect: 'manual', signal: AbortSignal.timeout(timeout), ...options,
    headers: { ...(process.env.SMOKE_HOST ? { Host: process.env.SMOKE_HOST } : {}), ...options.headers },
  });
}
async function json(path, status = 200, options) {
  const response = await request(path, options);
  assert.equal(response.status, status, `${path}: HTTP ${response.status}, expected ${status}`);
  assert.match(response.headers.get('content-type') || '', /application\/json/);
  return response.json();
}
function assertReports(data) {
  assert.ok(Array.isArray(data.reports));
  assert.equal(data.page, 1); assert.equal(data.page_size, 20);
  assert.ok(data.reports.length <= 20);
  assert.ok(data.reports.every(report => report.is_example === false), 'Illustrative examples leaked into community results');
  assert.equal(typeof data.content_trust, 'string');
}
async function rpc(method, params = {}, modern = true, overrides = {}) {
  const requestId = ++id;
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': modern ? '2026-07-28' : '2025-11-25' };
  if (modern) {
    headers['Mcp-Method'] = method;
    if (method === 'tools/call') headers['Mcp-Name'] = params.name;
    params = { ...params, _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientCapabilities': {} } };
  }
  const response = await request('/api/mcp', { method: 'POST', headers: { ...headers, ...overrides }, body: JSON.stringify({ jsonrpc: '2.0', id: requestId, method, params }) });
  const raw = await response.text();
  let message;
  if ((response.headers.get('content-type') || '').includes('text/event-stream')) {
    const events = raw.replaceAll('\r\n', '\n').split('\n\n').flatMap(event => {
      const data = event.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
      return data ? [JSON.parse(data)] : [];
    });
    message = events.find(event => event.id === requestId);
  } else { message = JSON.parse(raw); }
  assert.ok(message, 'No JSON-RPC response for request ID');
  assert.equal(message.jsonrpc, '2.0'); assert.equal(message.id, requestId);
  return { response, message };
}
function success(exchange, modern = true) {
  assert.equal(exchange.response.status, 200);
  assert.equal(exchange.message.error, undefined, JSON.stringify(exchange.message.error));
  assert.ok(exchange.message.result);
  if (modern) assert.equal(exchange.message.result.resultType, 'complete');
  return exchange.message.result;
}
function toolData(result) {
  assert.notEqual(result.isError, true, JSON.stringify(result));
  assert.ok(Array.isArray(result.content));
  return result.structuredContent || JSON.parse(result.content.find(item => item.type === 'text').text);
}
for (const path of ['/', '/agents', '/how-it-works', '/design-lab', '/design-lab/atlas', '/design-lab/workbench', '/design-lab/fieldnotes']) {
  await check(`page ${path}`, async () => {
    const response = await request(path); assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') || '', /text\/html/);
    const html = await response.text(); assert.match(html, /<h1[\s>]/); assert.doesNotMatch(html, /NEXT_HTTP_ERROR_FALLBACK;500/);
  });
}
await check('anonymous report creation redirects to login', async () => {
  const response = await request('/reports/new');
  let location = response.headers.get('location');
  if (response.status === 200) {
    // Next.js may already have streamed the shell before the async auth check.
    const html = await response.text();
    location = html.match(/http-equiv="refresh" content="\d+;url=([^"]+)"/)?.[1]?.replaceAll('&amp;', '&');
    assert.ok(location, 'Missing streamed authentication redirect');
  } else assert.ok([303, 307].includes(response.status));
  const target = new URL(location, base);
  assert.equal(target.pathname, '/login'); assert.equal(target.searchParams.get('next'), '/reports/new');
});
await check('public report search excludes examples', async () => assertReports(await json('/api/v1/reports')));
for (const query of ['page=0', 'page=1.5', 'page=1001', 'page=NaN', 'category=invalid', 'view=invalid', `q=${'x'.repeat(301)}`]) {
  await check(`invalid search ${query.slice(0, 40)}`, async () => assert.equal(typeof (await json(`/api/v1/reports?${query}`, 400)).error, 'string'));
}
await check('invalid report ID', async () => { await json('/api/v1/reports/not-a-uuid', 400); });
await check('missing report UUID', async () => { await json('/api/v1/reports/00000000-0000-4000-8000-000000000000', 404); });
const fakeAuth = { Authorization: `Bearer to_${'0'.repeat(64)}` };
for (const kind of ['reports', 'fixes', 'verifications']) {
  await check(`anonymous ${kind} denied`, async () => { await json(`/api/v1/${kind}`, 401, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); });
  await check(`${kind} wrong content type`, async () => { await json(`/api/v1/${kind}`, 415, { method: 'POST', headers: { ...fakeAuth, 'Content-Type': 'text/plain' }, body: '{}' }); });
}
await check('REST body size bound', async () => { await json('/api/v1/reports', 413, { method: 'POST', headers: { ...fakeAuth, 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'x'.repeat(61000) }) }); });
// Exercise the installed tRPC client's real wire encoding, rather than duplicating it.
const trpc = createTRPCUntypedClient({ links: [httpLink({
  url: new URL('/api/trpc', base).href,
  fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(timeout) }),
})] });
await check('tRPC anonymous public search excludes examples', async () => {
  const data = await trpc.query('reports.list', {});
  assert.ok(Array.isArray(data.reports)); assert.ok(data.reports.length <= 20);
  assert.ok(data.reports.every(report => report.is_example === false));
  assert.equal(typeof data.count, 'number');
});
await check('public tRPC and REST detail omit private identifiers', async () => {
  const community = await trpc.query('reports.list', {});
  const examples = community.reports.length ? community : await trpc.query('reports.list', { examples: true });
  assert.ok(examples.reports.length, 'No existing report fixture available to verify detail privacy');
  const reportId = examples.reports[0].id;
  for (const detail of [await trpc.query('reports.byId', { id: reportId }), await json(`/api/v1/reports/${reportId}`)]) {
    const inspect = value => {
      if (!value || typeof value !== 'object') return;
      for (const [key, child] of Object.entries(value)) {
        assert.ok(!['author_id', 'agent_key_id', 'key_hash', 'token_hash'].includes(key), `Private field leaked: ${key}`);
        inspect(child);
      }
    };
    inspect(detail);
  }
});
for (const [procedure, input] of [['reports.list', { page: 0 }], ['reports.byId', { id: 'not-a-uuid' }]]) {
  await check(`tRPC invalid ${procedure}`, async () => {
    await assert.rejects(trpc.query(procedure, input), error => error.data?.code === 'BAD_REQUEST');
  });
}
await check('tRPC missing report UUID', async () => {
  await assert.rejects(trpc.query('reports.byId', { id: '00000000-0000-4000-8000-000000000000' }), error => error.data?.code === 'NOT_FOUND');
});
await check('tRPC anonymous agent keys denied', async () => {
  await assert.rejects(trpc.query('agentKeys.list'), error => error.data?.code === 'UNAUTHORIZED');
});
// Invalid bodies provide a second guard against writes if authorization regresses.
for (const procedure of ['contributions.report', 'contributions.fix', 'contributions.verify', 'agentKeys.create', 'agentKeys.revoke']) {
  await check(`tRPC anonymous ${procedure} denied`, async () => {
    await assert.rejects(trpc.mutation(procedure, {}), error => error.data?.code === 'UNAUTHORIZED');
  });
}
await check('modern MCP discovery', async () => {
  const result = success(await rpc('server/discover')); assert.ok(result.supportedVersions.includes('2026-07-28')); assert.ok(result.capabilities.tools);
});
for (const modern of [true, false]) {
  const era = modern ? 'modern' : 'legacy';
  if (!modern) {
    await check('legacy initialize', async () => {
      const result = success(await rpc('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'token-overflow-smoke', version: '1.0.0' } }, false), false);
      assert.equal(result.protocolVersion, '2025-11-25'); assert.ok(result.capabilities.tools); assert.equal(result.serverInfo.name, 'token-overflow');
    });
    await check('legacy initialized notification', async () => {
      const response = await request('/api/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-11-25' }, body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) });
      assert.equal(response.status, 202); assert.equal(await response.text(), '');
    });
  }
  await check(`${era} tools/list`, async () => {
    const result = success(await rpc('tools/list', {}, modern), modern);
    for (const name of ['search_reports', 'get_report', 'publish_report', 'publish_fix', 'record_verification']) {
      const tool = result.tools.find(item => item.name === name); assert.ok(tool, `Missing ${name}`); assert.equal(tool.inputSchema.type, 'object');
    }
  });
  await check(`${era} search tool`, async () => assertReports(toolData(success(await rpc('tools/call', { name: 'search_reports', arguments: {} }, modern), modern))));
  await check(`${era} invalid tool arguments`, async () => {
    const { message } = await rpc('tools/call', { name: 'search_reports', arguments: { page: 0 } }, modern);
    assert.ok(message.error || message.result?.isError, 'Invalid arguments unexpectedly succeeded');
  });
}
await check('anonymous MCP write denied', async () => {
  const result = success(await rpc('tools/call', { name: 'publish_fix', arguments: {
    report_id: '00000000-0000-4000-8000-000000000000', author_name: 'Smoke test',
    body: 'This invalid anonymous request must never publish.', environment: 'Smoke test environment',
    evidence: 'No actual verification; authorization rejection only.',
  } }));
  assert.equal(result.isError, true);
  const data = result.structuredContent || JSON.parse(result.content.find(item => item.type === 'text').text);
  assert.equal(data.status, 401);
});
await check('MCP origin rejection', async () => {
  const response = await request('/api/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://untrusted.invalid' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'server/discover' }) });
  assert.equal(response.status, 403);
});
await check('MCP GET unsupported', async () => { const response = await request('/api/mcp'); assert.equal(response.status, 405); });
await check('MCP envelope size bound', async () => {
  const response = await request('/api/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify({ padding: 'x'.repeat(66000) }) }); assert.equal(response.status, 413);
});
console.log(`\n${passed} passed, ${failed} failed (${base})`);
process.exitCode = failed ? 1 : 0;
