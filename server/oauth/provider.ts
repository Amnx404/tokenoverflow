import type Provider from 'oidc-provider';
import type { Configuration } from 'oidc-provider';
import { OAUTH_OPERATION_SCOPES, OAuthBoundaryError, type OAuthPolicy, type OAuthStore } from './contracts';
import { getNativeOAuthConfig, oauthIssuer, oauthMountPath, type NativeOAuthConfig } from './config';
import { createOAuthPolicy } from './policy';
import type { createOAuthActorService, requireNodeWebOAuthIdentity } from './actor';

export type OAuthRuntime = { provider: Provider; store: OAuthStore; policy: OAuthPolicy; actorService: ReturnType<typeof createOAuthActorService>; requireWebIdentity: typeof requireNodeWebOAuthIdentity }; 

// Configuration construction is pure; production acquisition is wired only to the actual backend.
export function createProviderConfiguration(
  config: Extract<NativeOAuthConfig, { enabled: true }>,
  store: OAuthStore,
  adapter: NonNullable<Configuration['adapter']>,
  errors: typeof import('oidc-provider').errors,
): Configuration {
  const policy = store.policy;
  if (!policy.enabled || !policy.clients.length) throw new OAuthBoundaryError(503);
  return {
    adapter,
    clients: config.clients.map(client => ({
      client_id: client.client_id, client_name: client.client_name,
      redirect_uris: [...client.redirect_uris], application_type: 'native',
      response_types: ['code'], grant_types: client.renewable ? ['authorization_code', 'refresh_token'] : ['authorization_code'],
      token_endpoint_auth_method: 'none', scope: client.scopes.join(' '),
    })),
    jwks: config.jwks,
    cookies: { keys: config.cookieKeys, names: { session: '_to_oauth_session', interaction: '_to_oauth_interaction', resume: '_to_oauth_resume' },
      long: { httpOnly: true, secure: true, sameSite: 'lax', signed: true },
      short: { httpOnly: true, secure: true, sameSite: 'lax', signed: true } },
    scopes: Object.values(OAUTH_OPERATION_SCOPES),
    // Keep supported baseline OpenID metadata; each native client remains operation-scope-only.
    claims: { openid: { sub: null } },
    responseTypes: ['code'], clientAuthMethods: ['none'],
    pkce: { required: () => true },
    clientBasedCORS(_ctx, origin, client) {
      return policy.clients.some(value => value.clientId === client.clientId && value.redirectUris.some(uri => new URL(uri).origin === origin));
    },
    formats: { bitsOfOpaqueRandomness: 256 },
    features: {
      devInteractions: { enabled: false }, claimsParameter: { enabled: false }, userinfo: { enabled: false },
      registration: { enabled: false }, registrationManagement: { enabled: false },
      clientIdMetadataDocument: { enabled: false }, deviceFlow: { enabled: false },
      pushedAuthorizationRequests: { enabled: false }, dPoP: { enabled: false },
      attestClientAuth: { enabled: false },
      ciba: { enabled: false }, clientCredentials: { enabled: false }, openid4vci: { enabled: false },
      requestObjects: { enabled: false }, richAuthorizationRequests: { enabled: false },
      jwtResponseModes: { enabled: false }, webMessageResponseMode: { enabled: false },
      introspection: { enabled: false }, rpInitiatedLogout: { enabled: false },
      revocation: { enabled: true },
      resourceIndicators: {
        enabled: true,
        defaultResource(_ctx, _client, oneOf) {
          if (oneOf?.length === 1 && oneOf[0] === policy.resource) return policy.resource;
          throw new errors.InvalidTarget('An exact approved resource is required.');
        },
        useGrantedResource: () => true,
        getResourceServerInfo(_ctx, resource, client) {
          const trusted = policy.clients.find(value => value.clientId === client.clientId);
          if (resource !== policy.resource || !trusted) throw new errors.InvalidTarget('Resource is unavailable.');
          return { scope: trusted.scopes.join(' '), audience: policy.resource, accessTokenTTL: policy.ttl.accessTokenSeconds, accessTokenFormat: 'opaque' };
        },
      },
    },
    expiresWithSession: () => false,
    rotateRefreshToken: () => true,
    revokeGrantPolicy: () => true,
    ttl: {
      AuthorizationCode: policy.ttl.authorizationCodeSeconds,
      AccessToken: policy.ttl.accessTokenSeconds,
      Interaction: policy.ttl.interactionSeconds,
      Grant: policy.ttl.refreshFamilySeconds,
      RefreshToken(_ctx, token) {
        const remaining = policy.ttl.refreshFamilySeconds - token.totalLifetime();
        if (remaining <= 0) throw new errors.InvalidGrant('Refresh family has expired.');
        return Math.min(policy.ttl.refreshIdleSeconds, remaining);
      },
    },
    interactions: { url: (_ctx, interaction) => `${oauthMountPath}/interaction/${encodeURIComponent(interaction.uid)}` },
    async findAccount(_ctx, accountId) {
      // Account/grant freshness is enforced by the active-binding store and sealed writer.
      return { accountId, async claims() { return { sub: accountId }; } };
    },
    async loadExistingGrant(ctx) {
      const grantId = ctx.oidc.result?.consent?.grantId;
      if (!grantId) return undefined; // Never session/latest-grant fallback.
      const binding = await store.findActiveGrant(grantId);
      const interaction = ctx.oidc.entities.Interaction;
      const accountId = ctx.oidc.session?.accountId;
      const clientId = ctx.oidc.client?.clientId;
      if (typeof accountId !== 'string' || typeof clientId !== 'string' || !binding || binding.interactionUid !== interaction?.uid || binding.accountId !== accountId
        || binding.clientId !== clientId || binding.resource !== policy.resource) {
        throw new errors.InvalidGrant('The approved grant is unavailable.');
      }
      // Resume destroys persisted Interaction; compare its retained supported entity, not a new lookup.
      const grant = await ctx.oidc.provider.Grant.find(grantId);
      if (!grant) throw new errors.InvalidGrant('The approved grant is unavailable.');
      return grant;
    },
    async issueRefreshToken(_ctx, client, source) {
      if (source.kind !== 'AuthorizationCode' || !source.grantId) return false;
      const binding = await store.findActiveGrant(source.grantId);
      const trusted = policy.clients.find(value => value.clientId === client.clientId);
      return Boolean(binding && binding.renewable && trusted?.renewable
        && binding.clientId === client.clientId && binding.accountId === source.accountId
        && binding.resource === policy.resource
        && [...source.scopes].every(scope => binding.scopes.includes(scope as typeof binding.scopes[number])));
    },
  };
}

// OFF never acquires a provider, store, database client, Node SSR client or runtime library.
let acquired: Promise<OAuthRuntime> | undefined;
export async function getNativeOAuthRuntime(): Promise<OAuthRuntime | undefined> {
  const config = getNativeOAuthConfig();
  if (!config.enabled) return undefined;
  if (!process.release.lts || Number(process.versions.node.split('.')[0]) < 22) throw new OAuthBoundaryError(503);
  acquired ??= (async () => {
    try {
      const [{ default: MaintainedProvider, errors }, { createOAuthAdapterFactory }, { createOAuthStore, createPostgresOAuthDriver }, { createOAuthActorService, requireNodeWebOAuthIdentity }] = await Promise.all([
        import('oidc-provider'), import('./adapter'), import('./store'), import('./actor'),
      ]);
      const policy = createOAuthPolicy(config);
      const runTransaction = createPostgresOAuthDriver({ databaseUrl: config.databaseUrl, expectedLogin: config.databaseLogin });
      const store = createOAuthStore({ runTransaction, policy });
      const adapter = createOAuthAdapterFactory({ store, invalidGrant: () => new errors.InvalidGrant('Credential is unavailable.') });
      const provider = new MaintainedProvider(oauthIssuer, createProviderConfiguration(config, store, adapter, errors));
      provider.proxy = true; // Only the fixed-host/protocol Node mount exposes this callback.
      provider.silent = true; // Koa's supported silent flag suppresses raw request/protocol error logging.
      const actorService = createOAuthActorService({ store, findAccessToken: async opaqueAccessToken => {
        const token = await provider.AccessToken.find(opaqueAccessToken);
        if (!token) return undefined;
        // Deliberate model view: no raw jti/bearer or broad model spread crosses this boundary.
        return { grantId: token.grantId, clientId: token.clientId, accountId: token.accountId,
          aud: token.aud, scope: token.scope, exp: token.exp,
          sessionUid: token.sessionUid, expiresWithSession: token.expiresWithSession };
      } });
      return { provider, store, policy, actorService, requireWebIdentity: requireNodeWebOAuthIdentity };
    } catch { throw new OAuthBoundaryError(503); }
  })();
  return acquired;
}
