import 'server-only';
import { createHash } from 'node:crypto';
import { OAUTH_MODELS, OAUTH_RESOURCE, OAuthBoundaryError,type OAuthModel,type OAuthPayload,type OAuthStore } from './contracts';
const base=['iat','exp','jti','kind'];
const token=[...base,'clientId'];
// Published oidc-provider9.13.3 BaseModel/BaseToken + exact model IN_PAYLOAD; no Provider import.
const allowed:Record<Exclude<OAuthModel,'Client'>,readonly string[]>={
 Session:[...base,'uid','acr','amr','accountId','loginTs','transient','state','authorizations'],
 Interaction:[...base,'session','params','prompt','result','returnTo','trusted','grantId','lastSubmission','deviceCode','cid','parJti'],
 Grant:[...token,'accountId','resources','openid','rejected','rar'],
 AuthorizationCode:[...token,'consumed','sessionUid','expiresWithSession','grantId','attestationJkt','accountId','acr','amr','authTime','claims','nonce','resource','scope','sid','codeChallenge','codeChallengeMethod','redirectUri','dpopJkt','rar'],
 AccessToken:[...token,'gty','grantId','x5t#S256','jkt','sessionUid','expiresWithSession','accountId','aud','rar','claims','extra','scope','sid'],
 RefreshToken:[...token,'consumed','gty','grantId','x5t#S256','jkt','attestationJkt','sessionUid','expiresWithSession','accountId','acr','amr','authTime','claims','nonce','resource','scope','sid','rar','rotations','iiat'],
};
export const nativeCredentialModel=(model:string)=>['AuthorizationCode','AccessToken','RefreshToken'].includes(model);
export function oauthKeyHash(model:string,id:string):string{
 if(typeof id!=='string'||!id||id.length>2048)throw new OAuthBoundaryError(400);
 return createHash('sha256').update(model+'\0'+id,'utf8').digest('hex');
}
function plain(value:unknown):value is OAuthPayload{return !!value&&typeof value==='object'&&!Array.isArray(value);}
function prohibitPrivateMaterial(value:unknown,depth=0):void{
 if(depth>16)throw new OAuthBoundaryError(400);
 if(Array.isArray(value)){for(const item of value)prohibitPrivateMaterial(item,depth+1);return;}
 if(plain(value))for(const [key,item]of Object.entries(value)){
  if(['__proto__','constructor','prototype','body','password','access_token','refresh_token','id_token','supabase_token','authorization'].includes(key.toLowerCase()))throw new OAuthBoundaryError(400);
  prohibitPrivateMaterial(item,depth+1);
 }
}
function validated(model:Exclude<OAuthModel,'Client'>,id:string,input:OAuthPayload,ttl:number):OAuthPayload{
 if(!plain(input)||Object.keys(input).some(key=>!allowed[model].includes(key))||input.jti!==id||input.kind!==model||!Number.isInteger(ttl)||ttl<=0||!Number.isInteger(input.exp)||!Number.isInteger(input.iat))throw new OAuthBoundaryError(400);
 prohibitPrivateMaterial(input);
 const payload=structuredClone(input);
 if(nativeCredentialModel(model)){
  if(typeof payload.grantId!=='string'||!payload.grantId||typeof payload.clientId!=='string'||typeof payload.accountId!=='string')throw new OAuthBoundaryError(400);
  if(Object.hasOwn(payload,'consumed'))throw new OAuthBoundaryError(400);
  delete payload.jti; // No native code/access/refresh raw identifier in persisted JSON or index.
 }
 if(model==='Interaction'){
  if(!plain(payload.params))throw new OAuthBoundaryError(400);
  const keys=['client_id','redirect_uri','response_type','response_mode','scope','resource','code_challenge','code_challenge_method','state','prompt','max_age','nonce'];
  if(Object.keys(payload.params).some(key=>!keys.includes(key)))throw new OAuthBoundaryError(400);
  if(payload.session!==undefined&&(!plain(payload.session)||Object.keys(payload.session).some(key=>!['accountId','uid','cookie','acr','amr'].includes(key))))throw new OAuthBoundaryError(400);
 }
 if(model==='Grant'&&payload.resources!==undefined&&(!plain(payload.resources)||Object.keys(payload.resources).some(key=>key!==OAUTH_RESOURCE)))throw new OAuthBoundaryError(400);
 if(new TextEncoder().encode(JSON.stringify(payload)).byteLength>65_536)throw new OAuthBoundaryError(413);
 return payload;
}
export function createOAuthAdapterFactory({store,invalidGrant}:{store:OAuthStore;invalidGrant:()=>Error}){
 return class OAuthAdapter {
  readonly model:OAuthModel;
  constructor(model:string){if(!(OAUTH_MODELS as readonly string[]).includes(model))throw new OAuthBoundaryError(503);this.model=model as OAuthModel;}
  async upsert(id:string,payload:OAuthPayload,expiresIn:number):Promise<void>{
   if(this.model==='Client')throw new OAuthBoundaryError(403);
   await store.upsert(this.model,oauthKeyHash(this.model,id),validated(this.model,id,payload,expiresIn),expiresIn);
  }
  async find(id:string):Promise<OAuthPayload|undefined>{
   if(this.model==='Client')return undefined; // Static clients are library-owned; never adapter fallback/DCR.
   const stored=await store.find(this.model,oauthKeyHash(this.model,id));if(!stored)return undefined;
   return {...structuredClone(stored.payload),...(nativeCredentialModel(this.model)?{jti:id}:{}),...(stored.consumed===undefined?{}:{consumed:stored.consumed})};
  }
  async findByUid(uid:string):Promise<OAuthPayload|undefined>{
   if(this.model!=='Session')throw new OAuthBoundaryError(400);
   const row=await store.findByIndex(this.model,'uid',uid);return row?structuredClone(row.payload):undefined;
  }
  async findByUserCode(code:string):Promise<undefined>{void code;throw new OAuthBoundaryError(403);}
  async consume(id:string):Promise<void>{
   if(this.model!=='AuthorizationCode'&&this.model!=='RefreshToken')throw new OAuthBoundaryError(400);
   const outcome=await store.consume(this.model,oauthKeyHash(this.model,id));
   // store has COMMITTED replay terminalization before this SDK error is thrown.
   if(outcome!=='consumed')throw invalidGrant();
  }
  async destroy(id:string):Promise<void>{if(this.model==='Client')throw new OAuthBoundaryError(403);await store.destroy(this.model,oauthKeyHash(this.model,id));}
  async revokeByGrantId(grantId:string):Promise<void>{if(this.model==='Client')throw new OAuthBoundaryError(403);await store.revokeByGrantId(grantId);}
 };
}
