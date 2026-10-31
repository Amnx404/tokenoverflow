// Use an ALREADY installed isolated official SDK; never installs packages or invokes a model.
// node scripts/qa/mcp-client-read.mjs <sdk-install-root> <mcp-url> [--include-example] [--require-detail]
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [sdkRoot, endpoint, ...flags] = process.argv.slice(2);
if (!sdkRoot || !endpoint) throw new Error('Supply existing SDK install root and MCP endpoint');
const root = resolve(sdkRoot);
const require = createRequire(pathToFileURL(resolve(root, 'package.json')));
const { Client } = await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/index.js')));
const { StreamableHTTPClientTransport } = await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/streamableHttp.js')));
const pkg = JSON.parse(await readFile(resolve(root, 'node_modules/@modelcontextprotocol/sdk/package.json'), 'utf8'));
assert.equal(pkg.version, '1.29.0', 'This recorded client check targets the existing isolated SDK 1.29.0');
const url = new URL(endpoint);
assert.ok(url.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(url.hostname));
assert.equal(url.username + url.password, '');
const exchanges = [];
const transport = new StreamableHTTPClientTransport(url, { fetch: async (input, init) => {
  const headers = new Headers(init?.headers);
  assert.equal(headers.has('authorization'), false);
  assert.equal(headers.has('cookie'), false);
  const response = await fetch(input, init);
  exchanges.push({ method: init?.method ?? 'GET', status: response.status, request_id: response.headers.get('x-request-id') });
  return response;
} });
const client = new Client({ name: 'tokenoverflow-public-read-check', version: '1.0.0' }, { capabilities: {} });
const dataOf = result => {
  assert.notEqual(result.isError, true, 'Tool returned an error');
  const data = result.structuredContent ?? JSON.parse(result.content.find(c => c.type === 'text').text);
  assert.deepEqual(JSON.parse(result.content.find(c => c.type === 'text').text), data);
  assert.doesNotMatch(JSON.stringify(data), /"(?:author_id|agent_key_id|user_id|token_hash)"/);
  return data;
};
let summary;
try {
  await client.connect(transport, { timeout: 10000 });
  const listed = await client.listTools({}, { timeout: 10000 });
  const tools = listed.tools.map(tool => tool.name).sort();
  assert.deepEqual(tools, ['get_report', 'publish_fix', 'publish_report', 'record_verification', 'search_reports']);
  const search = dataOf(await client.callTool({ name: 'search_reports', arguments: { q: '' } }, undefined, { timeout: 10000 }));
  assert.ok(search.reports.every(report => report.is_example === false));
  let selected = search.reports[0];
  let exampleUsed = false;
  if (!selected && flags.includes('--include-example')) {
    const examples = dataOf(await client.callTool({ name: 'search_reports', arguments: { examples: true } }, undefined, { timeout: 10000 }));
    selected = examples.reports[0]; exampleUsed = Boolean(selected);
  }
  assert.ok(selected || !flags.includes('--require-detail'), 'Required detail check has no report fixture; empty search alone does not prove get_report or canonical page readiness');
  let detailRead = false;
  let canonicalPageStatus = null;
  if (selected) {
    const detail = dataOf(await client.callTool({ name: 'get_report', arguments: { id: selected.id } }, undefined, { timeout: 10000 }));
    assert.equal(detail.report.id, selected.id);
    assert.equal(detail.report.environment, selected.environment);
    assert.equal(detail.url, `https://tokenoverflow.app/reports/${selected.id}`);
    assert.match(detail.evidence_format, /not machine-verified/);
    detailRead = true;
    if (url.hostname === 'tokenoverflow.app') {
      const page = await fetch(detail.url, { signal: AbortSignal.timeout(10000) });
      canonicalPageStatus = page.status;
      assert.equal(page.status, 200);
      assert.equal(new URL(page.url).hostname, 'tokenoverflow.app');
    }
  }
  summary = { endpoint: url.href, sdk: pkg.version, protocol: transport.protocolVersion,
    server: client.getServerVersion(), tools, public_count: search.count, detail_read: detailRead,
    illustrative_example_used: exampleUsed, canonical_page_status: canonicalPageStatus };
} finally {
  await client.close();
}
console.log(JSON.stringify({ ...summary, exchanges }, null, 2));
