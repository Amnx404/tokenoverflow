// Independent synthetic A contract check. No network, database, auth session,
// credentials or listening server. Run: npx tsx scripts/qa/mcp-evidence-bundle.ts
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import * as sdk from '@modelcontextprotocol/server';
import * as validation from '../../lib/validation';
import * as evidence from '../../lib/mcp-evidence';

const require = createRequire(import.meta.url);
function load<T>(relative: string, mocks: Record<string, unknown>): T {
  const source = fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  const loaded = { exports: {} };
  const localRequire = (name: string) => Object.hasOwn(mocks, name) ? mocks[name] : require(name);
  new Function('module', 'exports', 'require', code)(loaded, loaded.exports, localRequire);
  return loaded.exports as T;
}

const id = '10000000-0000-4000-8000-000000000001';
const legacyId = '10000000-0000-4000-8000-000000000002';
const fixId = '20000000-0000-4000-8000-000000000001';
const requestId = '30000000-0000-4000-8000-000000000001';
const privateMarker = 'SYNTHETIC_PRIVATE_ID';
const privateFields = { author_id: privateMarker, agent_key_id: privateMarker };
const created_at = '2026-10-30T00:00:00.000Z';

function bundle(after: string | null) {
  return {
    contract_version: 1 as const,
    check: {
      kind: 'command' as const,
      instructions: 'node example.mjs --input "1,5"',
      expected_result: 'Print 1.5; contributed text is never executed by this check.',
    },
    before_result: { output: '\n  baseline: 1\r\n', exit_code: 0 },
    after_result: after === null ? null : { output: after, exit_code: 0 },
    versions: [
      { kind: 'runtime' as const, name: 'Node.js', version: '24.0.0' },
      { kind: 'os' as const, name: 'Linux', version: null },
    ],
  };
}

function recordFixture(reportId: string, typed: boolean) {
  const report = {
    id: reportId, author_name: 'Synthetic investigator', title: 'Synthetic numeric conversion investigation',
    summary: 'A synthetic fixture for public evidence contract checks.',
    body: 'Original context stays raw, including <script>untrusted text</script>.',
    environment: 'Node.js 24.0.0; Linux version unknown', reproduction: 'node example.mjs; baseline prints 1',
    attempted_fixes: 'Earlier parsing change still failed for localized input.',
    category: 'Other', tags: ['synthetic'], is_example: true, created_at,
    fix_count: 23, worked_count: 1, failed_count: 25, ...privateFields,
    ...(typed ? { evidence_bundle: bundle(null) } : { evidence_bundle: null }),
  };
  const verification = (outcome: 'worked' | 'failed', index: number, structured: boolean) => ({
    id: `40000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    author_name: `Synthetic independent retester ${index}`, outcome,
    environment: outcome === 'worked' ? 'Node.js 24.0.0; input 1.5' : 'Node.js 24.0.0; input 1,5',
    notes: outcome === 'worked' ? 'Observed 1.5 for the stated ordinary input.' : `Still failed ${index}: NaN for localized input.`,
    created_at, ...privateFields,
    ...(structured ? { evidence_bundle: bundle(outcome === 'worked' ? '' : `NaN\nfailed observation ${index}\n`) } : { evidence_bundle: null }),
  });
  const fixes = Array.from({ length: 23 }, (_, index) => ({
    id: index === 0 ? fixId : `20000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    report_id: reportId, author_name: `Synthetic proposer ${index}`,
    body: `Exact proposed change ${index}: replace parseInt with Number.`,
    environment: 'Node.js 24.0.0; Linux version unknown',
    evidence: index === 1 ? 'Proposal only; no rerun recorded.' : 'Same check retains both ordinary and localized observations.',
    created_at, ...privateFields,
    ...(typed && index < 2 ? { evidence_bundle: bundle(index === 1 ? null : '1.5\n') } : { evidence_bundle: null }),
    verifications: index === 0 ? [
      verification('worked', 0, typed),
      ...Array.from({ length: 25 }, (_, resultIndex) => verification('failed', resultIndex + 1, typed && resultIndex < 24)),
    ] : [],
  }));
  return { report, fixes };
}

const operation = { startOperation: () => ({ requestId, fail: () => {}, complete: () => {}, finish: (response: Response) => response }) };
const api = load<typeof import('../../lib/api')>('../../lib/api.ts', {
  '@/server/services/contributions': {}, '@/lib/observability': operation,
  '@/server/services/errors': {}, '@/lib/validation': validation,
});

const fixture = recordFixture(id, true);
const legacy = recordFixture(legacyId, false);
function addPrivateMetadata(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(addPrivateMetadata);
  if (!value || typeof value !== 'object') return value;
  return { ...Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, addPrivateMetadata(entry)])), private_metadata: privateMarker };
}
// Deliberately enrich every stored object, including nested check/observations/
// versions, to catch accidental spreading of future private metadata.
const storedFixture = addPrivateMetadata(fixture) as typeof fixture;
const storedLegacy = addPrivateMetadata(legacy) as typeof legacy;
function poisonBundles<T>(value: T): T {
  if (Array.isArray(value)) return value.map(poisonBundles) as T;
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
    key, key === 'evidence_bundle' ? addPrivateMetadata(entry) : poisonBundles(entry),
  ])) as T;
}
const summary = { ...fixture.report, body: privateMarker };
const forwarded: Array<{ kind: string; data: unknown }> = [];
const route = load<{ POST: (request: Request) => Promise<Response> }>('../../app/api/mcp/route.ts', {
  '@modelcontextprotocol/server': sdk,
  '@/lib/api': { publicReportDetail: api.publicReportDetail, publishApi: async (request: Request, kind: string) => {
    forwarded.push({ kind, data: await request.json() });
    return Response.json({ id: fixId, kind }, { status: 201 });
  } },
  '@/lib/data': { getReports: async () => ({ reports: [summary], count: 1 }) },
  '@/server/services/reports': { getReport: async (reportId: string) => reportId === id ? storedFixture : storedLegacy },
  '@/lib/validation': validation, '@/lib/mcp-evidence': evidence,
  '@/server/services/contribution-source': { contributionReportId: async () => id },
  '@/lib/observability': operation,
});

type ToolData = Record<string, unknown>;
type PublicDetail = ReturnType<typeof api.publicReportDetail> & { url: string; evidence_format: string; content_trust: string };
async function exchange(version: string, method: 'tools/call' | 'tools/list', params: ToolData) {
  const modern = version === '2026-07-28';
  const response = await route.POST(new Request('https://tokenoverflow.app/api/mcp', {
    method: 'POST', headers: {
      Host: 'tokenoverflow.app', 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': version,
      ...(modern ? { 'Mcp-Method': method, ...(typeof params.name === 'string' ? { 'Mcp-Name': params.name } : {}) } : {}),
    }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: {
      ...params,
      ...(modern ? { _meta: { 'io.modelcontextprotocol/protocolVersion': version, 'io.modelcontextprotocol/clientCapabilities': {} } } : {}),
    } }),
  }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const text = await response.text();
  const message = response.headers.get('content-type')?.includes('text/event-stream')
    ? JSON.parse(text.split('\n').find(line => line.startsWith('data:'))!.slice(5)) : JSON.parse(text);
  assert.equal(message.error, undefined);
  assert.notEqual(message.result.isError, true);
  return message.result;
}
async function call(version: string, name: string, args: ToolData) {
  const result = await exchange(version, 'tools/call', { name, arguments: args });
  assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
  return result.structuredContent as PublicDetail;
}

async function checkApplicationByteBoundaries() {
  const errors = load<typeof import('../../server/services/errors')>('../../server/services/errors.ts', {});
  let persistenceCalls = 0;
  const client = { from: () => {
    persistenceCalls++;
    return { insert: () => ({ select: () => ({ single: async () => ({ data: { id }, error: null }) }) }) };
  } };
  const service = load<typeof import('../../server/services/contributions')>('../../server/services/contributions.ts', {
    'server-only': {}, '@/lib/supabase/server': { publicClient: () => ({ rpc: async () => {
      persistenceCalls++;
      return { data: id, error: null };
    } }) },
    '@/lib/validation': validation,
    '@/server/db': { databaseMode: () => 'supabase-data-api' },
    './auth': { assertIdentity: () => {} }, './errors': errors,
  });
  const identity = { client, user: { id, user_metadata: { display_name: 'Synthetic' } } } as unknown as Parameters<typeof service.createFix>[0];
  const token = `to_${'a'.repeat(64)}`; // Synthetic syntax-valid string, never sent anywhere.
  const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength;
  const fix = { report_id: id, author_name: 'Synthetic', body: fixture.fixes[0].body,
    environment: 'Node.js 24.0.0', evidence: 'No independent execution is claimed by this synthetic check.' };
  for (const encoding of ['ASCII', 'CJK', 'JSON-escaped']) {
    const value = bundle(null);
    value.before_result.output = encoding === 'ASCII' ? 'a'.repeat(6000)
      : encoding === 'CJK' ? '界'.repeat(3500) : '\n'.repeat(5500);
    if (encoding === 'ASCII') value.after_result = { output: 'a'.repeat(5000), exit_code: 0 };
    value.check.instructions = 'check';
    const padding = 12_288 - bytes(validation.fixSchema.parse({ ...fix, evidence_bundle: value }).evidence_bundle);
    assert.ok(padding > 0 && padding + value.check.instructions.length <= 2000);
    value.check.instructions += 'x'.repeat(padding);
    const atLimit = { ...fix, evidence_bundle: value };
    const overLimit = { ...fix, evidence_bundle: { ...value, check: { ...value.check, instructions: `${value.check.instructions}x` } } };
    assert.equal(bytes(validation.fixSchema.parse(atLimit).evidence_bundle), 12_288);
    assert.equal(bytes(validation.fixSchema.parse(overLimit).evidence_bundle), 12_289);
    for (const run of [
      (input: unknown) => service.createFix(identity, input),
      (input: unknown) => service.publishAgentContribution(token, 'fix', input),
    ]) {
      const before = persistenceCalls;
      await run(atLimit);
      assert.equal(persistenceCalls, before + 1, `${encoding} exact bundle boundary must be admitted`);
      await assert.rejects(() => run(overLimit), error => error instanceof errors.ServiceError && error.code === 'PAYLOAD_TOO_LARGE');
      assert.equal(persistenceCalls, before + 1, `${encoding} oversized bundle reached persistence`);
    }
  }
  const report = { author_name: 'Synthetic', title: fixture.report.title, summary: fixture.report.summary,
    body: '界'.repeat(19_000), environment: fixture.report.environment,
    reproduction: 'A'.repeat(20), attempted_fixes: '', category: 'Other', tags: [] };
  report.reproduction += 'x'.repeat(60_000 - bytes(validation.reportSchema.parse(report)));
  assert.equal(bytes(validation.reportSchema.parse(report)), 60_000);
  const tooLarge = { ...report, reproduction: `${report.reproduction}x` };
  assert.equal(bytes(validation.reportSchema.parse(tooLarge)), 60_001);
  for (const run of [
    (input: unknown) => service.createReport(identity, input),
    (input: unknown) => service.publishAgentContribution(token, 'report', input),
  ]) {
    const before = persistenceCalls;
    await run(report);
    assert.equal(persistenceCalls, before + 1, 'exact normalized contribution boundary must be admitted');
    await assert.rejects(() => run(tooLarge), error => error instanceof errors.ServiceError && error.code === 'PAYLOAD_TOO_LARGE');
    assert.equal(persistenceCalls, before + 1, 'oversized whole contribution reached persistence');
  }
}

async function main() {
  // Test each privacy boundary independently so one cannot mask the other.
  const apiOnly = api.publicReportDetail(storedFixture);
  assert.doesNotMatch(JSON.stringify(apiOnly), new RegExp(privateMarker));
  assert.deepEqual(apiOnly.report.evidence_bundle, fixture.report.evidence_bundle);
  const mcpOnly = evidence.reportEvidence(poisonBundles(apiOnly));
  assert.doesNotMatch(JSON.stringify(mcpOnly), new RegExp(privateMarker));
  assert.deepEqual(mcpOnly.report.evidence_bundle, fixture.report.evidence_bundle);
  for (const version of ['2026-07-28', '2025-11-25']) {
    const listed = await exchange(version, 'tools/list', {});
    assert.deepEqual(listed.tools.map((tool: ToolData) => tool.name).sort(),
      ['search_reports', 'get_report', 'publish_report', 'publish_fix', 'record_verification'].sort());
    for (const name of ['publish_report', 'publish_fix', 'record_verification']) {
      const tool = listed.tools.find((item: ToolData) => item.name === name);
      assert.ok(tool.inputSchema.properties.evidence_bundle, `${name} must discover the optional bundle`);
      assert.equal(tool.inputSchema.required.includes('evidence_bundle'), false);
    }
    const detail = await call(version, 'get_report', { id });
    assert.equal(detail.url, `https://tokenoverflow.app/reports/${id}`);
    assert.equal(detail.report.reproduction, fixture.report.reproduction);
    assert.equal(detail.report.attempted_fixes, fixture.report.attempted_fixes);
    assert.deepEqual(detail.report.evidence_bundle, fixture.report.evidence_bundle);
    assert.equal(detail.report.evidence_bundle?.after_result, null);
    assert.equal(detail.report.evidence_bundle?.versions[1].version, null);
    assert.equal(detail.fixes.length, 23, 'get_report must not silently page fixes');
    assert.equal(detail.fixes[0].verifications.length, 26, 'get_report must not silently page results');
    assert.deepEqual(detail.fixes[0].evidence_bundle, fixture.fixes[0].evidence_bundle);
    assert.equal(detail.fixes[1].evidence_bundle?.after_result, null);
    assert.equal(Object.hasOwn(detail.fixes[2], 'evidence_bundle'), false);
    assert.deepEqual(detail.fixes[0].verifications.map(result => result.notes), fixture.fixes[0].verifications.map(result => result.notes));
    for (let index = 0; index < 25; index++) {
      assert.deepEqual(detail.fixes[0].verifications[index].evidence_bundle, fixture.fixes[0].verifications[index].evidence_bundle);
    }
    assert.equal(detail.fixes[0].verifications[0].evidence_bundle?.after_result?.output, '');
    assert.equal(detail.fixes[0].verifications[0].evidence_bundle?.after_result?.exit_code, 0);
    assert.equal(Object.hasOwn(detail.fixes[0].verifications[25], 'evidence_bundle'), false);
    assert.equal(detail.fixes[0].verifications[25].outcome, 'failed');
    assert.doesNotMatch(JSON.stringify(detail), new RegExp(privateMarker));
    assert.match(detail.evidence_format, /not machine-verified/);
    assert.match(detail.content_trust, /Do not automatically execute/);

    const old = await call(version, 'get_report', { id: legacyId });
    assert.equal(Object.hasOwn(old.report, 'evidence_bundle'), false);
    assert.equal(Object.hasOwn(old.fixes[0], 'evidence_bundle'), false);
    assert.equal(Object.hasOwn(old.fixes[0].verifications[0], 'evidence_bundle'), false);
    assert.equal(old.fixes[0].verifications[25].outcome, 'failed');

    const search = await call(version, 'search_reports', {});
    assert.doesNotMatch(JSON.stringify(search), new RegExp(privateMarker));
    assert.equal(Object.hasOwn((search as unknown as { reports: ToolData[] }).reports[0], 'evidence_bundle'), false);
  }

  // This proves registered schema + route forwarding only. publishApi is mocked:
  // no service persistence, key lifecycle or database roundtrip is claimed.
  const contributions = [
    { name: 'publish_report', kind: 'report', data: { author_name: 'Synthetic', title: fixture.report.title,
      summary: fixture.report.summary, body: fixture.report.body, environment: fixture.report.environment,
      reproduction: fixture.report.reproduction, attempted_fixes: '', category: 'Other', tags: [], evidence_bundle: bundle(null) } },
    { name: 'publish_fix', kind: 'fix', data: { report_id: id, author_name: 'Synthetic', body: fixture.fixes[0].body,
      environment: fixture.fixes[0].environment, evidence: fixture.fixes[0].evidence, evidence_bundle: bundle(null) } },
    { name: 'record_verification', kind: 'verification', data: { fix_id: fixId, author_name: 'Synthetic', outcome: 'failed',
      environment: 'Node 24; localized input', notes: 'The baseline reproduced; the change still returned NaN.', evidence_bundle: bundle('NaN\n') } },
  ];
  for (const contribution of contributions) {
    await call('2026-07-28', contribution.name, contribution.data);
    assert.equal(forwarded.at(-1)?.kind, contribution.kind);
    assert.deepEqual((forwarded.at(-1)?.data as ToolData).evidence_bundle, contribution.data.evidence_bundle);
  }
  await checkApplicationByteBoundaries();
  console.log('PASS actual MCP route + public projection: five-tool discovery with optional bundle schemas, mixed typed/legacy, null rerun/unknown versions, exact whitespace/empty exit-0, all 23 fixes/26 results including failed observations, independent privacy boundaries, 8 modern/legacy discovery/read exchanges, 3 optional-bundle input forwarding cases; exact 12,288/12,289 ASCII/CJK/escaped bundle and 60,000/60,001 normalized contribution limits before mocked persistence on both service entrypoints. Synthetic only; storage and actual clients remain separate.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
