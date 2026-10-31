// Synthetic public evidence only. No database, network, credentials or listening server.
// Run: npx tsx scripts/qa/mcp-evidence.ts
import assert from 'node:assert/strict';
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { contributionReceipt, reportEvidence, searchEvidence } from '../../lib/mcp-evidence';

async function main() {
  const id = '10000000-0000-4000-8000-000000000001';
  const savedId = '20000000-0000-4000-8000-000000000002';
  let lookups = 0;
  const resolveReport = async (kind: 'fix' | 'verification', rowId: string) => {
    assert.ok(kind === 'fix' || kind === 'verification');
    assert.equal(rowId, savedId); lookups++;
    return id;
  };
  const reportReceipt = await contributionReceipt({ id, kind: 'report', url: `/reports/${id}` }, 201, resolveReport);
  assert.equal(reportReceipt.source_url, `https://tokenoverflow.app/reports/${id}`);
  assert.equal(reportReceipt.url, `/reports/${id}`);
  assert.equal(lookups, 0);
  for (const kind of ['fix', 'verification']) {
    const receipt = await contributionReceipt({ id: savedId, kind }, 201, resolveReport);
    assert.deepEqual(receipt, { id: savedId, kind, status: 201, source_url: `https://tokenoverflow.app/reports/${id}` });
  }
  assert.equal(lookups, 2);
  const unavailable = { id: savedId, kind: 'fix' };
  assert.deepEqual(await contributionReceipt(unavailable, 201, async () => { throw new Error('lookup unavailable'); }), { ...unavailable, status: 201 });
  assert.deepEqual(await contributionReceipt(unavailable, 201, async () => null), { ...unavailable, status: 201 });
  assert.deepEqual(await contributionReceipt(unavailable, 201, async () => 'https://other.example'), { ...unavailable, status: 201 });
  const denied = { error: 'A key is required.' };
  assert.deepEqual(await contributionReceipt(denied, 401, resolveReport), { ...denied, status: 401 });
  assert.deepEqual(await contributionReceipt({ id: '../other', kind: 'fix' }, 201, resolveReport), { id: '../other', kind: 'fix', status: 201 });
  assert.equal(lookups, 2);
  const environment = 'SDK 1.2.3; Node 24; Linux';
  const summary = {
    id, title: 'Synthetic failure', summary: 'Synthetic summary', environment,
    category: 'APIs', tags: ['sdk'], is_example: false, created_at: '2026-10-30',
    author_name: 'Example', fix_count: 1, worked_count: 1, failed_count: 1,
    author_id: 'PRIVATE', agent_key_id: 'PRIVATE', body: 'NOT A SEARCH FIELD',
  };
  const search = searchEvidence({ reports: [summary], count: 1 });
  assert.equal(search.reports[0].url, `https://tokenoverflow.app/reports/${id}`);
  assert.equal(search.reports[0].environment, environment);
  assert.equal(search.reports[0].worked_count, 1);
  assert.equal(search.reports[0].failed_count, 1);
  assert.doesNotMatch(JSON.stringify(search), /PRIVATE|NOT A SEARCH FIELD/);
  const raw = {
    report: { ...search.reports[0], body: 'Baseline context', reproduction: 'Exact baseline command and output', attempted_fixes: 'Prior change failed' },
    fixes: [{ id, author_name: 'Example', body: 'Exact change', environment,
      evidence: 'same-check: before failed, after worked', created_at: '2026-10-30',
      verifications: (['worked', 'failed'] as const).map(outcome => ({ id, author_name: 'Independent', outcome, environment, notes: `${outcome}: raw output`, created_at: '2026-10-30' })) }],
  };
  const detail = reportEvidence(raw);
  assert.deepEqual(detail.report, raw.report);
  assert.deepEqual(detail.fixes, raw.fixes);
  assert.match(detail.evidence_format, /not machine-verified/);

  // Exercise both SDK wire eras using the same packaging functions as the route.
  const handler = createMcpHandler(() => {
    const server = new McpServer({ name: 'evidence-test', version: '1.0.0' });
    server.registerTool('search_reports', { inputSchema: z.object({}) }, async () => ({ content: [{ type: 'text', text: JSON.stringify(search) }], structuredContent: search }));
    server.registerTool('get_report', { inputSchema: z.object({ id: z.uuid() }) }, async () => ({ content: [{ type: 'text', text: JSON.stringify(detail) }], structuredContent: detail }));
    return server;
  }, { legacy: 'stateless', responseMode: 'json' });
  for (const version of ['2026-07-28', '2025-11-25']) {
    for (const name of ['search_reports', 'get_report']) {
      const modern = version === '2026-07-28';
      const response = await handler.fetch(new Request('http://localhost/api/mcp', {
        method: 'POST', headers: {
          'Content-Type': 'application/json', Accept: 'application/json, text/event-stream',
          'MCP-Protocol-Version': version,
          ...(modern ? { 'Mcp-Method': 'tools/call', 'Mcp-Name': name } : {}),
        }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: {
          name, arguments: name === 'get_report' ? { id } : {},
          ...(modern ? { _meta: { 'io.modelcontextprotocol/protocolVersion': version, 'io.modelcontextprotocol/clientCapabilities': {} } } : {}),
        } }),
      }));
      assert.equal(response.status, 200);
      const responseText = await response.text();
      const message = response.headers.get('content-type')?.includes('text/event-stream')
        ? JSON.parse(responseText.split('\n').find(line => line.startsWith('data:'))!.slice(5))
        : JSON.parse(responseText);
      assert.equal(message.error, undefined);
      assert.notEqual(message.result.isError, true);
      assert.deepEqual(message.result.structuredContent, name === 'search_reports' ? search : detail);
      assert.deepEqual(JSON.parse(message.result.content[0].text), message.result.structuredContent);
    }
  }
  console.log('PASS canonical mutation receipts with saved relationships, post-save lookup failure preservation, rejected-error/no-lookup cases, public search privacy, exact environment, mixed outcomes, raw evidence preservation, and 4 SDK modern/legacy tool exchanges');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
