-- Candidate HogQL queries, not executed or installed in a project yet.
-- Dashboard: Token Overflow operations. Default window 24h; project timezone.
-- All counts are captured events/attempts, never users or complete traffic.
-- Keep synthetic separate; never sum transport envelopes and logical tools.
-- Auth stages use to_auth_outcome/auth_status, not fabricated HTTP outcomes.
-- neutral_confirmation_prompt does not prove signup/mail; session_returned is
-- not fresh server_session_verified. signout_returned only means call resolved.
-- Stage UUIDs do not join identities or establish a cross-stage conversion funnel.
-- Auth tiles require a separate reviewed native-query plan; none is added here.

-- 1. Logical operation denominator, expected rejections, failures and latency.
SELECT properties.route AS route, properties.operation AS operation,
       properties.release AS release, count() AS captured_attempts,
       countIf(properties.outcome = 'success') AS successful_attempts,
       countIf(properties.outcome = 'expected_rejection') AS expected_rejections,
       countIf(properties.outcome = 'failure') AS failures,
       round(100.0 * countIf(properties.outcome = 'failure') / count(), 2) AS captured_failure_percent,
       quantile(0.5)(toFloat(properties.duration_ms)) AS p50_ms,
       quantile(0.95)(toFloat(properties.duration_ms)) AS p95_ms
FROM events
WHERE event = 'to_operation_completed'
  AND timestamp > now() - INTERVAL 24 HOUR
  AND properties.scope = 'operation'
  AND properties.environment = 'production'
  AND properties.traffic_class = 'unclassified'
GROUP BY route, operation, release
ORDER BY captured_attempts DESC
LIMIT 100

-- 2. Initial observer commit / navigation route commit, including query transitions.
-- These do not establish render readiness, full hydration or usable feed readiness.
-- They are not LCP, TTFB or a session funnel.
SELECT properties.route AS route, properties.timing_kind AS timing,
       properties.release AS release, count() AS captured_views,
       quantile(0.5)(toFloat(properties.duration_ms)) AS p50_ms,
       quantile(0.95)(toFloat(properties.duration_ms)) AS p95_ms
FROM events
WHERE event = 'to_page_view' AND timestamp > now() - INTERVAL 24 HOUR
  AND properties.environment = 'production'
  AND properties.traffic_class = 'unclassified'
  AND properties.duration_ms IS NOT NULL
GROUP BY route, timing, release
ORDER BY p95_ms DESC
LIMIT 50

-- 3. Task intent and actual clipboard success; not contribution conversions.
SELECT properties.route AS route, properties.action AS action,
       properties.target_route AS target_route, count() AS captured_actions
FROM events
WHERE event = 'to_ui_action' AND timestamp > now() - INTERVAL 24 HOUR
  AND properties.environment = 'production'
  AND properties.traffic_class = 'unclassified'
GROUP BY route, action, target_route
ORDER BY captured_actions DESC
LIMIT 50

-- 4. Browser/framework errors have fixed codes, no exception text or sessions.
SELECT event, properties.route AS route, properties.error_code AS error_code,
       properties.release AS release, count() AS captured_errors
FROM events
WHERE event IN ('to_browser_error', 'to_server_render_error')
  AND timestamp > now() - INTERVAL 24 HOUR
  AND properties.environment = 'production'
  AND properties.traffic_class = 'unclassified'
GROUP BY event, route, error_code, release
ORDER BY captured_errors DESC
LIMIT 50

-- 5. Synthetic and unclassified coverage, with transport kept visible separately.
SELECT event, properties.traffic_class AS traffic,
       properties.environment AS environment, properties.scope AS scope,
       properties.release AS release, count() AS captured_events
FROM events
WHERE event IN ('to_operation_completed', 'to_page_view', 'to_ui_action', 'to_browser_error', 'to_server_render_error')
  AND timestamp > now() - INTERVAL 24 HOUR
GROUP BY event, traffic, environment, scope, release
ORDER BY captured_events DESC
LIMIT 100

-- 6. Paste only an application's generated request UUID (never a key/token).
SELECT timestamp, event, properties.request_id AS request_id,
       properties.route AS route, properties.operation AS operation,
       properties.scope AS scope, properties.status AS status,
       properties.duration_ms AS duration_ms, properties.error_code AS error_code,
       properties.release AS release, properties.traffic_class AS traffic
FROM events
WHERE timestamp > now() - INTERVAL 1 HOUR
  AND properties.request_id = 'REPLACE_WITH_GENERATED_REQUEST_UUID'
ORDER BY timestamp ASC
LIMIT 50
