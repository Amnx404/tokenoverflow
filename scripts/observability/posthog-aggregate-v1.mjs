// Offline preparation only. No application imports, connector or execution path.
import { readFileSync, lstatSync, realpathSync, openSync, writeFileSync, closeSync, constants, mkdtempSync, mkdirSync, symlinkSync, rmSync } from 'node:fs';
import { join, resolve, parse } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';

const recipePath = fileURLToPath(new URL('./posthog-aggregate-v1.json', import.meta.url));
const contract = {
  "target": {
    "project_id": 700205,
    "host": "us.posthog.com",
    "environment": "production"
  },
  "events": [
    "to_operation_completed",
    "to_auth_outcome",
    "to_browser_error",
    "to_server_render_error"
  ],
  "dimensions": [
    "event",
    "release",
    "traffic",
    "route",
    "operation",
    "span_scope",
    "http_status",
    "outcome",
    "error_code",
    "auth_status"
  ],
  "measures": [
    "observations",
    "measured_count",
    "p50_ms",
    "p95_ms",
    "first_observed_at",
    "last_observed_at"
  ],
  "window": {
    "minutes": 50,
    "bounds": "start_inclusive_end_exclusive",
    "end_format": "YYYY-MM-DDTHH:mm:ssZ",
    "end_required": true,
    "live_clock_freshness_checked": false
  },
  "limit": 200,
  "filters": [
    "timestamp",
    "environment",
    "event"
  ],
  "duration": {
    "measured_events": [
      "to_operation_completed",
      "to_auth_outcome"
    ],
    "error_events_unmeasured": true,
    "missing_is_null": true,
    "unit": "milliseconds",
    "meaning": "internal_span_not_full_response",
    "source_bounds_ms": [
      0,
      300000
    ],
    "integer_required": true
  },
  "allowlists": {
    "routes": [
      "/api/health",
      "/api/v1/reports",
      "/api/v1/reports/[id]",
      "/api/v1/reports/[id]/comments",
      "/api/v1/reports/[id]/comments/[commentId]",
      "/api/v1/fixes",
      "/api/v1/verifications",
      "/api/mcp",
      "/api/trpc",
      "/",
      "/reports/[id]",
      "/reports/new",
      "/agents",
      "/how-it-works",
      "/login",
      "/signup",
      "/other",
      "/auth/confirm",
      "/auth/callback"
    ],
    "operations": [
      "health",
      "search_reports",
      "get_report",
      "list_comments",
      "get_comment_context",
      "publish_report",
      "publish_fix",
      "record_verification",
      "mcp_transport",
      "list_agent_keys",
      "create_agent_key",
      "revoke_agent_key",
      "rpc",
      "email_signup",
      "email_signin",
      "email_confirm",
      "auth_callback",
      "signout"
    ],
    "outcomes": [
      "success",
      "expected_rejection",
      "failure"
    ],
    "auth_statuses": [
      "neutral_confirmation_prompt",
      "server_session_verified",
      "session_returned",
      "signout_returned",
      "input_rejected",
      "provider_rejected",
      "rate_limited",
      "unavailable",
      "session_unverified"
    ],
    "error_codes": [
      "INVALID_INPUT",
      "UNAUTHORIZED",
      "FORBIDDEN",
      "NOT_FOUND",
      "CONFLICT",
      "RATE_LIMITED",
      "REQUEST_TOO_LARGE",
      "UNSUPPORTED_MEDIA_TYPE",
      "METHOD_NOT_ALLOWED",
      "DEPENDENCY_UNAVAILABLE",
      "CONFIGURATION_MISSING",
      "INTERNAL_ERROR",
      "TRANSPORT_ERROR",
      "UNHANDLED_ERROR",
      "UNHANDLED_REJECTION"
    ],
    "traffic": [
      "synthetic",
      "unclassified"
    ],
    "scopes": [
      "operation",
      "transport"
    ]
  },
  "bucketing": {
    "unknown_label": "other",
    "missing_label": null,
    "release_pattern": "^[a-f0-9]{7,40}$",
    "release_fallback": "unknown",
    "status_event": "to_operation_completed",
    "status_bounds": [
      100,
      599
    ],
    "status_integer": true
  }
};
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
function requireCondition(value) { if (!value) throw new Error('Offline preparation rejected'); }
function keys(value, expected) {
  requireCondition(value && typeof value === 'object' && !Array.isArray(value));
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort());
}
function verify(recipe) {
  keys(recipe, ['version', 'status', 'contract', 'provenance', 'limitations']);
  requireCondition(recipe.version === 1 && recipe.status === 'offline_proposal_requires_owner_review');
  // Exact operational shape: no arbitrary SQL, added projection, filter or target.
  assert.deepEqual(recipe.contract, contract);
  keys(recipe.provenance, ['kind', 'history', 'source_scope', 'sources', 'immutable_sources', 'syntax_status']);
  requireCondition(recipe.provenance.kind === 'new_offline_proposal_not_recovered_history');
  for (const field of ['history', 'source_scope', 'syntax_status']) requireCondition(typeof recipe.provenance[field] === 'string' && recipe.provenance[field].length > 0);
  const sourcePaths = ['lib/telemetry-server.ts', 'lib/observability.ts', 'lib/telemetry-shared.ts', 'instrumentation.ts', 'scripts/observability/posthog-queries.sql'];
  requireCondition(Array.isArray(recipe.provenance.sources) && recipe.provenance.sources.length === sourcePaths.length);
  recipe.provenance.sources.forEach((source, i) => {
    keys(source, ['path', 'sha256']);
    requireCondition(source.path === sourcePaths[i] && /^[a-f0-9]{64}$/.test(source.sha256));
  });
  requireCondition(Array.isArray(recipe.provenance.immutable_sources) && recipe.provenance.immutable_sources.length === 3);
  recipe.provenance.immutable_sources.forEach((source, i) => {
    keys(source, ['commit', 'path', 'sha256']);
    requireCondition(source.commit === '040e5d446fdda1447e9eb958183245b0b6ae9bf4' && source.path === sourcePaths[i] && /^[a-f0-9]{64}$/.test(source.sha256));
  });
  requireCondition(Array.isArray(recipe.limitations) && recipe.limitations.length > 0 && recipe.limitations.every(value => typeof value === 'string' && value.length > 0));
  return recipe;
}
function windowFor(endUTC) {
  requireCondition(typeof endUTC === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(endUTC));
  const end = new Date(endUTC);
  requireCondition(Number.isFinite(end.getTime()) && end.toISOString().replace('.000Z', 'Z') === endUTC);
  const start = new Date(end.getTime() - 50 * 60_000).toISOString().replace('.000Z', 'Z');
  requireCondition(/^\d{4}-/.test(start));
  return { start_inclusive_utc: start, end_exclusive_utc: endUTC, minutes: 50 };
}
// Only fixed source labels enter projected groups; property values never form SQL.
const literals = values => values.map(value => `'${value}'`).join(', ');
function categorical(property, values) {
  return `if(${property} IS NULL, NULL, if(${property} IN (${literals(values)}), ${property}, 'other'))`;
}
function bounded(candidate, minimum, maximum) {
  return `${candidate} >= ${minimum} AND ${candidate} <= ${maximum} AND floor(${candidate}) = ${candidate}`;
}
function render(recipe, endUTC) {
  verify(recipe);
  const window = windowFor(endUTC);
  const sqlTime = iso => iso.replace('T', ' ').slice(0, -1);
  const lists = contract.allowlists;
  // Safe conversion/timezone overloads remain proposed HogQL, not live-validated.
  const numeric = property => `toFloatOrNull(toString(${property}))`;
  const status = numeric('properties.status');
  const duration = numeric('properties.duration_ms');
  const measured = `event IN ('to_operation_completed', 'to_auth_outcome') AND ${bounded(duration, 0, 300000)}`;
  const projected = [
    'event',
    "if(match(coalesce(toString(properties.release), ''), '^[a-f0-9]{7,40}$'), toString(properties.release), 'unknown') AS release",
    `${categorical('properties.traffic_class', lists.traffic)} AS traffic`,
    `${categorical('properties.route', lists.routes)} AS route`,
    `if(event IN ('to_operation_completed', 'to_auth_outcome'), ${categorical('properties.operation', lists.operations)}, NULL) AS operation`,
    `if(event = 'to_operation_completed', ${categorical('properties.scope', lists.scopes)}, NULL) AS span_scope`,
    `if(event = 'to_operation_completed' AND ${bounded(status, 100, 599)}, ${status}, NULL) AS http_status`,
    `if(event = 'to_operation_completed', ${categorical('properties.outcome', lists.outcomes)}, NULL) AS outcome`,
    `${categorical('properties.error_code', lists.error_codes)} AS error_code`,
    `if(event = 'to_auth_outcome', ${categorical('properties.auth_status', lists.auth_statuses)}, NULL) AS auth_status`,
    `if(${measured}, ${duration}, NULL) AS measured_duration_ms`,
    'timestamp',
  ];
  const query = `SELECT
 ${contract.dimensions.join(', ')},
 count() AS observations,
 count(measured_duration_ms) AS measured_count,
 if(count(measured_duration_ms) = 0, NULL, round(quantile(0.5)(measured_duration_ms), 1)) AS p50_ms,
 if(count(measured_duration_ms) = 0, NULL, round(quantile(0.95)(measured_duration_ms), 1)) AS p95_ms,
 min(timestamp) AS first_observed_at,
 max(timestamp) AS last_observed_at
FROM (
 SELECT
  ${projected.join(',\n  ')}
 FROM events
 WHERE timestamp >= toDateTime('${sqlTime(window.start_inclusive_utc)}', 'UTC')
  AND timestamp < toDateTime('${sqlTime(window.end_exclusive_utc)}', 'UTC')
  AND properties.environment = 'production'
  AND event IN (${literals(contract.events)})
)
GROUP BY ${contract.dimensions.join(', ')}
ORDER BY event, release, traffic, route, operation
LIMIT 200`;
  return { window, query };
}
function preparedRequest(recipe, recipeSHA, preparerSHA, endUTC) {
  const { window, query } = render(recipe, endUTC);
  return { target: { ...contract.target }, recipe_version: 1, recipe_source: 'scripts/observability/posthog-aggregate-v1.json', recipe_sha256: recipeSHA, preparer_version: 1, preparer_source: 'scripts/observability/posthog-aggregate-v1.mjs', preparer_sha256: preparerSHA, query_sha256: digest(query), window, query };
}
// Offline expectation model only; these checks do not execute or validate HogQL.
function projectedExpectation(event, properties) {
  const category = (value, allowed) => value == null ? null : allowed.includes(value) ? value : 'other';
  const integer = (value, min, max) => {
    if ((typeof value !== 'string' && typeof value !== 'number') || (typeof value === 'string' && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value))) return null;
    const number = Number(value);
    return Number.isFinite(number) && Number.isInteger(number) && number >= min && number <= max ? number : null;
  };
  const lists = contract.allowlists;
  return {
    release: typeof properties.release === 'string' && /^[a-f0-9]{7,40}$/.test(properties.release) ? properties.release : 'unknown',
    route: category(properties.route, lists.routes),
    operation: ['to_operation_completed', 'to_auth_outcome'].includes(event) ? category(properties.operation, lists.operations) : null,
    error_code: category(properties.error_code, lists.error_codes),
    http_status: event === 'to_operation_completed' ? integer(properties.status, 100, 599) : null,
    measured_duration_ms: ['to_operation_completed', 'to_auth_outcome'].includes(event) ? integer(properties.duration_ms, 0, 300000) : null,
  };
}
function realDirectory(path) {
  const absolute = resolve(path);
  let cursor = parse(absolute).root;
  for (const part of absolute.slice(cursor.length).split('/').filter(Boolean)) {
    cursor = join(cursor, part);
    const stat = lstatSync(cursor);
    requireCondition(stat.isDirectory() && !stat.isSymbolicLink());
  }
  requireCondition(realpathSync(absolute) === absolute);
  return absolute;
}
function privateWrite(root, name, value) {
  const absolute = realDirectory(root);
  requireCondition((lstatSync(absolute).mode & 0o777) === 0o700);
  requireCondition(/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.json$/.test(name));
  const path = join(absolute, name);
  // Existing files and symlinks fail; no overwrite, directory creation or retry.
  const fd = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try { writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`); } finally { closeSync(fd); }
  return path;
}
function loadRecipe() {
  requireCondition(!lstatSync(recipePath).isSymbolicLink());
  const bytes = readFileSync(recipePath);
  const preparerPath = fileURLToPath(import.meta.url);
  requireCondition(!lstatSync(preparerPath).isSymbolicLink());
  return { recipe: verify(JSON.parse(bytes)), sha256: digest(bytes), preparerSHA: digest(readFileSync(preparerPath)) };
}
function selfTest(recipe) {
  let cases = 0;
  const pass = fn => { fn(); cases++; };
  const reject = fn => pass(() => assert.throws(fn));
  const alter = fn => { const copy = structuredClone(recipe); fn(copy); return copy; };
  pass(() => assert.deepEqual(windowFor('2026-11-05T00:20:00Z'), { start_inclusive_utc: '2026-11-04T23:30:00Z', end_exclusive_utc: '2026-11-05T00:20:00Z', minutes: 50 }));
  for (const modify of [r => { r.contract.target.project_id = 1; }, r => { r.contract.target.host = 'eu.posthog.com'; }, r => { r.contract.target.environment = 'preview'; }, r => { r.contract.dimensions.push('person'); }, r => { r.contract.filters.push('request_id'); }, r => { r.query = 'SELECT properties'; }, r => { r.contract.events.push("injected' OR 1=1"); }, r => { r.contract.limit = 201; }, r => { r.contract.window.minutes = 51; }, r => { r.contract.duration.missing_is_null = false; }]) reject(() => verify(alter(modify)));
  for (const end of ['2026-02-30T12:00:00Z', '2026-11-05T24:00:00Z', '2026-11-05T12:00:60Z', '2026-11-05T12:00:00+00:00', '2026-11-05T12:00:00.000Z', '2026-11-05T12:00:00Z\x27', undefined]) reject(() => render(recipe, end));
  pass(() => {
    const { query } = render(recipe, '2026-11-05T20:00:00Z');
    assert.ok(query.includes('toFloatOrNull') && query.includes('floor(') && query.includes(', NULL)'));
    assert.ok(query.includes("'UTC')") && query.includes('count(measured_duration_ms) AS measured_count'));
    for (const field of ['route', 'operation', 'error_code', 'auth_status', 'outcome', 'traffic_class', 'scope']) assert.ok(query.includes(`properties.${field} IN (`));
    assert.ok(query.includes("'^[a-f0-9]{7,40}$'"));
    assert.ok(!query.includes('request_id') && !query.includes('person') && !query.includes('traffic_class ='));
    assert.ok(query.endsWith('LIMIT 200'));
    assert.equal(recipe.contract.duration.error_events_unmeasured, true);
  });
  pass(() => {
    const prepared = preparedRequest(recipe, 'a'.repeat(64), 'b'.repeat(64), '2026-11-05T20:00:00Z');
    assert.deepEqual(prepared.target, { project_id: 700205, host: 'us.posthog.com', environment: 'production' });
    assert.equal(prepared.recipe_version, 1);
    assert.equal(prepared.recipe_sha256, 'a'.repeat(64));
    assert.equal(prepared.preparer_sha256, 'b'.repeat(64));
    assert.equal(prepared.query_sha256, digest(prepared.query));
    assert.equal(prepared.preparer_source, 'scripts/observability/posthog-aggregate-v1.mjs');
    assert.equal(prepared.recipe_source, 'scripts/observability/posthog-aggregate-v1.json');
  });
  pass(() => {
    const projected = projectedExpectation('to_operation_completed', { route: 'stored-private-sentinel', operation: 'stored-private-sentinel', error_code: 'stored-private-sentinel', release: 'stored-private-sentinel', status: 'oops', duration_ms: 'oops' });
    assert.deepEqual(projected, { release: 'unknown', route: 'other', operation: 'other', error_code: 'other', http_status: null, measured_duration_ms: null });
    assert.ok(!JSON.stringify(projected).includes('stored-private-sentinel'));
  });
  for (const duration of [null, undefined, '', 'notnumeric', 'NaN', Infinity, -1, 300001, 1.5]) pass(() => assert.equal(projectedExpectation('to_auth_outcome', { duration_ms: duration }).measured_duration_ms, null));
  for (const duration of [0, 300000, '42']) pass(() => assert.equal(projectedExpectation('to_auth_outcome', { duration_ms: duration }).measured_duration_ms, Number(duration)));
  for (const event of ['to_browser_error', 'to_server_render_error']) pass(() => { const row = projectedExpectation(event, { status: 200, duration_ms: 12 }); assert.equal(row.http_status, null); assert.equal(row.measured_duration_ms, null); });
  for (const status of [null, 'bad', 99, 600, 200.5]) pass(() => assert.equal(projectedExpectation('to_operation_completed', { status }).http_status, null));
  pass(() => assert.equal(projectedExpectation('to_auth_outcome', { status: 200 }).http_status, null));
  // Finite filesystem checks are confined to a fresh test root and cleaned up.
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'posthog-aggregate-v1-'));
  try {
    pass(() => { const path = privateWrite(root, 'case.json', { safe: true }); assert.equal(lstatSync(path).mode & 0o777, 0o600); });
    reject(() => privateWrite(root, 'case.json', { overwritten: true }));
    pass(() => assert.deepEqual(JSON.parse(readFileSync(join(root, 'case.json'))), { safe: true }));
    reject(() => privateWrite(join(root, 'absent'), 'case.json', {}));
    reject(() => privateWrite(root, '../escape.json', {}));
    symlinkSync(join(root, 'case.json'), join(root, 'link.json'));
    reject(() => privateWrite(root, 'link.json', {}));
    mkdirSync(join(root, 'public'), { mode: 0o755 });
    reject(() => privateWrite(join(root, 'public'), 'case.json', {}));
    symlinkSync(root, join(root, 'alias'));
    reject(() => privateWrite(join(root, 'alias'), 'case.json', {}));
  } finally { rmSync(root, { recursive: true, force: true }); }
  return cases;
}
function main(args) {
  const loaded = loadRecipe();
  if (args.length === 1 && args[0] === '--verify') {
    console.log(JSON.stringify({ offline_verified: true, recipe_sha256: loaded.sha256 }));
  } else if (args.length === 1 && args[0] === '--self-test') {
    console.log(JSON.stringify({ offline_self_test: 'passed', cases: selfTest(loaded.recipe) }));
  } else {
    requireCondition(args.length === 7 && args[0] === 'prepare' && args[1] === '--end-utc' && args[3] === '--output-root' && args[5] === '--name');
    const request = preparedRequest(loaded.recipe, loaded.sha256, loaded.preparerSHA, args[2]);
    const path = privateWrite(args[4], args[6], request);
    console.log(JSON.stringify({ offline_prepared: true, path, execution_count: 0 }));
  }
}
try { main(process.argv.slice(2)); } catch { console.error('Offline preparation failed; no query executed.'); process.exitCode = 1; }
