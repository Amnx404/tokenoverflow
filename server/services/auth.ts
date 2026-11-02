import 'server-only';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { z } from 'zod';

const verified = Symbol('verified Supabase identity');
export type Identity = { readonly user: User; readonly client: SupabaseClient; readonly [verified]: true };
export class AuthenticationError extends Error {
  constructor() { super('Sign in before contributing.'); this.name='AuthenticationError'; }
}
export async function requireIdentity(client: SupabaseClient): Promise<Identity> {
  const {data:{user},error}=await client.auth.getUser();
  if(error || !user) throw new AuthenticationError();
  return {user,client,[verified]:true};
}
export function assertIdentity(identity: Identity) {
  if(identity?.[verified]!==true) throw new AuthenticationError();
}

// Native OAuth consent/connections only: separate fresh strict producer, ordinary identity unchanged.
export async function requireNativeOAuthWebIdentity(client: SupabaseClient): Promise<Identity> {
  try {
    const {data:{user},error}=await client.auth.getUser();
    if(error || !user || user.is_anonymous!==false) throw new AuthenticationError();
    const checked=await client.auth.getClaims();const claims=checked.data?.claims;
    const issuer=new URL('/auth/v1',process.env.NEXT_PUBLIC_SUPABASE_URL).toString();
    if(checked.error || !claims || claims.sub!==user.id || claims.iss!==issuer || !(claims.aud==='authenticated'||Array.isArray(claims.aud)&&claims.aud.length===1&&claims.aud[0]==='authenticated') || claims.role!=='authenticated' || !Number.isInteger(claims.exp) || claims.exp<=Date.now()/1000 || !z.uuid().safeParse(claims.session_id).success || claims.is_anonymous!==false || ['client_id','native_capability','mcp_capability'].some(key=>Object.hasOwn(claims,key))) throw new AuthenticationError();
    return {user,client,[verified]:true};
  } catch { throw new AuthenticationError(); }
}
