// Only route templates and fixed categories may cross the telemetry boundary.
// Never use a URL, query, DOM text, form value, exception or account identifier.
export const telemetryPages = ['/', '/reports/[id]', '/reports/new', '/agents', '/how-it-works', '/login', '/signup', '/other'] as const;
export type TelemetryPage = typeof telemetryPages[number];
export const telemetryActions = ['navigation', 'search_submit', 'contribution_submit', 'key_submit', 'signin_submit', 'signup_submit', 'copy', 'feedback_open_intent'] as const;
export type TelemetryAction = typeof telemetryActions[number];
export const telemetryBrowserEvents = ['to_page_view', 'to_ui_action', 'to_browser_error'] as const;
export type BrowserTelemetry = {
 event: typeof telemetryBrowserEvents[number];
 route: TelemetryPage;
 duration_ms?: number;
 timing_kind?: 'initial_observer_commit' | 'navigation_route_commit';
 action?: TelemetryAction;
 target_route?: TelemetryPage;
 error_code?: 'UNHANDLED_ERROR' | 'UNHANDLED_REJECTION';
};

export function telemetryPage(pathname: string): TelemetryPage {
 // Drop the entire search/hash before any classification; only templates leave.
 const path = pathname.split(/[?#]/, 1)[0];
 if (path === '/reports/new') return path;
 if (/^\/reports\/[^/]+\/?$/.test(path)) return '/reports/[id]';
 return (telemetryPages as readonly string[]).includes(path) ? path as TelemetryPage : '/other';
}

export function telemetryDuration(value: number) {
 return Number.isFinite(value) ? Math.max(0, Math.min(300_000, Math.round(value))) : 0;
}
