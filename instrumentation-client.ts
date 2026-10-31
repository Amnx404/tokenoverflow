import { captureBrowserTelemetry, markTelemetryNavigation } from './lib/telemetry-browser';
import { telemetryPage } from './lib/telemetry-shared';

if (process.env.NEXT_PUBLIC_TELEMETRY_ENABLED === 'true') {
 // Deliberately discard event.error/message/filename/reason and all stacks.
 window.addEventListener('error', () => captureBrowserTelemetry({ event: 'to_browser_error', route: telemetryPage(window.location.pathname), error_code: 'UNHANDLED_ERROR' }));
 window.addEventListener('unhandledrejection', () => captureBrowserTelemetry({ event: 'to_browser_error', route: telemetryPage(window.location.pathname), error_code: 'UNHANDLED_REJECTION' }));
}

export function onRouterTransitionStart(url: string) {
 markTelemetryNavigation(url);
}
