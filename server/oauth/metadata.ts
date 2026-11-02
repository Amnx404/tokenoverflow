import { OAUTH_OPERATION_SCOPES } from './contracts';
import { getNativeOAuthConfig, oauthIssuer, oauthResource, oauthResourceMetadataUrl } from './config';

export function protectedResourceMetadataResponse() {
  try { if (!getNativeOAuthConfig().enabled) return new Response(null, { status: 404 }); }
  catch { return Response.json({ error: 'Native authorization is unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
  return Response.json({ resource: oauthResource, authorization_servers: [oauthIssuer], bearer_methods_supported: ['header'], scopes_supported: Object.values(OAUTH_OPERATION_SCOPES) }, {
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

export { oauthResourceMetadataUrl };
