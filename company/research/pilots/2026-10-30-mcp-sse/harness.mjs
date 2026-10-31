// Independently authored diagnostic from the behavior described in upstream #2739.
// Run: node harness.mjs <isolated-install-root>. No network or listening server.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';

if (!process.argv[2]) throw new Error('Supply the isolated npm install root');
const root = resolve(process.argv[2]);
const require = createRequire(pathToFileURL(resolve(root, 'package.json')));
const { Client } = await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/index.js')));
const { StreamableHTTPClientTransport } = await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/streamableHttp.js')));
const pkg = JSON.parse(await readFile(resolve(root, 'node_modules/@modelcontextprotocol/sdk/package.json'), 'utf8'));
if (pkg.version !== '1.29.0') throw new Error('This diagnostic requires exactly SDK 1.29.0');
const rounded = n => Math.round(n * 100) / 100;

async function run(mode, timeout_ms, repetition) {
  let started;
  const row = { mode, timeout_ms, repetition, events: [] };
  const event = (name, extra = {}) => row.events.push({ name, elapsed_ms: started === undefined ? null : rounded(performance.now() - started), ...extra });
  const json = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
  const fetch = async (_url, options = {}) => {
    if (options.method === 'GET') return new Response(null, { status: 405 });
    if (options.method === 'DELETE') return new Response(null, { status: 200 });
    const message = JSON.parse(String(options.body));
    if (message.method === 'initialize') {
      row.protocol = { initialize_requested: message.params.protocolVersion, initialize_returned: '2025-11-25' };
      return json({ jsonrpc: '2.0', id: message.id, result: { protocolVersion: '2025-11-25', capabilities: {}, serverInfo: { name: 'local-mock', version: '1' } } });
    }
    if (message.method === 'notifications/initialized' || message.method === 'notifications/cancelled') return new Response(null, { status: 202 });
    if (message.method !== 'ping') throw new Error(`Unexpected method: ${message.method}`);
    event('ping_received', { request_id: message.id });
    if (mode === 'json') return json({ jsonrpc: '2.0', id: message.id, result: {} });
    // Both SSE cases intentionally contain zero frames, hence no matching result.
    const body = new ReadableStream({ start(controller) {
      setTimeout(() => {
        event(mode === 'eof' ? 'sse_closed' : 'sse_errored', { response_frames: 0 });
        if (mode === 'eof') controller.close();
        else controller.error(new Error('diagnostic stream ended unexpectedly'));
      }, 0);
    } });
    return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
  };
  const transport = new StreamableHTTPClientTransport(new URL('https://mock.invalid/mcp'), { fetch });
  const client = new Client({ name: 'isolated-diagnostic', version: '1' }, { capabilities: {} });
  client.onerror = error => event('client_onerror', { message: error.message });
  let watchdog;
  try {
    await client.connect(transport, { timeout: 1000 });
    row.server_info = client.getServerVersion();
    started = performance.now();
    const request = client.ping({ timeout: timeout_ms }).then(
      () => ({ settlement: 'resolved', elapsed_ms: rounded(performance.now() - started) }),
      error => ({ settlement: 'sdk_rejected', elapsed_ms: rounded(performance.now() - started), code: error.code ?? null, message: error.message }),
    );
    const guard = new Promise(resolveGuard => { watchdog = setTimeout(() => resolveGuard({ settlement: 'watchdog', elapsed_ms: rounded(performance.now() - started) }), timeout_ms + 1000); });
    row.result = await Promise.race([request, guard]);
  } catch (error) {
    row.result = { settlement: 'setup_inconclusive', message: error.message };
  } finally {
    clearTimeout(watchdog);
    await client.close();
  }
  return row;
}

const observations = [];
cases: for (const timeout of [300, 1200]) for (const repetition of [1, 2]) {
  const control = await run('json', timeout, repetition);
  observations.push(control);
  if (control.result.settlement !== 'resolved') break cases;
  observations.push(await run('eof', timeout, repetition));
  observations.push(await run('error', timeout, repetition));
}
console.log(JSON.stringify({ node: process.version, platform: process.platform, arch: process.arch, package: `${pkg.name}@${pkg.version}`, mock_only: true, observations }, null, 2));
