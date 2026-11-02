import 'server-only';
import postgres from 'postgres';
import { assertIdentity } from '@/server/services/auth';
import { reportSchema,fixSchema,verificationSchema } from '@/lib/validation';
import { oauthKeyHash } from './adapter';
import { OAUTH_DISABLED_POLICY,OAUTH_RESOURCE,OAuthBoundaryError,type OAuthApprovalInput,type OAuthGrantBinding,type OAuthPolicy,type OAuthStore,type OAuthPayload,type OAuthModel,type OAuthStoredRecord,type OAuthAccessContext,type OAuthContributionKind,type OAuthOperation,type OAuthContributionReceipt,type OAuthDisconnectInput,type OAuthDisconnectReceipt } from './contracts';
export interface OAuthTransaction {query(statement:string,parameters:readonly unknown[]):Promise<readonly Record<string,unknown>[]>;}
export type OAuthTransactionRunner=<T>(run:(tx:OAuthTransaction)=>Promise<T>)=>Promise<T>;
// No ambient DATABASE_URL/fallback/service-role/DataAPI. Owner must explicitly bind exact restricted login.
export function createPostgresOAuthDriver({databaseUrl,expectedLogin}:{databaseUrl:string;expectedLogin:string}):OAuthTransactionRunner{
 if(!/^[a-z_][a-z0-9_]{0,62}$/.test(expectedLogin)||['postgres','service_role','supabase_admin','authenticator','anon','authenticated'].includes(expectedLogin))throw new OAuthBoundaryError(503);
 let url:URL;let client:ReturnType<typeof postgres>;
 try {
  if(typeof databaseUrl!=='string')throw new OAuthBoundaryError(503);
  url=new URL(databaseUrl);
  if(!['postgres:','postgresql:'].includes(url.protocol)||!url.hostname||!url.username||!url.password||url.pathname==='/'||!url.pathname||url.search||url.hash||decodeURIComponent(url.username).split('.')[0]!==expectedLogin)throw new OAuthBoundaryError(503);
  client=postgres(databaseUrl,{host:url.hostname,port:Number(url.port||5432),database:decodeURIComponent(url.pathname.slice(1)),username:decodeURIComponent(url.username),password:decodeURIComponent(url.password),max:1,prepare:false,ssl:{rejectUnauthorized:true},connect_timeout:5,idle_timeout:20});
 } catch {throw new OAuthBoundaryError(503);} 
 return async run=>client.begin('isolation level read committed',async tx=>{
  const [login]=await tx.unsafe('select session_user as name,rolsuper or rolbypassrls or rolinherit or rolcreatedb or rolcreaterole or rolreplication as unsafe from pg_roles where rolname=session_user');
  if(!login||login.name!==expectedLogin||login.unsafe)throw new OAuthBoundaryError(503);
  const [closure]=await tx.unsafe("with recursive reachable(roleid) as (select roleid from pg_auth_members where member=(select oid from pg_roles where rolname=session_user) union select m.roleid from pg_auth_members m join reachable r on m.member=r.roleid) select exists(select 1 from reachable where roleid<>(select oid from pg_roles where rolname='tokenoverflow_oauth_backend')) as unsafe");
  if(!closure||closure.unsafe)throw new OAuthBoundaryError(503);
  await tx.unsafe('set local role tokenoverflow_oauth_backend');
  return run({query:async(statement,parameters)=>Array.from(await tx.unsafe(statement,parameters as postgres.ParameterOrJSON<never>[]))});
 }) as Promise<Awaited<ReturnType<typeof run>>>;
}
function mapped(error:unknown):OAuthBoundaryError{
 if(error instanceof OAuthBoundaryError)return error;
 const code=error&&typeof error==='object'&&'code'in error?String(error.code):'';
 const statuses:Record<string,400|401|403|404|409|413|429|500|503>={PO400:400,PO401:401,PO403:403,PO404:404,PO409:409,PO413:413,PO429:429,PO500:500,PO503:503};
 return new OAuthBoundaryError(statuses[code]??500);
}
export function createOAuthStore({runTransaction,policy=OAUTH_DISABLED_POLICY}:{runTransaction?:OAuthTransactionRunner;policy?:OAuthPolicy}={}):OAuthStore{
 // Snapshot trusted server options; later body/config mutation cannot broaden a live store.
 const configured=structuredClone(policy);Object.freeze(configured.ttl);for(const client of configured.clients){Object.freeze(client.redirectUris);Object.freeze(client.scopes);Object.freeze(client);}Object.freeze(configured.clients);Object.freeze(configured);
 async function call(operation:string,args:OAuthPayload):Promise<unknown>{
  if(!configured.enabled||configured.resource!==OAUTH_RESOURCE||!configured.clients.length||!runTransaction)throw new OAuthBoundaryError(503);
  try{return await runTransaction(async tx=>{const rows=await tx.query('select private.oauth_backend($1::text,$2::text::jsonb,$3::text::jsonb) as result',[operation,JSON.stringify(args),JSON.stringify(configured)]);if(rows.length!==1||!Object.hasOwn(rows[0],'result'))throw new OAuthBoundaryError(500);return rows[0].result;});}catch(error){throw mapped(error);}
 }
 const store:OAuthStore={
  policy:configured,
  async disconnectOAuthClient(input:OAuthDisconnectInput){
   // Node POST caller creates this SAME identity afresh via requireNodeWebOAuthIdentity; no second SDK read.
   assertIdentity(input.verifiedWebActor);
   if(typeof input.clientId!=='string'||!configured.clients.some(client=>client.clientId===input.clientId))throw new OAuthBoundaryError(403);
   const receipt=await call('disconnect',{accountId:input.verifiedWebActor.user.id,clientId:input.clientId});
   if(!receipt||typeof receipt!=='object'||!('clientId'in receipt)||receipt.clientId!==input.clientId||!('disconnected'in receipt)||typeof receipt.disconnected!=='boolean')throw new OAuthBoundaryError(500);
   return {clientId:receipt.clientId,disconnected:receipt.disconnected} as OAuthDisconnectReceipt;
  },
  async findActiveGrant(providerGrantId){const row=await call('active-grant',{providerGrantId});return row===null?undefined:row as OAuthGrantBinding;},
  async upsert(model:Exclude<OAuthModel,'Client'>,keyHash:string,payload:OAuthPayload,ttl:number){await call('upsert',{model,keyHash,payload,ttl});},
  async find(model,keyHash){const row=await call('find',{model,keyHash});return row===null?undefined:row as OAuthStoredRecord;},
  async findByIndex(model,index,value){const row=await call('find-index',{model,index,value});return row===null?undefined:row as OAuthStoredRecord;},
  async consume(model,keyHash){const outcome=await call('consume',{model,keyHash});if(!['consumed','invalid','replay-terminalized'].includes(String(outcome)))throw new OAuthBoundaryError(500);return outcome as 'consumed'|'invalid'|'replay-terminalized';},
  async destroy(model,keyHash){await call('destroy',{model,keyHash});},
  async revokeByGrantId(grantId){await call('revoke',{grantId});},
  async approveOAuthGrant(input:OAuthApprovalInput){assertIdentity(input.verifiedWebActor);return await call('approve',{interactionHash:oauthKeyHash('Interaction',input.interactionUid),providerGrantId:input.providerGrantId,accountId:input.verifiedWebActor.user.id}) as OAuthGrantBinding;},
  async checkAccess(context:OAuthAccessContext,operation:OAuthOperation){await call('check-access',{context,operation});},
  async publish(context:OAuthAccessContext,kind:OAuthContributionKind,input:unknown){
   if(!configured.enabled||configured.resource!==OAUTH_RESOURCE||!configured.clients.length||!runTransaction)throw new OAuthBoundaryError(503);
   try{return await runTransaction(async tx=>{
    const prepared=await tx.query('select private.oauth_backend($1::text,$2::text::jsonb,$3::text::jsonb) as result',['prepare-publish',JSON.stringify({context,kind}),JSON.stringify(configured)]);
    const authority=prepared[0]?.result;
    if(!authority||typeof authority!=='object'||!('displayName'in authority)||authority.displayName!==null&&typeof authority.displayName!=='string')throw new OAuthBoundaryError(500);
    const displayName=authority.displayName;
    const authorName=typeof displayName==='string'&&displayName.trim()?displayName.trim().slice(0,80):'Contributor';
    await tx.query("select set_config('tokenoverflow.oauth_prepared_author',$1,true)",[authorName]);
    const schema=kind==='report'?reportSchema:kind==='fix'?fixSchema:kind==='verification'?verificationSchema:undefined;
    if(!schema)throw new OAuthBoundaryError(400);
    const parsed=schema.safeParse({...input&&typeof input==='object'?input:{},author_name:authorName});
    if(!parsed.success)throw new OAuthBoundaryError(400);
    const dataJson=JSON.stringify(parsed.data);const bundleJson=parsed.data.evidence_bundle===undefined?null:JSON.stringify(parsed.data.evidence_bundle);
    if(Buffer.byteLength(dataJson,'utf8')>60_000||bundleJson!==null&&Buffer.byteLength(bundleJson,'utf8')>12_288)throw new OAuthBoundaryError(413);
    const rows=await tx.query('select private.oauth_backend($1::text,$2::text::jsonb,$3::text::jsonb) as result',['publish',JSON.stringify({context,kind,dataJson,bundleJson}),JSON.stringify(configured)]);
    const receipt=rows[0]?.result;
    if(!receipt||typeof receipt!=='object'||!('status'in receipt)||receipt.status!==201||!('kind'in receipt)||receipt.kind!==kind||!('id'in receipt)||typeof receipt.id!=='string')throw new OAuthBoundaryError(500);
    return receipt as OAuthContributionReceipt;
   });}catch(error){throw mapped(error);}
  },
 };
 return Object.freeze(store);
}
// Closure supplies store; caller only supplies actual persisted interaction/Grant IDs and verified web identity.
export function createOAuthApprovalService({store}:{store:OAuthStore}){return {approveOAuthGrant:(input:OAuthApprovalInput)=>store.approveOAuthGrant(input),disconnectOAuthClient:(input:OAuthDisconnectInput)=>store.disconnectOAuthClient(input)};}
