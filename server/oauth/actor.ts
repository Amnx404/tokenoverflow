import 'server-only';
import type { IncomingMessage,ServerResponse } from 'node:http';
import { createServerClient,parseCookieHeader,serializeCookieHeader } from '@supabase/ssr';
import { AuthenticationError,requireNativeOAuthWebIdentity,type Identity } from '@/server/services/auth';
import { reportSchema,fixSchema,verificationSchema } from '@/lib/validation';
import { oauthKeyHash } from './adapter';
import { OAUTH_OPERATION_SCOPES,OAUTH_RESOURCE,OAuthBoundaryError,type OAuthAccessContext,type OAuthContributionKind,type OAuthOperation,type OAuthStore,type OAuthTokenFinder } from './contracts';
const actorBrand=Symbol('sealed native MCP actor');
export type McpOAuthActor={readonly [actorBrand]:true};
export async function requireNodeWebOAuthIdentity(req:IncomingMessage,res:ServerResponse):Promise<Identity>{
 try {
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)throw new OAuthBoundaryError(503);
 const jar=new Map(parseCookieHeader(req.headers.cookie??'').map(cookie=>[cookie.name,cookie.value]));
 const client=createServerClient(url,key,{cookies:{
  getAll:()=>[...jar].map(([name,value])=>({name,value})),
  setAll:values=>{
   const serialized:string[]=[];
   for(const {name,value,options}of values){jar.set(name,value);serialized.push(serializeCookieHeader(name,value,options));}
   const previous=res.getHeader('Set-Cookie');
   const existing=previous===undefined?[]:Array.isArray(previous)?previous.map(String):[String(previous)];
   res.setHeader('Set-Cookie',[...existing,...serialized]);
  }
 }});
 return await requireNativeOAuthWebIdentity(client);
 }catch(error){if(error instanceof OAuthBoundaryError)throw error;if(error instanceof AuthenticationError)throw new OAuthBoundaryError(401);throw new OAuthBoundaryError(503);}
}
export function createOAuthActorService({store,findAccessToken}:{store:OAuthStore;findAccessToken:OAuthTokenFinder}){
 const contexts=new WeakMap<McpOAuthActor,OAuthAccessContext>();
 async function requireMcpOAuthActor({opaqueAccessToken,requiredOperation}:{opaqueAccessToken:string;requiredOperation:OAuthOperation}):Promise<McpOAuthActor>{
  if(!store.policy.enabled)throw new OAuthBoundaryError(503);
  if(!Object.hasOwn(OAUTH_OPERATION_SCOPES,requiredOperation))throw new OAuthBoundaryError(403);
  if(typeof opaqueAccessToken!=='string'||!opaqueAccessToken||opaqueAccessToken.length>2048)throw new OAuthBoundaryError(401);
  let token;try{token=await findAccessToken(opaqueAccessToken);}catch{throw new OAuthBoundaryError(503);}
  if(!token||typeof token.grantId!=='string'||typeof token.clientId!=='string'||typeof token.accountId!=='string'||token.aud!==OAUTH_RESOURCE||typeof token.scope!=='string'||typeof token.exp!=='number'||!Number.isInteger(token.exp)||token.exp<=Date.now()/1000)throw new OAuthBoundaryError(401);
  const scope=token.scope.split(' ').filter(Boolean);
  if(!scope.includes(OAUTH_OPERATION_SCOPES[requiredOperation])||scope.some(s=>!(Object.values(OAUTH_OPERATION_SCOPES) as string[]).includes(s))||token.sessionUid!==undefined&&typeof token.sessionUid!=='string'||token.expiresWithSession!==undefined&&typeof token.expiresWithSession!=='boolean')throw new OAuthBoundaryError(403);
  const context:OAuthAccessContext=Object.freeze({credentialHash:oauthKeyHash('AccessToken',opaqueAccessToken),grantId:token.grantId,clientId:token.clientId,accountId:token.accountId,resource:OAUTH_RESOURCE,scope:Object.freeze(scope),exp:token.exp,...(token.sessionUid===undefined?{}:{sessionUid:token.sessionUid as string}),...(token.expiresWithSession===undefined?{}:{expiresWithSession:token.expiresWithSession as boolean})});
  await store.checkAccess(context,requiredOperation);
  const actor:McpOAuthActor=Object.freeze({[actorBrand]:true});contexts.set(actor,context);return actor;
 }
 async function publishMcpOAuthContribution(actor:McpOAuthActor,kind:OAuthContributionKind,input:unknown){
  const context=contexts.get(actor);if(!context||actor[actorBrand]!==true)throw new OAuthBoundaryError(403);
  if(!['report','fix','verification'].includes(kind))throw new OAuthBoundaryError(400);
  const schema=kind==='report'?reportSchema:kind==='fix'?fixSchema:verificationSchema;
  const value=schema.safeParse({...input&&typeof input==='object'?input:{},author_name:'Contributor'});
  if(!value.success)throw new OAuthBoundaryError(400);
  if(value.data.evidence_bundle!==undefined&&Buffer.byteLength(JSON.stringify(value.data.evidence_bundle),'utf8')>12_288)throw new OAuthBoundaryError(413);
  // No Identity conversion/legacy writer. Actual SQL transaction revalidates grant, credential, account, scope and quota.
  return store.publish(context,kind,value.data);
 }
 return {requireMcpOAuthActor,publishMcpOAuthContribution};
}
