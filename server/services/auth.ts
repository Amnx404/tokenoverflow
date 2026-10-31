import 'server-only';
import type { SupabaseClient, User } from '@supabase/supabase-js';

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
