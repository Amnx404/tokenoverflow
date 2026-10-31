'use client';
import { Suspense, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { captureBrowserTelemetry, captureTelemetryPage } from '@/lib/telemetry-browser';
import { telemetryPage, type TelemetryAction } from '@/lib/telemetry-shared';

function TelemetryObserver() {
 const pathname = usePathname();
 // Depend on navigation identity, never stringify, hash, copy or transmit it.
 // Search/filter/example/page transitions commonly keep the same pathname.
 const search = useSearchParams();
 useEffect(() => {
  captureTelemetryPage(pathname);
 }, [pathname, search]);
 useEffect(() => {
  function clicked(event: MouseEvent) {
   const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
   if (!(anchor instanceof HTMLAnchorElement)) return;
   const url = new URL(anchor.href);
   if (url.origin !== window.location.origin) {
    if (url.origin === 'https://github.com' && url.pathname === '/Amnx404/tokenoverflow/issues/new/choose') {
     captureBrowserTelemetry({ event: 'to_ui_action', action: 'feedback_open_intent', route: telemetryPage(window.location.pathname) });
    }
    return;
   }
   captureBrowserTelemetry({ event: 'to_ui_action', action: 'navigation', route: telemetryPage(window.location.pathname), target_route: telemetryPage(url.pathname) });
  }
  function submitted() {
   const route = telemetryPage(window.location.pathname);
   if (!['/', '/agents', '/login', '/signup', '/reports/new', '/reports/[id]'].includes(route)) return;
   const action: TelemetryAction = route === '/' ? 'search_submit' : route === '/agents' ? 'key_submit' : route === '/login' ? 'signin_submit' : route === '/signup' ? 'signup_submit' : 'contribution_submit';
   // A submit intent is not a successful contribution, key or search response.
   captureBrowserTelemetry({ event: 'to_ui_action', action, route });
  }
  document.addEventListener('click', clicked);
  document.addEventListener('submit', submitted);
  return () => { document.removeEventListener('click', clicked); document.removeEventListener('submit', submitted); };
 }, []);
 return null;
}

export function Telemetry() {
 return <Suspense fallback={null}><TelemetryObserver/></Suspense>;
}
