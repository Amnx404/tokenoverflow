// Independent contract/service acceptance. Synthetic persistence boundaries only.
// Run: node scripts/qa/evidence-bundle.ts (Node 26 native type stripping).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load<T>(path: string, mocks: Record<string, unknown> = {}): T {
  const code = ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  new Function('module', 'exports', 'require', 'TextEncoder', code)(loaded, loaded.exports,
    (name: string) => Object.hasOwn(mocks, name) ? mocks[name] : require(name), TextEncoder);
  return loaded.exports as T;
}
const types = load<typeof import('../../lib/types')>('../../lib/types.ts');
const schemas = load<typeof import('../../lib/validation')>('../../lib/validation.ts', { './types': types });
const errors = load<typeof import('../../server/services/errors')>('../../server/services/errors.ts');
const base = {
  contract_version: 1,
  check: { kind: 'steps', instructions: 'repeat the recorded check', expected_result: 'expected observation' },
  before_result: { output: '', exit_code: 0 }, after_result: null,
  versions: [{ kind: 'runtime', name: 'Node.js', version: null as string | null }],
};
type Kind = 'report' | 'fix' | 'verification';
const payloads = {
  report: { author_name: 'x', title: 'Synthetic investigation title', summary: 'Synthetic independent contract acceptance.',
    body: 'Sanitized original problem and context.', environment: 'Runtime version unknown', reproduction: 'Repeat the recorded minimal example.', attempted_fixes: '', category: 'Other', tags: [] },
  fix: { author_name: 'x', report_id: '10000000-0000-4000-8000-000000000001', body: 'The exact proposed change is recorded here.', environment: 'Runtime version unknown', evidence: 'A rerun has not yet been recorded.' },
  verification: { author_name: 'x', fix_id: '20000000-0000-4000-8000-000000000001', outcome: 'failed', environment: 'Runtime version unknown', notes: 'The same check still failed after the change.' },
};
const kindSchema = { report: schemas.reportSchema, fix: schemas.fixSchema, verification: schemas.verificationSchema };
function bundle(kind: Kind) { return { ...structuredClone(base), after_result: kind === 'verification' ? { output: 'still failed', exit_code: 0 } : null }; }
const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value), 'utf8');

let persistence = 0;
let modeReads = 0;
let mode = 'supabase-data-api';
const id = '30000000-0000-4000-8000-000000000001';
const saved: unknown[] = [];
const client = { from: () => {
  persistence++;
  return { insert: (value: unknown) => { saved.push(value); return { select: () => ({ single: async () => ({ data: { id }, error: null }) }) }; } };
} };
const service = load<typeof import('../../server/services/contributions')>('../../server/services/contributions.ts', {
  'server-only': {}, '@/lib/validation': schemas, './errors': errors,
  './auth': { assertIdentity: () => {} },
  '@/lib/supabase/server': { publicClient: () => ({ rpc: async (_name: string, args: { p_data: unknown }) => {
    persistence++; saved.push(args.p_data); return { data: id, error: null };
  } }) },
  '@/server/db': { databaseMode: () => { modeReads++; return mode; }, withDatabase: async (callback: (tx: unknown) => Promise<unknown>) => {
    persistence++; return callback({ execute: async () => [{ id }] });
  } },
});
const identity = { client, user: { id, user_metadata: { display_name: 'x' } } } as unknown as Parameters<typeof service.createReport>[0];
const token = `to_${'a'.repeat(64)}`;
const create = { report: service.createReport, fix: service.createFix, verification: service.createVerification };
async function rejectBeforePersistence(kind: Kind, value: unknown) {
  const before = { persistence, modeReads };
  for (const run of [() => create[kind](identity, value), () => service.publishAgentContribution(token, kind, value)]) {
    await assert.rejects(run);
    assert.deepEqual({ persistence, modeReads }, before, `${kind}: invalid input reached database selection/work`);
  }
}

for (const kind of ['report', 'fix', 'verification'] as const) {
  const b = bundle(kind);
  const invalid: unknown[] = [null, {}, { ...b, contract_version: 2 }, { ...b, future_field: 'reject' },
    { ...b, check: { ...b.check, future_field: 'reject' } },
    { ...b, before_result: { output: '', future_field: 'reject' } },
    { ...b, versions: [{ kind: 'runtime', name: 'Node.js', version: null, future_field: 'reject' }] },
    { ...b, versions: [{ kind: 'runtime', name: 'Node.js' }] },
    { ...b, versions: [] }, { ...b, versions: Array.from({ length: 13 }, (_, i) => ({ kind: 'runtime', name: `n${i}`, version: null })) },
    { ...b, versions: [{ kind: 'runtime', name: ' Node.js ', version: null }, { kind: 'runtime', name: 'Node.js', version: 'other' }] },
    { ...b, before_result: { output: '' } },
  ];
  for (const key of Object.keys(b)) { const partial = { ...b } as Record<string, unknown>; delete partial[key]; invalid.push(partial); }
  for (const exit_code of [-1, 256, 0.5, NaN, Infinity, '0', null]) invalid.push({ ...b, before_result: { output: 'observed', exit_code } });
  for (const invalidText of ['\0', '\uD800', '\uDC00', 'x\uD800x', '\uDC00\uD800']) {
    invalid.push({ ...b, before_result: { output: invalidText } },
      { ...b, check: { ...b.check, instructions: invalidText } },
      { ...b, check: { ...b.check, expected_result: invalidText } },
      { ...b, versions: [{ kind: 'runtime', name: invalidText, version: null }] },
      { ...b, versions: [{ kind: 'runtime', name: 'Node.js', version: invalidText }] });
  }
  invalid.push({ ...b, before_result: { output: '😀'.repeat(6001) } },
    { ...b, check: { ...b.check, instructions: '😀'.repeat(2001) } },
    { ...b, versions: [{ kind: 'runtime', name: '😀'.repeat(81), version: null }] },
    { ...b, versions: [{ kind: 'runtime', name: 'Node.js', version: '😀'.repeat(121) }] });
  if (kind === 'report') invalid.push({ ...b, after_result: { output: 'after' } });
  if (kind === 'verification') invalid.push({ ...b, after_result: null }, { ...b, after_result: { output: '' } });
  for (const candidate of invalid) {
    const value = { ...payloads[kind], evidence_bundle: candidate };
    assert.equal(kindSchema[kind].safeParse(value).success, false);
    for (mode of ['supabase-data-api', 'drizzle']) await rejectBeforePersistence(kind, value);
  }
  // Legacy payloads stay valid; structured evidence remains optional.
  assert.equal(Object.hasOwn(kindSchema[kind].parse(payloads[kind]), 'evidence_bundle'), false);
  for (mode of ['supabase-data-api', 'drizzle']) {
    await create[kind](identity, payloads[kind]);
    await service.publishAgentContribution(token, kind, payloads[kind]);
    await create[kind](identity, { ...payloads[kind], evidence_bundle: b });
    await service.publishAgentContribution(token, kind, { ...payloads[kind], evidence_bundle: b });
  }
}

// Code-point limits differ from legacy JS length; normalization is explicitly
// U+0020-only and must not fold case, NBSP, tabs, or canonically related Unicode.
for (const [field, max] of [['output', 6000], ['instructions', 2000], ['name', 80], ['version', 120]] as const) {
  const b = bundle('fix');
  if (field === 'output') b.before_result.output = '😀'.repeat(max);
  else if (field === 'instructions') b.check.instructions = '😀'.repeat(max);
  else b.versions = [{ kind: 'runtime', name: field === 'name' ? '😀'.repeat(max) : 'Node.js', version: field === 'version' ? '😀'.repeat(max) : null }];
  assert.equal(schemas.fixSchema.safeParse({ ...payloads.fix, evidence_bundle: b }).success, true);
}
const raw = bundle('fix');
raw.before_result.output = ' \r\n\t ';
raw.check.instructions = ' \tnode check\n ';
raw.versions = [
  { kind: 'runtime', name: ' Node.js ', version: null },
  { kind: 'runtime', name: 'node.js', version: ' unknown ' },
  { kind: 'runtime', name: '\u00a0Node.js\u00a0', version: null },
  { kind: 'runtime', name: '\tNode.js\t', version: null },
  { kind: 'runtime', name: 'é', version: null },
  { kind: 'runtime', name: 'e\u0301', version: null },
  { kind: 'package', name: 'Node.js', version: null },
];
const parsed = schemas.fixSchema.parse({ ...payloads.fix, evidence_bundle: raw }).evidence_bundle!;
assert.equal(parsed.before_result.output, raw.before_result.output);
assert.equal(parsed.check.instructions, '\tnode check\n');
assert.deepEqual(parsed.versions.map(v => v.name), ['Node.js', 'node.js', '\u00a0Node.js\u00a0', '\tNode.js\t', 'é', 'e\u0301', 'Node.js']);
assert.equal(parsed.versions[1].version, 'unknown');
for (const outcome of ['worked', 'failed']) {
  const observation = schemas.verificationSchema.parse({ ...payloads.verification, outcome, evidence_bundle: bundle('verification') });
  assert.equal(observation.evidence_bundle?.after_result.output, 'still failed');
  assert.equal(observation.outcome, outcome, 'exit zero or output text must not infer an outcome');
}

// Derived website author is counted after attribution. The same agent payload
// fits, while a larger identity-derived author must reject before DB selection.
const near = { ...payloads.report, body: '界'.repeat(17000), reproduction: 'x'.repeat(20) };
near.reproduction += 'a'.repeat(59_900 - bytes(schemas.reportSchema.parse(near)));
assert.equal(bytes(schemas.reportSchema.parse(near)), 59_900);
const largeIdentity = { ...identity, user: { ...identity.user, user_metadata: { display_name: '界'.repeat(80) } } };
assert.ok(bytes(schemas.reportSchema.parse({ ...near, author_name: '界'.repeat(80) })) > 60_000);
for (mode of ['supabase-data-api', 'drizzle']) {
  await service.publishAgentContribution(token, 'report', near);
  const before = { persistence, modeReads };
  await assert.rejects(() => service.createReport(largeIdentity, near), error => error instanceof errors.ServiceError && error.code === 'PAYLOAD_TOO_LARGE');
  assert.deepEqual({ persistence, modeReads }, before);
}
mode = 'supabase-data-api';
await service.createReport(identity, { ...payloads.report, author_name: '界'.repeat(25000), ignored_legacy_field: '界'.repeat(25000) });
assert.equal((saved.at(-1) as { author_name: string }).author_name, 'x');
assert.equal(Object.hasOwn(saved.at(-1) as object, 'ignored_legacy_field'), false);
console.log('PASS independent strict/null/legacy/Unicode/version-identity matrix through both mutation entrypoints and persistence modes; invalid input rejected before DB selection; identity-derived UTF-8 budget and normalized allowlist verified. Synthetic only; no stored roundtrip, OAuth, SQL migration or executed-evidence claim.');
