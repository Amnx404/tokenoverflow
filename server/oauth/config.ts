import { z } from 'zod';
import type { Configuration } from 'oidc-provider';
import { OAUTH_OPERATION_SCOPES, OAUTH_RESOURCE } from './contracts';

export const oauthIssuer = 'https://tokenoverflow.app/api/mcp-authorization';
export const oauthResource = OAUTH_RESOURCE;
export const oauthMountPath = '/api/mcp-authorization';
export const oauthResourceMetadataUrl = 'https://tokenoverflow.app/.well-known/oauth-protected-resource/api/mcp';

const redirect = z.string().refine(value => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname)
      && url.port !== '' && url.pathname === '/callback' && !url.search && !url.hash && !url.username && !url.password;
  } catch { return false; }
}, 'Use an explicitly configured loopback callback profile.');
const scopes = Object.values(OAUTH_OPERATION_SCOPES);
export const nativeOAuthClientSchema = z.strictObject({
  client_id: z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,127}$/).refine(value => !['__proto__', 'constructor', 'prototype'].includes(value.toLowerCase())),
  client_name: z.string().min(1).max(80),
  redirect_uris: z.array(redirect).min(1).max(4),
  scopes: z.array(z.enum(scopes)).min(1).max(3).refine(values => new Set(values).size === values.length),
  renewable: z.boolean(),
});
export type OAuthClient = z.infer<typeof nativeOAuthClientSchema>;
export type NativeOAuthConfig = { enabled: false; clients: [] } | {
  enabled: true;
  clients: OAuthClient[];
  cookieKeys: string[];
  jwks: NonNullable<Configuration['jwks']>;
  databaseUrl: string;
  databaseLogin: string;
};
export const disabledOAuthConfig: NativeOAuthConfig = { enabled: false, clients: [] };

// Configuration is lazy and OFF by default. No key generation or environment access at import.
export function nativeOAuthConfigFromEnvironment(environment: Record<string, string | undefined>): NativeOAuthConfig {
  if (environment.NATIVE_OAUTH_ENABLED !== '1') return disabledOAuthConfig;
  try {
    const clients = z.array(nativeOAuthClientSchema).min(1).max(10).parse(JSON.parse(environment.NATIVE_OAUTH_CLIENTS_JSON ?? 'null'));
    if (new Set(clients.map(client => client.client_id)).size !== clients.length) throw new Error();
    const cookieKeys = z.array(z.string().min(32)).min(1).max(3).parse(JSON.parse(environment.NATIVE_OAUTH_COOKIE_KEYS_JSON ?? 'null'));
    const jwks = z.object({ keys: z.array(z.record(z.string(), z.unknown())).min(1).max(3) }).parse(JSON.parse(environment.NATIVE_OAUTH_JWKS_JSON ?? 'null'));
    if (jwks.keys.some(key => !['RSA', 'EC', 'OKP'].includes(String(key.kty)) || typeof key.d !== 'string' || !key.d)) throw new Error();
    const databaseUrl = z.string().min(1).parse(environment.NATIVE_OAUTH_DATABASE_URL);
    const databaseLogin = z.string().regex(/^[a-z_][a-z0-9_]{0,62}$/).parse(environment.NATIVE_OAUTH_DATABASE_LOGIN);
    return { enabled: true, clients, cookieKeys, jwks, databaseUrl, databaseLogin };
  } catch {
    // Never expose rejected owner configuration, key bytes or parser input.
    throw new Error('Native OAuth owner configuration is unavailable.');
  }
}

export function getNativeOAuthConfig(): NativeOAuthConfig {
  return nativeOAuthConfigFromEnvironment(process.env);
}

// The resource server uses only this cheap switch until a protected native operation is found.
export function isNativeOAuthRequested() { return process.env.NATIVE_OAUTH_ENABLED === '1'; }
