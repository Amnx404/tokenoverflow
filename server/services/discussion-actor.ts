import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { requireIdentity,type Identity } from './auth';
import { DiscussionError } from './discussion-errors';
const brand=Symbol('verified nondelegated web discussion actor');
const issued=new WeakSet<object>();
export type VerifiedWebDiscussionActor={readonly identity:Identity;readonly [brand]:true};
export async function requireWebDiscussionActor(client:SupabaseClient):Promise<VerifiedWebDiscussionActor>{
 try{
  const identity=await requireIdentity(client);
  const verified=await client.auth.getClaims();
  if(verified.error||!verified.data?.claims)throw new DiscussionError(401);
  const claims=verified.data.claims;
  const issuer=new URL('/auth/v1',process.env.NEXT_PUBLIC_SUPABASE_URL).toString();
  const audience=claims.aud==='authenticated'||Array.isArray(claims.aud)&&claims.aud.includes('authenticated');
  if(claims.sub!==identity.user.id||claims.iss!==issuer||claims.role!=='authenticated'||!audience||!Number.isInteger(claims.exp)||claims.exp<=Date.now()/1000||!z.uuid().safeParse(claims.session_id).success||identity.user.is_anonymous!==false||claims.is_anonymous!==false||Object.hasOwn(claims,'client_id'))throw new DiscussionError(403);
  const actor:VerifiedWebDiscussionActor=Object.freeze({identity,[brand]:true});issued.add(actor);return actor;
 }catch(error){if(error instanceof DiscussionError)throw error;throw new DiscussionError(401);}
}
export function assertWebDiscussionActor(actor:VerifiedWebDiscussionActor):void{if(!actor||actor[brand]!==true||!issued.has(actor))throw new DiscussionError(403);}
