import { OAUTH_DISABLED_POLICY, OAuthBoundaryError, type OAuthPolicy, type OAuthScope } from './contracts';
import { oauthIssuer, oauthResource, type NativeOAuthConfig } from './config';

export function createOAuthPolicy(config: NativeOAuthConfig): OAuthPolicy {
  if (!config.enabled) return OAUTH_DISABLED_POLICY;
  return Object.freeze({
    enabled: true, issuer: oauthIssuer, resource: oauthResource,
    clients: config.clients.map(client => Object.freeze({
      clientId: client.client_id, redirectUris: Object.freeze([...client.redirect_uris]),
      scopes: Object.freeze([...client.scopes]), renewable: client.renewable,
    })),
    ttl: OAUTH_DISABLED_POLICY.ttl,
  });
}

// Only library-persisted request parameters may be supplied here, never POST body authority.
export function requestedOAuthConsent(params: Record<string, unknown>, policy: OAuthPolicy) {
  if (!policy.enabled) throw new OAuthBoundaryError(503);
  const client = policy.clients.find(value => value.clientId === params.client_id);
  const resources = Array.isArray(params.resource) ? params.resource : [params.resource];
  const requested = typeof params.scope === 'string' ? params.scope.split(' ').filter(Boolean) : [];
  if (!client || resources.length !== 1 || resources[0] !== policy.resource
    || params.response_type !== 'code' || params.code_challenge_method !== 'S256'
    || typeof params.code_challenge !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(params.code_challenge)
    || typeof params.redirect_uri !== 'string' || !client.redirectUris.includes(params.redirect_uri)
    || requested.length === 0 || new Set(requested).size !== requested.length
    || requested.some(scope => !client.scopes.includes(scope as OAuthScope))) {
    throw new OAuthBoundaryError(400);
  }
  return { client, resource: policy.resource, scopes: requested as OAuthScope[] };
}
