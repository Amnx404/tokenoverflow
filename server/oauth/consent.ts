import type { NextApiRequest, NextApiResponse } from 'next';
import type { Identity } from '@/server/services/auth';
import { OAuthBoundaryError, safeOAuthBoundaryError } from './contracts';
import { requestedOAuthConsent } from './policy';
import type { OAuthRuntime } from './provider';
import { oauthMountPath } from './config';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
function html(res: NextApiResponse, status: number, body: string) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Security-Policy', "default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><title>Native connection consent</title><body>${body}</body></html>`);
}
async function decision(req: NextApiRequest) {
  if (req.headers['content-type']?.split(';')[0] !== 'application/x-www-form-urlencoded') throw new OAuthBoundaryError(400);
  let body = '';
  for await (const chunk of req) {
    body += chunk.toString('utf8');
    if (Buffer.byteLength(body) > 4096) throw new OAuthBoundaryError(413);
  }
  const form = new URLSearchParams(body);
  if ([...form.keys()].some(key => key !== 'decision') || form.getAll('decision').length !== 1
    || !['approve', 'deny'].includes(form.get('decision')!)) throw new OAuthBoundaryError(400);
  return form.get('decision');
}

export async function serveOAuthConsent(
  req: NextApiRequest, res: NextApiResponse, runtime: OAuthRuntime, routeUid: string,
  requireWebIdentity: () => Promise<Identity>,
) {
  let signedInteractionUid: string | undefined;
  try {
    if (!['GET', 'POST'].includes(req.method ?? '')) throw new OAuthBoundaryError(400);
    if (req.method === 'POST' && req.headers.origin !== new URL(runtime.policy.issuer).origin) throw new OAuthBoundaryError(403);
    const action = req.method === 'POST' ? await decision(req) : null;
    // The maintained library verifies its signed interaction cookie and loads the persisted request.
    const details = await runtime.provider.interactionDetails(req, res);
    if (details.uid !== routeUid) throw new OAuthBoundaryError(400);
    signedInteractionUid = details.uid;
    const requested = requestedOAuthConsent(details.params, runtime.policy);
    const identity = await requireWebIdentity();
    if (req.method === 'GET') {
      const scopes = requested.scopes.map(scope => `<li>${escapeHtml(scope)}</li>`).join('');
      return html(res, 200, `<h1>Approve native connection</h1><p>Client: ${escapeHtml(requested.client.clientId)}</p><p>Resource: ${escapeHtml(requested.resource)}</p><ul>${scopes}</ul><p>${requested.client.renewable ? 'Approval permits refresh for this connection for up to 30 days, including after browser signout. Disconnect revokes this connection; a later reconnect requires new consent.' : 'Approval does not permit renewable refresh credentials.'}</p><form method="post"><button name="decision" value="approve">Approve these operations</button><button name="decision" value="deny">Deny</button></form>`);
    }
    if (action === 'deny') {
      return runtime.provider.interactionFinished(req, res, { error: 'access_denied', error_description: 'The user denied native authorization.' }, { mergeWithLastSubmission: false });
    }
    // Only this new local save supplies the Grant ID; no caller-supplied or preexisting grant is accepted.
    const grant = new runtime.provider.Grant({ accountId: identity.user.id, clientId: requested.client.clientId });
    grant.addResourceScope(requested.resource, requested.scopes.join(' '));
    const providerGrantId = await grant.save();
    await runtime.store.approveOAuthGrant({ interactionUid: details.uid, providerGrantId, verifiedWebActor: identity });
    return runtime.provider.interactionFinished(req, res, {
      login: { accountId: identity.user.id }, consent: { grantId: providerGrantId },
    }, { mergeWithLastSubmission: false });
  } catch (error) {
    const safe = safeOAuthBoundaryError(error);
    if (safe.status === 401 && signedInteractionUid) {
      // Normal website login returns to a fresh GET of this signed interaction, never replaying approval.
      const next = `${oauthMountPath}/interaction/${encodeURIComponent(signedInteractionUid)}`;
      res.statusCode = 303; res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Location', `/login?next=${encodeURIComponent(next)}`); res.end(); return;
    }
    return html(res, safe.status, '<h1>Native authorization unavailable</h1><p>Complete ordinary website sign-in before approving, or start a fresh authorization request.</p>');
  }
}

async function disconnectClient(req: NextApiRequest) {
  if (req.headers['content-type']?.split(';')[0] !== 'application/x-www-form-urlencoded') throw new OAuthBoundaryError(400);
  let body = '';
  for await (const chunk of req) { body += chunk.toString('utf8'); if (Buffer.byteLength(body) > 4096) throw new OAuthBoundaryError(413); }
  const form = new URLSearchParams(body);
  if ([...form.keys()].some(key => !['action', 'clientId'].includes(key)) || form.getAll('action').length !== 1
    || form.get('action') !== 'disconnect' || form.getAll('clientId').length !== 1 || !form.get('clientId')) throw new OAuthBoundaryError(400);
  return form.get('clientId')!;
}

export async function serveOAuthConnections(
  req: NextApiRequest, res: NextApiResponse, runtime: OAuthRuntime, requireWebIdentity: () => Promise<Identity>,
) {
  try {
    if (!['GET', 'POST'].includes(req.method ?? '')) throw new OAuthBoundaryError(400);
    if (req.method === 'POST' && req.headers.origin !== new URL(runtime.policy.issuer).origin) throw new OAuthBoundaryError(403);
    const clientId = req.method === 'POST' ? await disconnectClient(req) : undefined;
    if (clientId && !runtime.policy.clients.some(client => client.clientId === clientId)) throw new OAuthBoundaryError(400);
    const identity = await requireWebIdentity(); // Exactly one fresh ordinary web identity per request.
    let receiptText = '';
    if (clientId) {
      const receipt = await runtime.store.disconnectOAuthClient({ verifiedWebActor: identity, clientId });
      receiptText = `<p>${escapeHtml(receipt.clientId)}: ${receipt.disconnected ? 'Permission revoked for this client.' : 'No active permission was changed for this client.'}</p>`;
    }
    const forms = runtime.policy.clients.map(client => `<form method="post"><p>Configured client: ${escapeHtml(client.clientId)}</p><input type="hidden" name="action" value="disconnect"><input type="hidden" name="clientId" value="${escapeHtml(client.clientId)}"><button>Disconnect this client</button></form>`).join('');
    return html(res, 200, `<h1>Native client permissions</h1><p>These are configured client options, not a list or count of active connections. A client's local forget action does not prove server revocation. Reconnecting requires fresh approval.</p>${receiptText}${forms}`);
  } catch (error) {
    const safe = safeOAuthBoundaryError(error);
    if (safe.status === 401) {
      const next = `${oauthMountPath}/connections`;
      res.statusCode = 303; res.setHeader('Cache-Control', 'no-store'); res.setHeader('Location', `/login?next=${encodeURIComponent(next)}`); res.end(); return;
    }
    return html(res, safe.status, '<h1>Native client permissions unavailable</h1>');
  }
}
