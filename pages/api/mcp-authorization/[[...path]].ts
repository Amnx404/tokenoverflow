import type { NextApiRequest, NextApiResponse } from 'next';
import { getNativeOAuthConfig, oauthIssuer, oauthMountPath } from '@/server/oauth/config';
import { getNativeOAuthRuntime } from '@/server/oauth/provider';
import { serveOAuthConsent, serveOAuthConnections } from '@/server/oauth/consent';

export const config = { api: { bodyParser: false, externalResolver: true } };

export default async function nativeOAuthNodeRoute(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  let enabled = false;
  try { enabled = getNativeOAuthConfig().enabled; } catch { res.statusCode = 503; res.end(); return; }
  if (!enabled) { res.statusCode = 404; res.end(); return; }
  const origin = new URL(oauthIssuer).origin;
  if (req.headers.host !== new URL(origin).host || (req.headers['x-forwarded-host'] && req.headers['x-forwarded-host'] !== new URL(origin).host)
    || (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-proto'] !== 'https')) {
    res.statusCode = 400; res.end(); return;
  }
  const length = req.headers['content-length'];
  if (length !== undefined && (!/^\d+$/.test(length) || Number(length) > 56 * 1024)) { res.statusCode = 413; res.end(); return; }
  const originalUrl = req.url;
  const rootDiscoveryAlias = '/.well-known/oauth-authorization-server/api/mcp-authorization';
  const discoveryDestination = `${oauthMountPath}/.well-known/oauth-authorization-server`;
  const requestUrl = originalUrl === rootDiscoveryAlias ? discoveryDestination : originalUrl;
  if (originalUrl?.startsWith('/.well-known/') && originalUrl !== rootDiscoveryAlias) { res.statusCode = 404; res.end(); return; }
  if (requestUrl?.split('?')[0] === discoveryDestination && (req.method !== 'GET' || requestUrl.includes('?'))) { res.statusCode = 404; res.end(); return; }
  if (!requestUrl || !(requestUrl === oauthMountPath || requestUrl.startsWith(`${oauthMountPath}/`) || requestUrl.startsWith(`${oauthMountPath}?`))) {
    res.statusCode = 404; res.end(); return;
  }
  try {
    const runtime = await getNativeOAuthRuntime();
    if (!runtime) { res.statusCode = 503; res.end(); return; }
    const url = new URL(requestUrl, origin);
    if (url.pathname === `${oauthMountPath}/connections` && !url.search) {
      return await serveOAuthConnections(req, res, runtime, () => runtime.requireWebIdentity(req, res));
    }
    const interaction = /^\/interaction\/([^/]+)$/.exec(url.pathname.slice(oauthMountPath.length));
    if (interaction) {
      return await serveOAuthConsent(req, res, runtime, decodeURIComponent(interaction[1]), () => runtime.requireWebIdentity(req, res));
    }
    // Keep the original Node IncomingMessage/ServerResponse; the library router is mount-relative.
    req.url = requestUrl.slice(oauthMountPath.length) || '/';
    const originalUrlRequest = req as NextApiRequest & { originalUrl?: string };
    const priorOriginalUrl = originalUrlRequest.originalUrl;
    originalUrlRequest.originalUrl = requestUrl;
    try {
      // The maintained library's selective_body reader independently enforces its fixed 56 KiB streaming limit.
      await runtime.provider.callback()(req, res);
    } finally { originalUrlRequest.originalUrl = priorOriginalUrl; }
  } catch {
    if (!res.writableEnded) { res.statusCode = 503; res.end(); }
  } finally { req.url = originalUrl; }
}
