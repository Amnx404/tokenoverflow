'use client';

import { useEffect } from 'react';

type Environment = {
 document: Document;
 currentDocument: () => Document;
 href: () => string;
 hash: () => string;
 navigation: () => { type: string; name: string } | undefined;
 position: () => { x: number; y: number };
 viewportHeight: () => number;
 events: Pick<Window, 'addEventListener' | 'removeEventListener'>;
 requestFrame: (callback: () => void) => number;
 cancelFrame: (frame: number) => void;
};
const inputs = ['wheel', 'touchstart', 'pointerdown', 'keydown', 'scroll', 'hashchange', 'popstate', 'pagehide'] as const;
const literalChildHash = /^#(?:fix|verification)-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

// The same terminal job is used by production and the focused DOM-double checks.
export function createReportFragmentLandingController(env: Environment) {
 let seen = false;
 let active = false;
 let frame: number | undefined;
 const finish = () => {
  if (!active) return;
  active = false;
  if (frame !== undefined) env.cancelFrame(frame);
  frame = undefined;
  for (const event of inputs) env.events.removeEventListener(event, finish, true);
  env.document.removeEventListener('visibilitychange', finish, true);
 };
 const snapshot = () => {
  try {
   if (env.currentDocument() !== env.document || env.document.visibilityState !== 'visible') return;
   const current = new URL(env.href());
   const rawHash = env.hash();
   const navigation = env.navigation();
   if (!navigation || !['navigate', 'reload'].includes(navigation.type)) return;
   const initial = new URL(navigation.name);
   if (initial.origin !== current.origin || initial.pathname !== current.pathname || initial.search !== current.search || current.hash !== rawHash) return;
   return { current, rawHash };
  } catch { return; }
 };
 const commit = (knownIds: readonly string[]) => {
  if (seen) return;
  seen = true; // No hash/hidden/invalid first content is also terminal; never rearm.
  const initial = snapshot();
  const allowed = new Set(knownIds); // Immutable server-ID snapshot, never later props.
  if (!initial || !literalChildHash.test(initial.rawHash)) return;
  const id = initial.rawHash.slice(1);
  if (!allowed.has(id)) return;
  const bound = () => {
   const now = snapshot();
   const position = env.position();
   return active && Boolean(now && now.current.origin === initial.current.origin && now.current.pathname === initial.current.pathname
    && now.current.search === initial.current.search && now.rawHash === initial.rawHash)
    && position.x === 0 && position.y === 0 && allowed.has(id);
  };
  active = true;
  for (const event of inputs) env.events.addEventListener(event, finish, { capture: true, passive: true });
  env.document.addEventListener('visibilitychange', finish, { capture: true, passive: true });
  try {
   frame = env.requestFrame(() => {
    frame = undefined;
    if (!bound()) { finish(); return; }
    const target = env.document.getElementById(id);
    if (!target || target.id !== id || !target.isConnected || target.ownerDocument !== env.document || !bound()) { finish(); return; }
    const rect = target.getBoundingClientRect();
    const height = env.viewportHeight();
    if (!Number.isFinite(rect.top) || !Number.isFinite(rect.bottom) || !Number.isFinite(height) || height <= 0
     || rect.bottom <= rect.top || (rect.top < height && rect.bottom > 0)) { finish(); return; }
    if (target.id !== id || !target.isConnected || target.ownerDocument !== env.document || env.document.getElementById(id) !== target || !bound()) { finish(); return; }
    finish(); // Remove listeners and consume BEFORE the one instantaneous scroll.
    target.scrollIntoView({ behavior: 'instant', block: 'start', inline: 'nearest' });
   });
  } catch { finish(); }
 };
 return { commit };
}

const jobs = new WeakMap<Document, ReturnType<typeof createReportFragmentLandingController>>();
export function ReportFragmentLanding({ knownIds }: { knownIds: readonly string[] }) {
 useEffect(() => {
  const doc = window.document;
  let job = jobs.get(doc);
  if (!job) {
   job = createReportFragmentLandingController({
    document: doc, currentDocument: () => window.document, href: () => window.location.href, hash: () => window.location.hash,
    navigation: () => window.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined,
    position: () => ({ x: window.scrollX, y: window.scrollY }), viewportHeight: () => window.innerHeight,
    events: window, requestFrame: callback => window.requestAnimationFrame(callback), cancelFrame: frame => window.cancelAnimationFrame(frame),
   });
   jobs.set(doc, job);
  }
  job.commit(knownIds);
  // No cleanup-cancel trap: StrictMode setup reuses the same one-frame job.
  // Input/history/visibility/pagehide or the sole frame always consume it.
 }, [knownIds]);
 return null;
}
