import { bearerAuthChallengeResponse, OAuthError, readRequestBody } from '@modelcontextprotocol/server';
import { OAUTH_OPERATION_SCOPES, safeOAuthBoundaryError, type OAuthOperation } from './contracts';
import { oauthResourceMetadataUrl } from './config';

export type PreparedMcpOAuth = { parsedBody?: unknown };
function jsonRpcFailure(status: number, code: number, message: string) {
  return Response.json({ jsonrpc: '2.0', error: { code, message }, id: null }, { status });
}
function protectedOperations(value: unknown): OAuthOperation[] {
  const calls = Array.isArray(value) ? value : [value];
  const operations = new Set<OAuthOperation>();
  for (const call of calls) {
    if (!call || typeof call !== 'object') continue;
    const candidate = call as { method?: unknown; params?: { name?: unknown } };
    if (candidate.method !== 'tools/call') continue;
    const name = candidate.params?.name;
    if (typeof name === 'string' && Object.hasOwn(OAUTH_OPERATION_SCOPES, name)) operations.add(name as OAuthOperation);
  }
  return [...operations];
}

// Authorization is supplied by the actual sealed-actor service, never by request metadata.
// A whole batch is preflighted before any callback executes. The original Request is preserved.
export async function prepareMcpOAuthRequest(
  request: Request,
  enabled: boolean,
  authorize: (opaqueAccessToken: string, operation: OAuthOperation) => Promise<unknown>,
): Promise<PreparedMcpOAuth | Response> {
  if (!enabled || request.method !== 'POST') return {};
  const body = await readRequestBody(request.clone(), 65536);
  if (body.tooLarge) return jsonRpcFailure(413, -32000, 'Request body too large.');
  let parsedBody: unknown;
  try { parsedBody = JSON.parse(body.text); } catch { return jsonRpcFailure(400, -32700, 'Parse error'); }
  const operations = protectedOperations(parsedBody);
  if (!operations.length) return { parsedBody };
  const authorization = request.headers.get('authorization');
  // This remains the existing legacy-key path; no native actor is inferred from a to_ key.
  if (/^Bearer to_[a-f0-9]{64}$/.test(authorization ?? '')) return { parsedBody };
  const match = /^Bearer ([^\s]+)$/i.exec(authorization ?? '');
  try {
    if (!match) throw new OAuthError('invalid_token', 'Native authorization required.');
    for (const operation of operations) await authorize(match[1], operation);
    // Discard actors: each callback obtains a fresh sealed actor and the writer rechecks under lock.
    return { parsedBody };
  } catch (error) {
    const status = error instanceof OAuthError ? (error.code === 'insufficient_scope' ? 403 : 401) : safeOAuthBoundaryError(error).status;
    if (![401, 403].includes(status)) return Response.json({ error: 'Native authorization is unavailable.' }, { status: 503 });
    return bearerAuthChallengeResponse(new OAuthError(
      status === 403 ? 'insufficient_scope' : 'invalid_token',
      status === 403 ? 'Required operation scope is missing.' : 'Native authorization required.',
    ), { resourceMetadataUrl: oauthResourceMetadataUrl, requiredScopes: operations.map(operation => OAUTH_OPERATION_SCOPES[operation]) });
  }
}
