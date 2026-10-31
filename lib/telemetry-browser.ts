import { telemetryDuration, telemetryPage, type BrowserTelemetry } from './telemetry-shared';

let pendingNavigation: { route: string; started: number } | undefined;
let minute = 0;
let sent = 0;
let initialPage = true;

export function captureBrowserTelemetry(event: BrowserTelemetry) {
 if (process.env.NEXT_PUBLIC_TELEMETRY_ENABLED !== 'true' || typeof window === 'undefined') return;
 // No persistent identifier, storage, cookie or user profile. Honor DNT/GPC.
 if (navigator.doNotTrack === '1' || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return;
 const currentMinute = Math.floor(Date.now() / 60_000);
 if (minute !== currentMinute) { minute = currentMinute; sent = 0; }
 if (++sent > 30) return;
 // Construct this object explicitly; never spread DOM, exception or caller data.
 const body = {
  event: event.event, route: event.route,
  ...(event.duration_ms === undefined ? {} : { duration_ms: telemetryDuration(event.duration_ms) }),
  ...(event.timing_kind === undefined ? {} : { timing_kind: event.timing_kind }),
  ...(event.action === undefined ? {} : { action: event.action }),
  ...(event.target_route === undefined ? {} : { target_route: event.target_route }),
  ...(event.error_code === undefined ? {} : { error_code: event.error_code }),
  synthetic: navigator.webdriver === true,
 };
 try {
  // Fixed first-party destination; no Referer, cookies, caller headers or retry.
  void fetch('/api/telemetry', {
   method: 'POST', headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify(body), credentials: 'omit', referrerPolicy: 'no-referrer',
   keepalive: true, signal: AbortSignal.timeout(1500),
  }).catch(() => {});
 } catch { /* Analytics must never break an interaction. */ }
}

export function markTelemetryNavigation(pathname: string) {
 pendingNavigation = { route: telemetryPage(pathname), started: performance.now() };
}

// Called by the root observer effect after its route/context commit.
// This does not establish full hydration, streamed feed readiness or usability.
export function captureTelemetryPage(pathname: string) {
 const route = telemetryPage(pathname);
 const navigation = pendingNavigation?.route === route ? pendingNavigation : undefined;
 const timing = navigation ? { duration_ms: performance.now() - navigation.started, timing_kind: 'navigation_route_commit' as const }
  : initialPage ? { duration_ms: performance.now(), timing_kind: 'initial_observer_commit' as const } : {};
 initialPage = false;
 pendingNavigation = undefined;
 captureBrowserTelemetry({ event: 'to_page_view', route, ...timing });
}

export function captureTelemetryCopy() {
 captureBrowserTelemetry({ event: 'to_ui_action', action: 'copy', route: telemetryPage(window.location.pathname) });
}
