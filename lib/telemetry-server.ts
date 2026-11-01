import 'server-only';
import { randomUUID } from 'node:crypto';
import { after } from 'next/server';
import type { PostHog } from 'posthog-node';
import { z } from 'zod';
import { createTelemetryQueue, type TelemetryEnvelope } from './telemetry-queue';
import { telemetryActions, telemetryPages, telemetryPage, telemetryDuration } from './telemetry-shared';

const duration = z.number().int().min(0).max(300_000);
const page = z.enum(telemetryPages);
const common = { route: page, synthetic: z.boolean().default(false) };
export const browserTelemetrySchema = z.discriminatedUnion('event', [
 z.strictObject({ event: z.literal('to_page_view'), ...common, duration_ms: duration.optional(), timing_kind: z.enum(['initial_observer_commit', 'navigation_route_commit']).optional() }),
 z.strictObject({ event: z.literal('to_ui_action'), ...common, action: z.enum(telemetryActions), target_route: page.optional() }),
 z.strictObject({ event: z.literal('to_browser_error'), ...common, error_code: z.enum(['UNHANDLED_ERROR', 'UNHANDLED_REJECTION']) }),
]);

export const telemetryOperationRoutes = ['/api/health', '/api/v1/reports', '/api/v1/reports/[id]', '/api/v1/reports/[id]/comments', '/api/v1/reports/[id]/comments/[commentId]', '/api/v1/fixes', '/api/v1/verifications', '/api/mcp', '/api/trpc'] as const;
export const telemetryOperationNames = ['health', 'search_reports', 'get_report', 'list_comments', 'get_comment_context', 'publish_report', 'publish_fix', 'record_verification', 'mcp_transport', 'list_agent_keys', 'create_agent_key', 'revoke_agent_key', 'rpc'] as const;
export const telemetryErrorCodes = ['INVALID_INPUT', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT', 'RATE_LIMITED', 'REQUEST_TOO_LARGE', 'UNSUPPORTED_MEDIA_TYPE', 'METHOD_NOT_ALLOWED', 'DEPENDENCY_UNAVAILABLE', 'CONFIGURATION_MISSING', 'INTERNAL_ERROR', 'TRANSPORT_ERROR'] as const;
export const operationTelemetrySchema = z.strictObject({
 route: z.enum(telemetryOperationRoutes), operation: z.enum(telemetryOperationNames),
 status: z.number().int().min(100).max(599), duration_ms: duration,
 request_id: z.uuid(), error_code: z.enum(telemetryErrorCodes).nullable(),
 scope: z.enum(['operation', 'transport']), synthetic: z.boolean(),
});

export type TelemetryContext = { synthetic?: boolean; scope?: 'operation' | 'transport' };
export function requestTelemetryContext(request: Request): TelemetryContext {
 // A public assertion can only mark synthetic, never claim a genuine operator.
 return { synthetic: request.headers.get('X-TokenOverflow-Synthetic') === '1' };
}

function configuration() {
 // after() can run for prerenders. Build work is not a request denominator.
 if (process.env.NEXT_PHASE === 'phase-production-build') return null;
 const token = process.env.POSTHOG_PROJECT_TOKEN;
 const host = process.env.POSTHOG_HOST;
 if (process.env.TOKENOVERFLOW_TELEMETRY_ENABLED !== 'true' || !token || !host) return null;
 // No dynamic destination from requests, and never use an admin/personal token.
 if (!/^phc_[A-Za-z0-9_-]+$/.test(token) || !['https://us.i.posthog.com', 'https://eu.i.posthog.com'].includes(host)) return null;
 return { token, host };
}
export function telemetryEnabled() { return configuration() !== null; }

let posthog: { key: string; client: PostHog } | undefined;
export async function deliverTelemetryBatch(events: TelemetryEnvelope[]) {
 const config = configuration();
 if (!config || !events.length) return;
 const key = `${config.host}:${config.token}`;
 if (!posthog || posthog.key !== key) {
  // Load the SDK only for enabled delivery inside the after() callback.
  const { PostHog } = await import('posthog-node');
  posthog = { key, client: new PostHog(config.token, {
  host: config.host, flushAt: 101, maxBatchSize: 101, maxQueueSize: 100,
  flushInterval: 0, requestTimeout: 1000, fetchRetryCount: 0,
  disableGeoip: true, enableLocalEvaluation: false, enableExceptionAutocapture: false,
  before_send: event => {
   if (!['to_operation_completed', 'to_page_view', 'to_ui_action', 'to_browser_error', 'to_server_render_error', 'to_auth_outcome'].includes(event.event)) return null;
   const allowed = new Set(['schema_version', 'auth_status', 'route', 'route_type', 'operation', 'status', 'duration_ms', 'request_id', 'error_code', 'scope', 'release', 'environment', 'traffic_class', 'outcome', 'action', 'target_route', 'timing_kind', '$process_person_profile', '$geoip_disable', '$lib', '$lib_version', '$is_server']);
   return { ...event, properties: Object.fromEntries(Object.entries(event.properties ?? {}).filter(([key]) => allowed.has(key))) };
  },
 }) };
 }
 const client = posthog.client;
 // Reuse the bounded client and explicitly flush after a response. shutdown()
 // logs raw failure bodies internally in this pinned SDK, so do not call it in
 // a request lifecycle. No timer/automatic threshold can start an orphan flush.
 // No identify, aliases, feature flags, traces,
 // exception capture, network spans, persistent IDs or person properties.
 for (const value of events) client.capture({
   distinctId: `event:${randomUUID()}`, event: value.event,
   properties: { ...value.properties, $process_person_profile: false, $geoip_disable: true },
 });
 // Network failures retain at most 100 SDK events; a later lifecycle may retry
 // them. Delivery is best effort, not durable or exactly once.
 await client.flush();
}

const queue = createTelemetryQueue(deliverTelemetryBatch, work => after(work));
let minute = 0;
let minuteEvents = 0;
function enqueue(event: TelemetryEnvelope) {
 if (!telemetryEnabled()) return;
 const now = Math.floor(Date.now() / 60_000);
 if (minute !== now) { minute = now; minuteEvents = 0; }
 // Per-instance guard, not a global billing cap or durable rate limiter.
 if (++minuteEvents > 120) return;
 queue.enqueue(event);
}

function metadata(synthetic: boolean) {
 const configuredRelease = process.env.TOKENOVERFLOW_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA ?? '';
 const release = /^[a-f0-9]{7,40}$/.test(configuredRelease) ? configuredRelease : 'unknown';
 const environment = ['production', 'preview'].includes(process.env.VERCEL_ENV ?? '') ? process.env.VERCEL_ENV! : 'development';
 return { schema_version: 1, release, environment, traffic_class: synthetic || environment !== 'production' || process.env.TOKENOVERFLOW_TELEMETRY_SYNTHETIC === 'true' ? 'synthetic' : 'unclassified' };
}

export function captureOperationTelemetry(input: z.input<typeof operationTelemetrySchema>) {
 try {
  const parsed = operationTelemetrySchema.safeParse(input);
  if (!parsed.success) return;
  const { synthetic, ...properties } = parsed.data;
  enqueue({ event: 'to_operation_completed', properties: {
   ...properties, ...metadata(synthetic || properties.operation === 'health'),
   outcome: properties.status < 400 ? 'success' : properties.status < 500 ? 'expected_rejection' : 'failure',
  } });
 } catch { /* Telemetry must never change an application result. */ }
}

export function captureBrowserTelemetryServer(input: z.output<typeof browserTelemetrySchema>, requestId: string) {
 try {
  const parsed = browserTelemetrySchema.safeParse(input);
  if (!parsed.success || !z.uuid().safeParse(requestId).success) return;
  const { event, synthetic, ...properties } = parsed.data;
  enqueue({ event, properties: { ...properties, ...metadata(synthetic), request_id: requestId } });
 } catch { /* No raw capture failure or submitted content reaches logs. */ }
}

export function captureServerRenderError(path: string, routeType: 'render' | 'action') {
 try {
  // No error object/message/digest, headers, action payload or raw path leaves.
  enqueue({ event: 'to_server_render_error', properties: {
   ...metadata(false), request_id: randomUUID(), route: telemetryPage(path),
   route_type: routeType, error_code: 'INTERNAL_ERROR',
  } });
 } catch { /* A failing render must not fail again because of telemetry. */ }
}

const authOperations = z.enum(['email_signup', 'email_signin', 'email_confirm', 'auth_callback', 'signout']);
const authStatuses = z.enum(['neutral_confirmation_prompt', 'server_session_verified', 'session_returned', 'signout_returned', 'input_rejected', 'provider_rejected', 'rate_limited', 'unavailable', 'session_unverified']);
type AuthOperation = z.infer<typeof authOperations>;
type AuthStatus = z.infer<typeof authStatuses>;
const authRoutes: Record<AuthOperation, string> = { email_signup: '/signup', email_signin: '/login', email_confirm: '/auth/confirm', auth_callback: '/auth/callback', signout: '/' };

// Only fixed categories enter this helper. Read one synthetic marker server-side;
// never accept form data, provider objects, URLs or caller correlation IDs.
export async function startAuthTelemetry(operation: AuthOperation): Promise<{ finish: (status: AuthStatus) => void }> {
 const noop: { finish: (status: AuthStatus) => void } = { finish: () => {} };
 try {
  if (!telemetryEnabled() || !authOperations.safeParse(operation).success) return noop;
  const started = performance.now();
  const synthetic = (await (await import('next/headers')).headers()).get('X-TokenOverflow-Synthetic') === '1';
  const requestId = randomUUID();
  let recorded = false;
  return { finish(status) {
   try {
    if (recorded) return;
    recorded = true;
    if (!authStatuses.safeParse(status).success) return;
    enqueue({ event: 'to_auth_outcome', properties: {
     ...metadata(synthetic), request_id: requestId, route: authRoutes[operation],
     operation, auth_status: status, duration_ms: telemetryDuration(performance.now() - started),
    } });
   } catch { /* Auth results and redirects are never replaced by telemetry. */ }
  } };
 } catch { return noop; }
}
