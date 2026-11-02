// Actual source with controlled boundaries only. No Provider/import, credentials, DB, protocol, network or browser.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url),root=new URL('../../',import.meta.url);
const read=p=>fs.readFileSync(new URL(p,root),'utf8');
const environment={env:{NEXT_PUBLIC_SUPABASE_URL:'https://synthetic-project.invalid',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'synthetic-public-placeholder'}};
function load(path,mocks={}){const loaded={exports:{}};vm.runInNewContext(ts.transpileModule(read(path),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{module:loaded,exports:loaded.exports,require:id=>Object.hasOwn(mocks,id)?mocks[id]:require(id),process:environment,Buffer,TextEncoder,URL,Date,Error,WeakMap,WeakSet,Set,Map,structuredClone},{filename:path});return loaded.exports;}
const types=load('lib/types.ts'),validation=load('lib/validation.ts',{'./types':types});
const contracts=load('server/oauth/contracts.ts');
const identity=load('server/services/auth.ts',{'server-only':{}});
// Current-main OFF compatibility mode: AUTHORED_UNRUN in this candidate. No store/provider acquisition.
if(process.argv.includes('--off-integration')){
 const ordinary={id:'a0000000-0000-4000-8000-000000000001',is_anonymous:false,user_metadata:{}};
 let userCalls=0,claimCalls=0,globalSignouts=0;
 const oldClient={auth:{getUser:async()=>{userCalls++;return {data:{user:ordinary},error:null};},getClaims:async()=>{claimCalls++;throw Error('ordinary identity must not add claims call');}}};
 const oldIdentity=await identity.requireIdentity(oldClient);identity.assertIdentity(oldIdentity);
 assert.equal(userCalls,1);assert.equal(claimCalls,0);
 const freshClaims={sub:ordinary.id,iss:'https://synthetic-project.invalid/auth/v1',aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+600,session_id:'b0000000-0000-4000-8000-000000000001',is_anonymous:false};
 let nativeUsers=0,nativeClaims=0;
 const nativeClient={auth:{getUser:async()=>{nativeUsers++;return {data:{user:ordinary},error:null};},getClaims:async()=>{nativeClaims++;return {data:{claims:freshClaims},error:null};}}};
 const nativeIdentity=await identity.requireNativeOAuthWebIdentity(nativeClient);identity.assertIdentity(nativeIdentity);
 assert.equal(nativeUsers,1);assert.equal(nativeClaims,1);
 for(const patch of [{client_id:null},{native_capability:false},{mcp_capability:''},{aud:['authenticated','native']},{sub:freshClaims.session_id},{exp:0},{session_id:'invalid'}])await assert.rejects(()=>identity.requireNativeOAuthWebIdentity({auth:{getUser:nativeClient.auth.getUser,getClaims:async()=>({data:{claims:{...freshClaims,...patch}},error:null})}}));
 let telemetry=[];
 const actualActions=load('app/actions.ts',{'@/lib/telemetry-server':{startAuthTelemetry:async()=>({finish:value=>telemetry.push(value)})},'@/lib/supabase/server':{serverClient:async()=>({auth:{signOut:async()=>{globalSignouts++;return {error:null};},getUser:async()=>{throw Error('new global guard forbidden');},getClaims:async()=>{throw Error('new global guard forbidden');}}})},'@/lib/auth-config':{},'@/lib/validation':validation,'@/trpc/server':{},'@/server/services/contribution-source':{},'next/cache':{revalidatePath:()=>{}},'next/navigation':{redirect:()=>{throw Error('controlled redirect');}}});
 await assert.rejects(()=>actualActions.signOut(),/controlled redirect/);assert.equal(globalSignouts,1);assert.equal(telemetry.at(-1),'signout_returned');
 assert.equal(require('node:crypto').createHash('sha256').update(read('app/actions.ts')).digest('hex'),"5e0a366a2c1853bb8791ba1b397db88740e40c72c9bf7c910864f4f28d481089");
 console.log('PASS current-main OFF ordinary identity/signOut and separate native strict producer; controlled source only, no provider/store/DB.');process.exit(0);
}
const adapter=load('server/oauth/adapter.ts',{'server-only':{},'./contracts':contracts});
const stores=load('server/oauth/store.ts',{'server-only':{},'@/server/services/auth':identity,'@/lib/validation':validation,'./adapter':adapter,'./contracts':contracts,postgres:()=>{throw Error('unused real driver denied');}});
// Bounded v2 mode: exercises only the new owner-bound disconnect helper, not the prior76 matrix.
if(process.argv.includes('--disconnect-only')){
 const owner='a0000000-0000-4000-8000-000000000001',other='a0000000-0000-4000-8000-000000000002';
 const clientId='synthetic-client-x',otherClient='synthetic-client-y';let userCalls=0,claimCalls=0,dbCalls=0,captured;
 const sdkClient={auth:{getUser:async()=>{userCalls++;return {data:{user:{id:owner,is_anonymous:false,user_metadata:{}}},error:null};},getClaims:async()=>{claimCalls++;return {data:{claims:{sub:owner,iss:'https://synthetic-project.invalid/auth/v1',aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+600,session_id:'b0000000-0000-4000-8000-000000000001',is_anonymous:false}},error:null};}}};
 const web=await identity.requireNativeOAuthWebIdentity(sdkClient);
 const policy={...contracts.OAUTH_DISABLED_POLICY,enabled:true,issuer:'https://synthetic-issuer.invalid',clients:[{clientId,redirectUris:['http://127.0.0.1:4321/callback'],scopes:['reports:publish'],renewable:true}]};
 const generations=[{owner,clientId,state:'PENDING'},{owner,clientId,state:'ACTIVE'},{owner:other,clientId,state:'ACTIVE'},{owner,clientId:otherClient,state:'ACTIVE'},{owner,clientId,state:'TERMINAL'}];
 const runTransaction=async callback=>callback({query:async(_sql,args)=>{dbCalls++;assert.equal(args[0],'disconnect');captured=JSON.parse(args[1]);let changed=0;for(const row of generations)if(row.owner===captured.accountId&&row.clientId===captured.clientId&&['PENDING','ACTIVE'].includes(row.state)){row.state='TERMINAL';changed++;}return [{result:{clientId:captured.clientId,disconnected:changed>0}}];}});
 const store=stores.createOAuthStore({policy,runTransaction});
 const helper=stores.createOAuthApprovalService({store});
 // Body-like extras cannot choose account/grant; same fresh Node-produced Identity is used, no second SDK read.
 const saved=await helper.disconnectOAuthClient({verifiedWebActor:web,clientId,accountId:other,providerGrantId:'inert-foreign-selector'});
 assert.deepEqual(JSON.parse(JSON.stringify(saved)),{clientId,disconnected:true});
 assert.deepEqual(captured,{accountId:owner,clientId});assert.equal(Object.keys(saved).length,2);
 assert.deepEqual(generations.map(row=>row.state),['TERMINAL','TERMINAL','ACTIVE','ACTIVE','TERMINAL']);
 assert.equal((await helper.disconnectOAuthClient({verifiedWebActor:web,clientId})).disconnected,false);
 const before=dbCalls;await assert.rejects(()=>helper.disconnectOAuthClient({verifiedWebActor:{user:{id:other},client:sdkClient},clientId}));assert.equal(dbCalls,before);
 await assert.rejects(()=>helper.disconnectOAuthClient({verifiedWebActor:web,clientId:otherClient}),e=>e.status===403);assert.equal(dbCalls,before);
 assert.equal(userCalls,1);assert.equal(claimCalls,1);
 const blocked=stores.createOAuthStore({policy:{...policy,enabled:false},runTransaction:async()=>{throw Error('disabled driver reached');}});await assert.rejects(()=>blocked.disconnectOAuthClient({verifiedWebActor:web,clientId}),e=>e.status===503);
 const failed=stores.createOAuthStore({policy,runTransaction:async()=>{throw {code:'PO401',message:'private account detail'};}});await assert.rejects(()=>failed.disconnectOAuthClient({verifiedWebActor:web,clientId}),e=>e.status===401&&!e.message.includes('private'));
 const ddlName=fs.readdirSync(new URL('supabase/migrations/',root)).find(n=>n.endsWith('_native_oauth_private.sql'));const ddl=read('supabase/migrations/'+ddlName);
 assert.ok(read('supabase/schema.sql').endsWith(ddl));
 assert.match(ddl,/if p_operation='disconnect' then account:=\(p_args->>'accountId'\)::uuid;client:=p_args->>'clientId'/);
 assert.match(ddl,/q.account_id=account and q.client_id=client and q.state in \('PENDING','ACTIVE'\) order by q.provider_id for update/);
 assert.match(ddl,/update private.oauth_grants q set state='TERMINAL',terminal_at=coalesce\(q.terminal_at,stamp\) where q.account_id=account and q.client_id=client and q.state in \('PENDING','ACTIVE'\)/);
 const branch=ddl.slice(ddl.indexOf(" if p_operation='disconnect' then\n  select c"),ddl.indexOf(" if g.provider_id is not null and g.account_id is null"));
 assert.ok(branch.includes("return jsonb_build_object('clientId',client,'disconnected',total>0)"));assert.ok(!branch.includes('hashtextextended'));assert.ok(!branch.includes('delete from'));assert.ok(!branch.includes('set_config'));
 console.log('PASS disconnect-only: actual fresh-identity-derived account/helper/allowlist/receipt/denial/one-SDK-read checks; other account/client untouched in controlled model; stable scoped SQL source assertions only. No prior76 matrix, SQL/Provider/protocol/crypto/DB/network/browser.');
 process.exit(0);
}
const userId='a0000000-0000-4000-8000-000000000001',requestId='b0000000-0000-4000-8000-000000000001',savedId='c0000000-0000-4000-8000-000000000001';
const resource=contracts.OAUTH_RESOURCE;
const claims={sub:userId,iss:'https://synthetic-project.invalid/auth/v1',aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600,session_id:requestId,is_anonymous:false};
const user={id:userId,is_anonymous:false,user_metadata:{display_name:'Synthetic'},email:'not-public@example.invalid'};
let reads=0,claimReads=0,signouts=0;
function sdk(options={}){return {auth:{getUser:async()=>{reads++;if(options.throwUser)throw Error('private');return {data:{user:Object.hasOwn(options,'user')?options.user:user},error:options.userError??null};},getClaims:async()=>{claimReads++;if(options.throwClaims)throw Error('private');return {data:{claims:Object.hasOwn(options,'claims')?options.claims:claims},error:options.claimError??null};},signOut:async()=>{signouts++;return {error:null};}}};}
let checks=0;
for(const [status,code]of [[400,'BAD_REQUEST'],[401,'UNAUTHORIZED'],[403,'FORBIDDEN'],[404,'NOT_FOUND'],[409,'CONFLICT'],[413,'PAYLOAD_TOO_LARGE'],[429,'TOO_MANY_REQUESTS'],[500,'INTERNAL_SERVER_ERROR'],[503,'SERVICE_UNAVAILABLE']]){assert.equal(new contracts.OAuthBoundaryError(status).code,code);checks++;}
assert.equal(contracts.safeOAuthBoundaryError({message:'private'}).status,500);
assert.equal(Object.isFrozen(contracts.OAUTH_OPERATION_SCOPES),true);
await identity.requireNativeOAuthWebIdentity(sdk());await identity.requireNativeOAuthWebIdentity(sdk({claims:{...claims,aud:['authenticated']}}));
for(const options of [{user:null},{user:{...user,is_anonymous:true}},{user:{...user,is_anonymous:undefined}},{throwUser:true},{throwClaims:true},{claimError:{}},{claims:null},...[{sub:requestId},{iss:'https://wrong.invalid/auth/v1'},{aud:['authenticated',resource]},{aud:resource},{role:'anon'},{exp:0},{session_id:'not-uuid'},{is_anonymous:undefined},{client_id:null},{client_id:''},{native_capability:null},{mcp_capability:false}].map(p=>({claims:{...claims,...p}}))]){await assert.rejects(()=>identity.requireNativeOAuthWebIdentity(sdk(options)),e=>e.name==='AuthenticationError'&&!e.message.includes('private'));checks++;}
const human=await identity.requireNativeOAuthWebIdentity(sdk());
assert.ok(reads>claimReads);
const policy={enabled:true,issuer:'https://synthetic-issuer.invalid',resource,clients:[{clientId:'synthetic-static-client',redirectUris:['http://127.0.0.1:4321/callback'],scopes:['reports:publish','fixes:publish','verifications:record'],renewable:true}],ttl:{authorizationCodeSeconds:120,accessTokenSeconds:600,interactionSeconds:600,refreshIdleSeconds:604800,refreshFamilySeconds:2592000}};
await assert.rejects(()=>stores.createOAuthStore().findActiveGrant('synthetic-grant'),e=>e.status===503);
const persisted=[];let outcome='consumed',didCommit=false;const events=[];
const modelStore={policy,upsert:async(...args)=>persisted.push(args),find:async()=>({payload:persisted.at(-1)[2],expiresAt:2000000000}),findByIndex:async()=>undefined,consume:async()=>outcome,destroy:async()=>{},revokeByGrantId:async()=>{}};
const Adapter=adapter.createOAuthAdapterFactory({store:modelStore,invalidGrant:()=>Error('controlled invalid grant')});
assert.throws(()=>new Adapter('DeviceCode'),e=>e.status===503);
const clientAdapter=new Adapter('Client');assert.equal(await clientAdapter.find('synthetic-static-client'),undefined);await assert.rejects(()=>clientAdapter.upsert('id',{},1),e=>e.status===403);await assert.rejects(()=>clientAdapter.destroy('id'),e=>e.status===403);
for(const model of ['AuthorizationCode','AccessToken','RefreshToken']){
 const instance=new Adapter(model),id='inert-'+model;
 const payload={kind:model,jti:id,iat:1900000000,exp:1900000600,grantId:'opaque-nonuuid-grant',accountId:userId,clientId:'synthetic-static-client',scope:'reports:publish',...(model==='AccessToken'?{aud:resource}:{resource})};
 await instance.upsert(id,payload,120);const record=persisted.at(-1);assert.match(record[1],/^[a-f0-9]{64}$/);assert.equal(Object.hasOwn(record[2],'jti'),false);assert.ok(!JSON.stringify(record).includes(id));assert.equal((await instance.find(id)).jti,id);
 await assert.rejects(()=>instance.upsert(id,{...payload,jti:'different'},120),e=>e.status===400);
 await assert.rejects(()=>instance.upsert(id,{...payload,unexpected:true},120),e=>e.status===400);
 await assert.rejects(()=>instance.upsert(id,{...payload,extra:{access_token:'inert-forbidden-field'}},120),e=>e.status===400);
 checks+=7;
}
const Session=new Adapter('Session');await Session.upsert('synthetic-cookie-id',{kind:'Session',jti:'synthetic-cookie-id',iat:1900000000,exp:1900000600,uid:'synthetic-session-uid',accountId:userId,authorizations:{'synthetic-static-client':{grantId:'opaque-nonuuid-grant'}}},120);assert.equal(persisted.at(-1)[2].jti,'synthetic-cookie-id');
const Interaction=new Adapter('Interaction');await assert.rejects(()=>Interaction.upsert('interaction',{kind:'Interaction',jti:'interaction',iat:1900000000,exp:1900000600,params:{body:'not a protocol field'}},120),e=>e.status===400);
// Actual adapter preserves scalar/singleton resource parameters; SQL normalizes separately, never rewrites SDK params.
for(const requestedResource of [resource,[resource]]){
 await Interaction.upsert('interaction-resource',{kind:'Interaction',jti:'interaction-resource',iat:1900000000,exp:1900000600,params:{client_id:'synthetic-static-client',resource:requestedResource}},120);
 assert.deepEqual(JSON.parse(JSON.stringify(persisted.at(-1)[2].params.resource)),requestedResource);checks++;
}
const committedStore=stores.createOAuthStore({policy,runTransaction:async callback=>{events.push('begin');const result=await callback({query:async(_sql,args)=>{assert.equal(args[0],'consume');events.push('db-outcome');return [{result:'replay-terminalized'}];}});didCommit=true;events.push('commit');return result;}});
const ReplayAdapter=adapter.createOAuthAdapterFactory({store:committedStore,invalidGrant:()=>{assert.equal(didCommit,true);events.push('invalid-grant');return Error('controlled invalid grant');}});
await assert.rejects(()=>new ReplayAdapter('RefreshToken').consume('inert-replay-id'));assert.deepEqual(events,['begin','db-outcome','commit','invalid-grant']);checks++;
let captured,transactions=0,preparedName='A',published=0;
const driver=async callback=>{transactions++;return callback({query:async(_sql,args)=>{if(_sql.includes('set_config'))return [];const data=JSON.parse(args[1]);if(args[0]==='prepare-publish')return [{result:{displayName:preparedName}}];if(args[0]==='publish'){published++;captured=data;return [{result:{status:201,id:savedId,kind:data.kind,url:'/reports/'+savedId}}];}if(args[0]==='active-grant')return [{result:null}];if(args[0]==='approve'){captured=data;return [{result:{interactionUid:'interaction',providerGrantId:data.providerGrantId,generationId:savedId,accountId:userId,clientId:'synthetic-static-client',resource,scopes:['reports:publish'],renewable:true}}];}throw Error('unexpected controlled operation');}});};
const store=stores.createOAuthStore({policy,runTransaction:driver});
assert.equal(await store.findActiveGrant('opaque-nonuuid-grant'),undefined);
const binding=await store.approveOAuthGrant({interactionUid:'interaction',providerGrantId:'opaque-nonuuid-grant',verifiedWebActor:human});assert.equal(binding.providerGrantId,'opaque-nonuuid-grant');assert.deepEqual(Object.keys(captured).sort(),['accountId','interactionHash','providerGrantId']);assert.equal(captured.accountId,userId);await assert.rejects(()=>store.approveOAuthGrant({interactionUid:'interaction',providerGrantId:'opaque-nonuuid-grant',verifiedWebActor:{user,client:sdk()}}));
const report={author_name:'spoof',title:'Synthetic finding title',summary:'Synthetic finding summary only.',body:'Synthetic finding body only.',environment:'Unknown environment',reproduction:'Synthetic reproduction only.',attempted_fixes:'',category:'Other',tags:[]};
const context={credentialHash:'a'.repeat(64),grantId:'opaque-nonuuid-grant',clientId:'synthetic-static-client',accountId:userId,resource,scope:['reports:publish'],exp:Math.floor(Date.now()/1000)+600};
const before=transactions;await store.publish(context,'report',report);assert.equal(transactions,before+1);assert.equal(JSON.parse(captured.dataJson).author_name,'A');assert.equal(captured.bundleJson,null);assert.equal(Object.hasOwn(captured,'data'),false);
const near={...report,author_name:'A',body:'Ω'.repeat(20000),reproduction:'x'.repeat(10000),attempted_fixes:'x'.repeat(9000)};
near.attempted_fixes+='x'.repeat(60000-Buffer.byteLength(JSON.stringify(near),'utf8'));
assert.equal(Buffer.byteLength(JSON.stringify(near),'utf8'),60000);
await store.publish(context,'report',near);assert.equal(Buffer.byteLength(captured.dataJson,'utf8'),60000);
preparedName='N'.repeat(80);const publishedBefore=published;await assert.rejects(()=>store.publish(context,'report',near),e=>e.status===413);assert.equal(published,publishedBefore);preparedName='A';
for(const [metadata,expected]of [[null,'Contributor'],['','Contributor'],[' \t\n\u00a0','Contributor'],[' \tChosen Name \n','Chosen Name'],['N'.repeat(100),'N'.repeat(80)]]){preparedName=metadata;await store.publish(context,'report',report);assert.equal(JSON.parse(captured.dataJson).author_name,expected);checks++;}preparedName='A';
let driverOptions,driverQueries=[];let closureUnsafe=false;
const driverStore=load('server/oauth/store.ts',{'server-only':{},'@/server/services/auth':identity,'@/lib/validation':validation,'./adapter':adapter,'./contracts':contracts,postgres:(_url,options)=>{driverOptions=options;return {begin:async(_mode,callback)=>callback({unsafe:async sql=>{driverQueries.push(sql);if(sql.includes('session_user as name'))return [{name:'oauth_fixture_login',unsafe:false}];if(sql.includes('recursive'))return [{unsafe:closureUnsafe}];return [];}})};}});
for(const databaseUrl of ['not a dsn','https://login:inert@db.invalid/database','postgresql://db.invalid/database','postgresql://login:inert@db.invalid/'])assert.throws(()=>driverStore.createPostgresOAuthDriver({databaseUrl,expectedLogin:'oauth_fixture_login'}),e=>e.status===503&&!e.message.includes(databaseUrl));
const runDriver=driverStore.createPostgresOAuthDriver({databaseUrl:'postgresql://oauth_fixture_login:inert-placeholder@db.invalid:5432/disposable',expectedLogin:'oauth_fixture_login'});assert.equal(driverOptions.ssl.rejectUnauthorized,true);assert.equal(driverOptions.host,'db.invalid');assert.equal(driverOptions.database,'disposable');assert.equal(driverOptions.username,'oauth_fixture_login');
closureUnsafe=true;await assert.rejects(()=>runDriver(async()=>null),e=>e.status===503);assert.ok(!driverQueries.some(q=>q.startsWith('set local role')));checks++;
const bundle={contract_version:1,check:{kind:'command',instructions:'x'.repeat(2000),expected_result:'x'.repeat(2000)},before_result:{output:'',exit_code:0},after_result:null,versions:Array.from({length:12},(_,i)=>({kind:'package',name:String(i).padEnd(80,'x'),version:'x'.repeat(120)}))};
bundle.before_result.output='x'.repeat(12288-Buffer.byteLength(JSON.stringify(bundle),'utf8'));assert.ok(bundle.before_result.output.length<=6000);await store.publish(context,'report',{...report,evidence_bundle:bundle});assert.equal(Buffer.byteLength(captured.bundleJson,'utf8'),12288);checks+=10;
let projected={grantId:context.grantId,accountId:userId,clientId:context.clientId,aud:resource,scope:'reports:publish',exp:context.exp},checked=0,saves=0,seen;
const actorModule=load('server/oauth/actor.ts',{'server-only':{},'@/server/services/auth':identity,'@/lib/validation':validation,'./adapter':adapter,'./contracts':contracts,'@supabase/ssr':{...require('@supabase/ssr'),createServerClient:()=>{throw Error('unused real SSR denied');}}});
const actorService=actorModule.createOAuthActorService({store:{policy,checkAccess:async c=>{checked++;seen=c;},publish:async()=>{saves++;return {status:201,id:savedId,kind:'report'};}},findAccessToken:async()=>projected});
const actor=await actorService.requireMcpOAuthActor({opaqueAccessToken:'inert-access-input',requiredOperation:'publish_report'});assert.equal(JSON.stringify(actor),'{}');assert.ok(!JSON.stringify(seen).includes('inert-access-input'));assert.match(seen.credentialHash,/^[a-f0-9]{64}$/);
await actorService.publishMcpOAuthContribution(actor,'report',report);assert.equal(checked,1);assert.equal(saves,1);await assert.rejects(()=>actorService.publishMcpOAuthContribution({...actor},'report',report),e=>e.status===403);
for(const patch of [{aud:'wrong'},{exp:0},{scope:'fixes:publish'},{scope:'reports:publish unexpected'},{accountId:null}]){projected={...projected,...patch};await assert.rejects(()=>actorService.requireMcpOAuthActor({opaqueAccessToken:'inert-access-input',requiredOperation:'publish_report'}));projected={grantId:context.grantId,accountId:userId,clientId:context.clientId,aud:resource,scope:'reports:publish',exp:context.exp};checks++;}
let cookieJar,updatedHeaders,noIdentity=false;
const ssr=require('@supabase/ssr');const nodeHelper=load('server/oauth/actor.ts',{'server-only':{},'@/server/services/auth':identity,'@/lib/validation':validation,'./adapter':adapter,'./contracts':contracts,'@supabase/ssr':{parseCookieHeader:ssr.parseCookieHeader,serializeCookieHeader:ssr.serializeCookieHeader,createServerClient:(_url,key,options)=>{assert.equal(key,'synthetic-public-placeholder');cookieJar=options.cookies;const result=sdk(noIdentity?{user:null}:{});const fresh=result.auth.getUser;result.auth.getUser=async()=>{assert.equal(cookieJar.getAll()[0].value,'synthetic-app-value');cookieJar.setAll([{name:'app',value:'synthetic-refreshed-value',options:{path:'/',httpOnly:true}}]);return fresh();};return result;}}});
await nodeHelper.requireNodeWebOAuthIdentity({headers:{cookie:'app=synthetic-app-value'}},{getHeader:()=>['provider=synthetic-provider-value; Path=/'],setHeader:(name,value)=>{assert.equal(name,'Set-Cookie');updatedHeaders=value;}});assert.equal(updatedHeaders.length,2);assert.ok(updatedHeaders[0].startsWith('provider='));assert.equal(cookieJar.getAll()[0].value,'synthetic-refreshed-value');checks++;noIdentity=true;await assert.rejects(()=>nodeHelper.requireNodeWebOAuthIdentity({headers:{cookie:'app=synthetic-app-value'}},{getHeader:()=>[],setHeader:()=>{}}),e=>e.status===401&&e.code==='UNAUTHORIZED');checks++;
// Ordinary signOut retains exact current behavior; native strict producer is a separate entry point.
let authClient=sdk({claims:{...claims,client_id:null}}),telemetry=[];
const actions=load('app/actions.ts',{'@/lib/telemetry-server':{startAuthTelemetry:async()=>({finish:s=>telemetry.push(s)})},'@/lib/supabase/server':{serverClient:async()=>authClient},'@/server/services/auth':identity,'@/lib/auth-config':{},'@/lib/validation':validation,'@/trpc/server':{},'@/server/services/contribution-source':{},'next/cache':{revalidatePath:()=>{}},'next/navigation':{redirect:()=>{throw Error('controlled redirect');}}});
const outs=signouts;await assert.rejects(()=>actions.signOut(),/controlled redirect/);assert.equal(signouts,outs+1);assert.equal(telemetry.at(-1),'signout_returned');checks++;
const ddlName=fs.readdirSync(new URL('supabase/migrations/',root)).find(n=>n.endsWith('_native_oauth_private.sql'));const ddl=read('supabase/migrations/'+ddlName);
assert.ok(read('supabase/schema.sql').endsWith(ddl));
assert.equal((ddl.match(/case jsonb_typeof\(params->'resource'\) when 'string' then params->>'resource' when 'array' then case when jsonb_array_length\(params->'resource'\)=1 and jsonb_typeof\(params->'resource'->0\)='string' then params->'resource'->>0 else null end else null end/g)??[]).length,2);
assert.match(ddl,/resource is distinct from 'https:\/\/tokenoverflow\.app\/api\/mcp'/);assert.match(ddl,/resource is distinct from g.resource/);
assert.match(ddl,/with recursive reachable/);assert.match(ddl,/banned_until is null or banned_until<=clock_timestamp\(\)/);assert.match(ddl,/approved_interaction_uid/);assert.match(ddl,/m='Grant' and g.state<>'ACTIVE'/);
assert.ok(ddl.indexOf("p_operation in ('prepare-publish','publish') then perform pg_advisory")<ddl.indexOf('pg_advisory_xact_lock(1330078036'));
assert.match(ddl,/authorizations'->g.client_id->>'grantId'=g.provider_id/);
assert.match(ddl,/convert_to\(p_args->>'dataJson','UTF8'\)/);assert.match(ddl,/convert_to\(p_args->>'bundleJson','UTF8'\)/);assert.ok(!ddl.includes('convert_to(d::text'));
assert.match(ddl,/parent_owner is not null and parent_owner<>g.account_id and not is_example\) is not true/);
assert.match(ddl,/failed_constraint='verifications_fix_id_author_id_environment_key'/);assert.match(ddl,/failed_schema='public' and failed_table='verifications'/);
assert.match(ddl,/p_operation='consume' or m in \('AuthorizationCode','RefreshToken'\) and rec.consumed_at is not null/);
assert.match(ddl,/if m in \('AuthorizationCode','RefreshToken'\) then update private.oauth_grants/);
assert.match(ddl,/return case when p_operation='consume' then '"replay-terminalized"'/);assert.match(ddl,/consumed_at=stamp,payload='\{\}'/);assert.ok(!/grant .* to (authenticator|anon|authenticated)/i.test(ddl));
console.log(`PASS OAuth source: ${checks}+ controlled identity/adapter/store/actor/cookie/signout checks; compact60000/12288 boundaries; commit-before-error ordering modeled, SQL source assertions only. No Provider/SDK protocol, real credential, DB/SQL runtime, server/network/browser or hosted activation.`);
