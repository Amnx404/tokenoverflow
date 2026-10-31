import 'server-only';
import { safeNext } from './validation';

// Auth callbacks use a canonical configured origin, never a caller-controlled Host.
export function authSiteOrigin(): string {
  const value = process.env.AUTH_SITE_URL?.trim() || (process.env.NODE_ENV === 'production'
    ? 'https://tokenoverflow.app' : 'http://localhost:3000');
  const url = new URL(value);
  const productionOrigin = url.origin === 'https://tokenoverflow.app';
  const localOrigin = process.env.NODE_ENV !== 'production'
    && ['http://localhost:3000', 'http://127.0.0.1:3000'].includes(url.origin);
  if ((!productionOrigin && !localOrigin) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('AUTH_SITE_URL must be the approved application origin.');
  }
  return url.origin;
}

export function authCallbackUrl(next: string | null): string {
  const callback = new URL('/auth/callback', authSiteOrigin());
  callback.searchParams.set('next', safeNext(next));
  return callback.toString();
}

// Read the public provider state rather than presenting an unconfigured provider.
export async function githubAuthEnabled(): Promise<boolean> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '' },
      cache: 'no-store', signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return false;
    const settings = await response.json();
    return settings.external?.github === true;
  } catch {
    return false;
  }
}
