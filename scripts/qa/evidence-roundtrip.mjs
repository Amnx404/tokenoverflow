// One executor, platform-owned A fixture only. This never accepts the closed B manifest.
// EVIDENCE_FIXTURE_CONFIG=/ignored/evidence.json node scripts/qa/evidence-roundtrip.mjs /existing/sdk-root
// Form-service means actual action serializer -> live tRPC, not browser/RSC POST.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash, randomUUID } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createTRPCClient, httpLink } from '@trpc/client';
import postgres from 'postgres';
import ts from 'typescript';

const require=createRequire(import.meta.url);
const configPath=process.env.EVIDENCE_FIXTURE_CONFIG;
const sdkRoot=process.argv[2];
if(!configPath||!sdkRoot)throw new Error('Platform A manifest and existing SDK root required; no default target.');
const requiredSources=['app/actions.ts','lib/validation.ts','lib/types.ts','lib/api.ts','server/services/contributions.ts','server/services/reports.ts','server/services/errors.ts','server/api/root.ts','server/db/schema.ts','lib/mcp-evidence.ts','app/api/mcp/route.ts'];
const digest=value=>createHash('sha256').update(value).digest('hex');
let fixture;
let sdkRequire;
let configStep='manifest identity';
try {
 fixture=JSON.parse(fs.readFileSync(configPath,'utf8'));
 assert.equal(fixture.fixture,'tokenoverflow-local-evidence-v1');
 assert.equal(fixture.evidenceReady,true);
 assert.ok(['additive-old-app','compatible-app','restricted-app'].includes(fixture.phase));
 assert.match(fixture.artifactId,/^[A-Za-z0-9_-]{1,100}$/);
 configStep='MCP transport declaration';
 assert.ok(['normal-loopback','canonical-host-loopback'].includes(fixture.mcpMode));
 if(fixture.mcpMode==='canonical-host-loopback') {
  assert.equal(fixture.mcpHostAdapterAuthorized,true,'Explicit local Host adapter authorization required');
  assert.equal(fixture.mcpHost,'tokenoverflow.app');
 }
 assert.ok(['source-dev','compiled'].includes(fixture.runtimeMode));
 configStep='runtime mode and owner binding';
 assert.equal(fixture.ownerProcessBinding,true,'Platform owner must bind the actual serving process to this artifact');
 assert.ok(['drizzle','supabase-data-api'].includes(fixture.backendMode),'Platform backend-mode binding required');
 assert.match(fixture.schemaStageId,/^[A-Za-z0-9_-]{1,100}$/);
 if(fixture.phase==='additive-old-app')assert.ok(['3c48c19682ee9fd0764caeef70a736d0cabb861d','790862f919cd853c09998217f2587a8d8a88fb94'].includes(fixture.artifactId),'Old-app phase requires a declared released pre-privacy baseline');
 else assert.match(fixture.minimumCompatibleApp,/^[A-Za-z0-9_-]{1,100}$/);
 assert.ok([17,18].includes(fixture.postgresMajor));
 configStep='loopback target declaration';
 const app=new URL(fixture.baseUrl),db=new URL(fixture.adminDatabaseUrl);
 const loopback=value=>['localhost','127.0.0.1','[::1]'].includes(value.hostname);
 assert.ok(loopback(app)&&loopback(db));
 assert.equal(app.protocol,'http:');
 assert.ok(app.port&&!app.username&&!app.password&&app.pathname==='/'&&!app.search&&!app.hash);
 assert.equal(Number(app.port),fixture.appPort);
 assert.ok(db.pathname.startsWith('/tokenoverflow_fixture_'));
 assert.ok(['postgres:','postgresql:'].includes(db.protocol));
 configStep='dedicated synthetic identities';
 for(const key of ['aliceId','bobId'])assert.match(fixture[key],/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
 assert.notEqual(fixture.aliceId,fixture.bobId);
 for(const key of ['aliceCookie','bobCookie'])assert.ok(typeof fixture[key]==='string'&&fixture[key].length>0);
 assert.ok(path.isAbsolute(fixture.runtimeRoot));
 configStep='compiled build identity';
 if(fixture.runtimeMode==='compiled') {
  assert.ok(path.isAbsolute(fixture.buildOutputPath));
  assert.match(fixture.buildId,/^[A-Za-z0-9_-]{1,100}$/);
  assert.equal(fs.readFileSync(path.join(fixture.buildOutputPath,'BUILD_ID'),'utf8').trim(),fixture.buildId);
 }
 assert.match(fixture.migrationSha256,/^[a-f0-9]{64}$/);
 configStep='migration path and digest';
 assert.match(fixture.migrationPath,/^supabase\/changes\/[A-Za-z0-9_.-]+\.sql$/);
 assert.equal(digest(fs.readFileSync(path.join(fixture.runtimeRoot,fixture.migrationPath))),fixture.migrationSha256);
 if(fixture.phase==='restricted-app') {
  configStep='restriction migration path and digest';
  assert.match(fixture.restrictionMigrationSha256,/^[a-f0-9]{64}$/);
  assert.match(fixture.restrictionMigrationPath,/^supabase\/changes\/[A-Za-z0-9_.-]+\.sql$/);
  assert.equal(digest(fs.readFileSync(path.join(fixture.runtimeRoot,fixture.restrictionMigrationPath))),fixture.restrictionMigrationSha256);
 }
 for(const file of requiredSources) {
  configStep=`source digest: ${file}`;
  assert.match(fixture.sourceDigests[file],/^[a-f0-9]{64}$/);
  assert.equal(digest(fs.readFileSync(path.join(fixture.runtimeRoot,file))),fixture.sourceDigests[file]);
 }
 configStep='existing official SDK version';
 sdkRequire=createRequire(pathToFileURL(path.resolve(sdkRoot,'package.json')));
 assert.equal(JSON.parse(fs.readFileSync(path.resolve(sdkRoot,'node_modules/@modelcontextprotocol/sdk/package.json'),'utf8')).version,'1.29.0');
}catch{throw new Error(`Invalid or stale platform A fixture configuration at ${configStep}; all contents withheld.`);}

const fetchLocal=(input,init={})=>{
 const target=new URL(typeof input==='string'||input instanceof URL?input:input.url);
 assert.equal(target.origin,new URL(fixture.baseUrl).origin,'A request left the assigned app origin');
 return fetch(input,{...init,redirect:'error',signal:AbortSignal.timeout(15000)});
};
// Explicit engineering-lead authorization: compiled local MCP retains its normal
// canonical Host policy. Native HTTP preserves Host; the socket still goes only
// to the manifest-verified loopback origin. This is not normal remote-client proof.
async function fetchMcp(input,init={}) {
 if(fixture.mcpMode==='normal-loopback')return fetchLocal(input,init);
 const outgoing=new Request(input,init),url=new URL(outgoing.url);
 assert.equal(url.origin,new URL(fixture.baseUrl).origin);
 assert.equal(url.pathname,'/api/mcp');
 assert.ok(!url.search&&!url.hash);
 const headers=new Headers(outgoing.headers);
 headers.set('Host','tokenoverflow.app');
 headers.set('Accept-Encoding','identity');
 const body=['GET','HEAD'].includes(outgoing.method)?undefined:Buffer.from(await outgoing.arrayBuffer());
 const signal=AbortSignal.any([outgoing.signal,AbortSignal.timeout(15000)]);
 return new Promise((resolve,reject)=>{
  const req=httpRequest(url,{method:outgoing.method,headers:Object.fromEntries(headers)},response=>{
   const chunks=[];
   response.on('data',chunk=>chunks.push(chunk));
   response.on('error',reject);
   response.on('end',()=>{
    signal.removeEventListener('abort',abort);
    if(response.statusCode>=300&&response.statusCode<400){reject(new Error('Local MCP redirect refused'));return;}
    const responseHeaders=new Headers();
    for(const [name,value] of Object.entries(response.headers))if(value!==undefined)responseHeaders.set(name,Array.isArray(value)?value.join(', '):value);
    try{resolve(new Response([204,205,304].includes(response.statusCode)?null:Buffer.concat(chunks),{status:response.statusCode,headers:responseHeaders}));}
    catch(error){reject(error);}
   });
  });
  const abort=()=>req.destroy(new Error('Local MCP fixture request aborted'));
  req.on('error',error=>{signal.removeEventListener('abort',abort);reject(error);});
  signal.addEventListener('abort',abort,{once:true});
  if(signal.aborted)abort();
  req.end(body);
 });
}
const admin=postgres(fixture.adminDatabaseUrl,{max:1,prepare:false,ssl:false,connect_timeout:3});
const client=cookie=>createTRPCClient({links:[httpLink({url:new URL('/api/trpc',fixture.baseUrl).toString(),headers:()=>cookie?{cookie}:{},fetch:fetchLocal})]});
const alice=client(fixture.aliceCookie),bob=client(fixture.bobCookie),anonymous=client();
const trpcKinds={report:'report',fix:'fix',verification:'verify'};
const tables={report:'reports',fix:'fixes',verification:'verifications'};
const tools={report:'publish_report',fix:'publish_fix',verification:'record_verification'};
const secrets=[fixture.aliceCookie,fixture.bobCookie];
const publicOnly=value=>{
 if(value&&typeof value==='object')for(const [key,item] of Object.entries(value)) {
  assert.ok(!['author_id','user_id','token_hash','agent_key_id','token','account_id'].includes(key),'Public output included a private identifier field');
  publicOnly(item);
 }
 const serialized=JSON.stringify(value);
 for(const secret of secrets)assert.ok(!serialized.includes(secret),'Public output included a fixture credential');
};
function loadSource(file,mocks={}) {
 const code=ts.transpileModule(fs.readFileSync(path.join(fixture.runtimeRoot,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const loaded={exports:{}};
 vm.runInNewContext(code,{Error,TextEncoder,FormData,Response,Request,process,module:loaded,exports:loaded.exports,require:name=>Object.hasOwn(mocks,name)?mocks[name]:require(name)});
 return loaded.exports;
}
const types=loadSource('lib/types.ts');
const schemas=loadSource('lib/validation.ts',{'./types':types});
const schemaFor=kind=>kind==='report'?schemas.reportSchema:kind==='fix'?schemas.fixSchema:schemas.verificationSchema;
const plain=value=>JSON.parse(JSON.stringify(value));
let actionClient,actionReceipt,actionFailureStatus;
const actionRedirect=new Error('Expected local form-service report redirect');
const forward=name=>async value=>{
 try{actionReceipt=await actionClient.contributions[name].mutate(value);return actionReceipt;}
 catch(error){actionFailureStatus=error.data?.httpStatus;throw error;}
};
const actions=loadSource('app/actions.ts',{
 '@/lib/supabase/server':{},'@/lib/auth-config':{},'@/lib/validation':schemas,
 '@/trpc/server':{api:{contributions:{report:forward('report'),fix:forward('fix'),verify:forward('verify')}}},
 'next/cache':{revalidatePath:()=>{}},'next/navigation':{redirect:()=>{throw actionRedirect;}},
});
function formFor(kind,data) {
 const form=new FormData();
 form.set('kind',kind);
 for(const [key,value] of Object.entries(data))if(key!=='evidence_bundle')form.set(key,Array.isArray(value)?value.join(','):String(value));
 const bundle=data.evidence_bundle;
 if(bundle===undefined)return form;
 form.set('evidence_enabled','1');
 for(const [key,value] of Object.entries(bundle.check))form.set(`evidence_check_${key}`,String(value));
 for(const [name,observation] of [['before',bundle.before_result],['after',bundle.after_result]]) {
  if(observation===null)continue;
  form.set(`evidence_${name}_output`,observation.output);
  if(observation.exit_code!==undefined)form.set(`evidence_${name}_exit_code`,String(observation.exit_code));
 }
 if(bundle.after_result!==null)form.set('evidence_after_recorded','1');
 form.set('evidence_version_count',String(bundle.versions.length));
 bundle.versions.forEach((version,index)=>{
  form.set(`evidence_versions.${index}.kind`,version.kind);
  form.set(`evidence_versions.${index}.name`,version.name);
  if(version.version===null)form.set(`evidence_versions.${index}.unknown`,'1');
  else form.set(`evidence_versions.${index}.version`,version.version);
 });
 return form;
}

let step='platform A safety and artifact checks',passed=0,authorized=false;
const pass=()=>{passed++;console.log(`PASS ${step}`);};
let mcpAlice,mcpBob,mcpPublic;
async function openMcp(token) {
 const {Client}=await import(pathToFileURL(sdkRequire.resolve('@modelcontextprotocol/sdk/client/index.js')));
 const {StreamableHTTPClientTransport}=await import(pathToFileURL(sdkRequire.resolve('@modelcontextprotocol/sdk/client/streamableHttp.js')));
 const transport=new StreamableHTTPClientTransport(new URL('/api/mcp',fixture.baseUrl),{requestInit:{headers:token?{authorization:`Bearer ${token}`}:{}} ,fetch:async(input,init)=>{
  const response=await fetchMcp(input,init);
  assert.equal(response.headers.get('cache-control'),'no-store');
  return response;
 }});
 const instance=new Client({name:'tokenoverflow-isolated-A-roundtrip',version:'1.0.0'},{capabilities:{}});
 try{await instance.connect(transport,{timeout:15000});}
 catch(error){await instance.close();throw error;}
 return instance;
}
async function mcpCall(instance,name,args,status) {
 const result=await instance.callTool({name,arguments:args},undefined,{timeout:15000});
 const text=result.content?.find(item=>item.type==='text')?.text;
 assert.equal(typeof text,'string');
 const data=result.structuredContent;
 assert.deepEqual(JSON.parse(text),data,'MCP text and structured evidence differ');
 assert.equal(result.isError===true,status!==undefined&&status>=400);
 if(status!==undefined)assert.equal(data.status,status);
 publicOnly(data);
 return data;
}
async function snapshot() {
 const [state]=await admin`select
 md5(coalesce((select jsonb_agg(to_jsonb(r) order by id)::text from public.reports r where author_id in (${fixture.aliceId}::uuid,${fixture.bobId}::uuid)),'[]')) as reports,
 md5(coalesce((select jsonb_agg(to_jsonb(f) order by id)::text from public.fixes f where author_id in (${fixture.aliceId}::uuid,${fixture.bobId}::uuid)),'[]')) as fixes,
 md5(coalesce((select jsonb_agg(to_jsonb(v) order by id)::text from public.verifications v where author_id in (${fixture.aliceId}::uuid,${fixture.bobId}::uuid)),'[]')) as results,
 md5(coalesce((select jsonb_agg(to_jsonb(k) order by id)::text from private.agent_keys k where user_id in (${fixture.aliceId}::uuid,${fixture.bobId}::uuid)),'[]')) as keys`;
 return {...state};
}
async function rowCount() {
 const [row]=await admin`select ((select count(*) from public.reports where author_id in (${fixture.aliceId}::uuid,${fixture.bobId}::uuid))+(select count(*) from public.fixes where author_id in (${fixture.aliceId}::uuid,${fixture.bobId}::uuid))+(select count(*) from public.verifications where author_id in (${fixture.aliceId}::uuid,${fixture.bobId}::uuid))+(select count(*) from private.agent_keys where user_id in (${fixture.aliceId}::uuid,${fixture.bobId}::uuid)))::int as total`;
 return row.total;
}
async function clean() {
 await admin`delete from public.verifications where author_id in (${fixture.aliceId}::uuid,${fixture.bobId}::uuid)`;
 await admin`delete from public.fixes where author_id in (${fixture.aliceId}::uuid,${fixture.bobId}::uuid)`;
 await admin`delete from public.reports where author_id in (${fixture.aliceId}::uuid,${fixture.bobId}::uuid)`;
 await admin`delete from private.agent_keys where user_id in (${fixture.aliceId}::uuid,${fixture.bobId}::uuid)`;
}
async function httpWrite(kind,token,data,status) {
 const response=await fetchLocal(new URL(`/api/v1/${tables[kind]}`,fixture.baseUrl),{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify(data)});
 assert.equal(response.headers.get('cache-control'),'no-store');
 assert.match(response.headers.get('x-request-id')??'',/^[a-f0-9-]{36}$/);
 assert.equal(response.status,status);
 const body=await response.json();publicOnly(body);return body;
}
async function save(writer,kind,data,who='alice',status=201) {
 const target=who==='alice'?alice:bob;
 if(writer==='REST')return httpWrite(kind,who==='alice'?aliceToken:bobToken,data,status);
 if(writer==='MCP') {
  const instance=who==='alice'?mcpAlice:mcpBob;
  if(status===400) {
   // Installed server SDK validates the registered input before publishApi, so
   // malformed inputs are SDK tool errors, not structured application HTTP 400s.
   const rejected=await instance.callTool({name:tools[kind],arguments:data},undefined,{timeout:15000});
   assert.equal(rejected.isError,true);
   assert.equal(rejected.structuredContent,undefined);
   const text=rejected.content?.find(item=>item.type==='text')?.text;
   assert.equal(typeof text,'string');
   assert.ok(text.includes(`Input validation error: Invalid arguments for tool ${tools[kind]}:`));
   publicOnly(rejected);
   console.log('PASS MCP malformed input rejected by SDK tool validation; no application HTTP status claimed');
   return;
  }
  return mcpCall(instance,tools[kind],data,status);
 }
 if(writer==='tRPC') {
  if(status>=400) {
   await assert.rejects(target.contributions[trpcKinds[kind]].mutate(data),error=>error.data?.httpStatus===status);
   return;
  }
  return target.contributions[trpcKinds[kind]].mutate(data);
 }
 actionClient=target;actionReceipt=undefined;actionFailureStatus=undefined;
 let response;
 try{response=await actions.contribute({},formFor(kind,data));}catch(error){if(error!==actionRedirect)throw error;}
 if(status>=400){
  assert.ok(response?.error);assert.equal(actionReceipt,undefined);
  // Form validation stops before transport; forwarded denials must have the exact status.
  assert.equal(actionFailureStatus,status===400?undefined:status);
  return;
 }
 assert.ok(actionReceipt?.id);assert.equal(response?.error,undefined);return actionReceipt;
}
async function denied(writer,kind,data,who,status) {
 const before=await snapshot();
 try{await save(writer,kind,data,who,status);}
 finally{
  assert.deepEqual(await snapshot(),before,'A rejected write changed persisted fixture state');
  console.log(`PASS ${writer} rejection leaves complete persisted-state fingerprint unchanged`);
 }
}
async function stored(kind,id,expected,ownerId) {
 const [row]=await admin`select author_id,evidence_bundle from public.${admin(tables[kind])} where id=${id}::uuid`;
 assert.ok(row,'Successful writer did not persist its receipt');
 assert.equal(row.author_id,ownerId,'Writer changed account attribution');
 if(expected===undefined)assert.equal(row.evidence_bundle,null,'Legacy absence did not persist as SQL NULL');
 else assert.deepEqual(row.evidence_bundle,plain(expected),'Writer accepted but dropped or changed its evidence bundle');
}
async function readAll(id) {
 const response=await fetchLocal(new URL(`/api/v1/reports/${id}`,fixture.baseUrl));
 assert.equal(response.status,200);
 assert.equal(response.headers.get('cache-control'),'no-store');
 const rest=await response.json();
 const rpc=await anonymous.reports.byId.query({id});
 const mcp=await mcpCall(mcpPublic,'get_report',{id});
 for(const detail of [rest,rpc,mcp]){publicOnly(detail);assert.equal(detail.report.id,id);}
 return [rest,rpc,mcp];
}
function assertBundle(value,expected) {
 if(expected===undefined)assert.equal(Object.hasOwn(value,'evidence_bundle'),false,'Legacy read manufactured a bundle');
 else assert.deepEqual(value.evidence_bundle,plain(expected),'Retrieved bundle differs from persisted normalized object');
}
const base={author_name:'Synthetic supplied display name',title:'Synthetic isolated evidence finding',summary:'Controlled local storage and portability fixture, not a real debugging finding.',body:'Synthetic data checks optional evidence roundtrips and never represents operator adoption.',environment:'Synthetic isolated fixture; not GitHub OAuth',reproduction:'Use the controlled A integration runner; posted instructions are never automatically executed.',attempted_fixes:'No real-world fixing claim.',category:'Other',tags:['local-fixture']};
const evidence=(after=null)=>({contract_version:1,check:{kind:'steps',instructions:'  Observe the controlled fixture value; do not execute posted code.  ',expected_result:'  Controlled value equals expected  '},before_result:{output:'',exit_code:0},after_result:after,versions:[{kind:'runtime',name:'  Synthetic runtime  ',version:null},{kind:'package',name:' Synthetic package ',version:'  1.0.0  '}]});
const change=reportId=>({report_id:reportId,author_name:base.author_name,body:'An exact synthetic change for persistence checks; no real repair is asserted.',environment:base.environment,evidence:'Synthetic claim only. No real check execution is established.'});
const result=(fixId,outcome,environment)=>({fix_id:fixId,author_name:'Synthetic independent account',outcome,environment,notes:'Synthetic contributor-reported observation retained only in this isolated fixture.'});
let aliceToken,bobToken;
try {
 const [marker]=await admin`select marker from private.lifecycle_fixture_marker limit 1`;
 assert.equal(marker?.marker,fixture.fixture,'A sentinel absent; closed B fixture cannot authorize A');
 const [lock]=await admin`select pg_try_advisory_lock(731990314) as acquired`;
 assert.equal(lock.acquired,true,'Another local fixture executor owns the shared lease');
 const [version]=await admin`select current_setting('server_version') as version,current_setting('server_version_num')::int as number`;
 assert.equal(Math.floor(version.number/10000),fixture.postgresMajor);
 const users=await admin`select id from auth.users where id in (${fixture.aliceId}::uuid,${fixture.bobId}::uuid)`;
 assert.equal(users.length,2);
 assert.equal(await rowCount(),0,'Dedicated account state must be empty; runner will not erase an existing lease');
 authorized=true;
 const columns=await admin`select table_name from information_schema.columns where table_schema='public' and table_name in ('reports','fixes','verifications') and column_name='evidence_bundle' and data_type='jsonb'`;
 assert.equal(columns.length,3,'A storage columns absent');
 pass();
 console.log(`PHASE ${fixture.phase}; schema stage ${fixture.schemaStageId}; artifact ${fixture.artifactId}; migration SHA256 ${fixture.migrationSha256}`);
 if(fixture.phase==='restricted-app')console.log(`RESTRICTION migration SHA256 ${fixture.restrictionMigrationSha256}`);
 console.log(`POSTGRES ${version.version}; isolated local target, not hosted Data API or real OAuth`);
 console.log(`BACKEND ${fixture.backendMode}; platform-declared serving-process binding${fixture.backendMode==='supabase-data-api'?'; local Data API adapter, not hosted Supabase HTTP':''}`);
 console.log(`RUNTIME ${fixture.runtimeMode}${fixture.runtimeMode==='compiled'?`; build ${fixture.buildId}`:''}; owner process binding declared and typed database binding checked below`);
 console.log(`MCP MODE ${fixture.mcpMode}; ${fixture.mcpMode==='canonical-host-loopback'?'explicit canonical Host adapter to fixed local socket; not normal remote-client compatibility':'normal local request headers'}`);
 if(fixture.phase!=='additive-old-app')console.log(`ROLLBACK FLOOR ${fixture.minimumCompatibleApp}; old SELECT-star app is not a safe rollback after restrictive grants`);
 step='unique typed marker binds application reads to the migrated fixture before application writes';
 // This explicit normalized marker also works with the unchanged old application's schema.
 const markerBundle=evidence();
 markerBundle.check.instructions=markerBundle.check.instructions.replace(/^ +| +$/g,'');
 markerBundle.check.expected_result=markerBundle.check.expected_result.replace(/^ +| +$/g,'');
 markerBundle.versions=markerBundle.versions.map(version=>({...version,name:version.name.replace(/^ +| +$/g,''),version:version.version===null?null:version.version.replace(/^ +| +$/g,'')}));
 const [binding]=await admin`insert into public.reports(author_id,author_name,title,summary,body,environment,reproduction,category,evidence_bundle) values (${fixture.aliceId}::uuid,'Synthetic A binding',${`Synthetic A binding ${randomUUID()}`},${base.summary},${base.body},${base.environment},${base.reproduction},'Other',${admin.json(markerBundle)}::jsonb) returning id,title`;
 const response=await fetchLocal(new URL(`/api/v1/reports/${binding.id}`,fixture.baseUrl));
 assert.equal(response.status,200);
 const bindingRead=await response.json();
 assert.equal(bindingRead.report.id,binding.id);assert.equal(bindingRead.report.title,binding.title);
 assertBundle(bindingRead.report,fixture.phase==='additive-old-app'?undefined:markerBundle);publicOnly(bindingRead);
 pass();
 step='fresh synthetic account keys and official SDK local transports';
 const a=await alice.agentKeys.create.mutate({name:'Synthetic A Alice'}),b=await bob.agentKeys.create.mutate({name:'Synthetic A Bob'});
 aliceToken=a.token;bobToken=b.token;
 for(const token of [aliceToken,bobToken]){assert.match(token,/^to_[a-f0-9]{64}$/);secrets.push(token);}
 mcpAlice=await openMcp(aliceToken);mcpBob=await openMcp(bobToken);mcpPublic=await openMcp();pass();
 for(const writer of ['tRPC','form-service','REST','MCP']) {
  if(fixture.phase!=='additive-old-app') {
  step=`${writer} typed report/fix/worked/failed exact stored and public roundtrips`;
  const reportData={...base,title:`${base.title}: ${writer}`,evidence_bundle:evidence()};
  const reportExpected=schemaFor('report').parse(reportData).evidence_bundle;
  const reportSaved=await save(writer,'report',reportData);
  await stored('report',reportSaved.id,reportExpected,fixture.aliceId);
  const fixData={...change(reportSaved.id),evidence_bundle:{...evidence(),before_result:{output:' \t\n',exit_code:0}}};
  const fixExpected=schemaFor('fix').parse(fixData).evidence_bundle;
  const fixSaved=await save(writer,'fix',fixData);await stored('fix',fixSaved.id,fixExpected,fixture.aliceId);
  const observations=[];
  for(const outcome of ['worked','failed']) {
   const payload={...result(fixSaved.id,outcome,`${base.environment}; ${writer}; ${outcome}`),evidence_bundle:evidence({output:outcome==='worked'?' expected \n':' failed \t\n',exit_code:0})};
   const expected=schemaFor('verification').parse(payload).evidence_bundle;
   const saved=await save(writer,'verification',payload,'bob');await stored('verification',saved.id,expected,fixture.bobId);
   observations.push({id:saved.id,payload,expected});
  }
  for(const detail of await readAll(reportSaved.id)) {
   assertBundle(detail.report,reportExpected);
   const fix=detail.fixes.find(item=>item.id===fixSaved.id);assert.ok(fix);assertBundle(fix,fixExpected);
   assert.equal(fix.verifications.length,2);
   for(const observation of observations) {
    const actual=fix.verifications.find(item=>item.id===observation.id);assert.ok(actual);
    assert.equal(actual.outcome,observation.payload.outcome);assert.equal(actual.environment,observation.payload.environment);assert.equal(actual.notes,observation.payload.notes);assertBundle(actual,observation.expected);
   }
  }
  const ownerRead=await alice.reports.byId.query({id:reportSaved.id}),otherRead=await bob.reports.byId.query({id:reportSaved.id});
  assert.equal(ownerRead.fixes.find(item=>item.id===fixSaved.id).is_own_fix,true);
  assert.equal(otherRead.fixes.find(item=>item.id===fixSaved.id).is_own_fix,false);
  publicOnly(ownerRead);publicOnly(otherRead);pass();
  step=`${writer} self-result and duplicate denials preserve stored evidence`;
  await denied(writer,'verification',{...observations[0].payload,environment:`${base.environment}; ${writer}; self`},'alice',403);
  await denied(writer,'verification',observations[0].payload,'bob',409);
  if(writer==='form-service') {
   // Invalid required after-output is representable by the real progressive form.
   await denied(writer,'verification',{...observations[0].payload,evidence_bundle:{...evidence(),after_result:{output:''}}},'bob',400);
  } else await denied(writer,'verification',{...observations[0].payload,evidence_bundle:evidence()},'bob',400);
  pass();
  }
  step=`${writer} legacy optional absence survives storage and all read paths`;
  const legacy=await save(writer,'report',{...base,title:`Synthetic legacy ${writer}`});await stored('report',legacy.id,undefined,fixture.aliceId);
  const legacyFix=await save(writer,'fix',change(legacy.id));await stored('fix',legacyFix.id,undefined,fixture.aliceId);
  const legacyResult=await save(writer,'verification',result(legacyFix.id,'failed',`${base.environment}; legacy ${writer}`),'bob');await stored('verification',legacyResult.id,undefined,fixture.bobId);
  for(const detail of await readAll(legacy.id)) {
   assertBundle(detail.report,undefined);const fix=detail.fixes.find(item=>item.id===legacyFix.id);assert.ok(fix);assertBundle(fix,undefined);
   assert.equal(fix.verifications.length,1);assertBundle(fix.verifications[0],undefined);assert.equal(fix.verifications[0].outcome,'failed');
  }
  pass();
 }
 await stored('report',binding.id,markerBundle,fixture.aliceId);
 step='admin-stored typed marker remains intact after legacy and application reads';pass();
 if(fixture.phase!=='additive-old-app') {
 step='A schema and privacy changes preserve the existing shared account quota';
 const [{count}]=await admin`select ((select count(*) from public.reports where author_id=${fixture.aliceId}::uuid)+(select count(*) from public.fixes where author_id=${fixture.aliceId}::uuid)+(select count(*) from public.verifications where author_id=${fixture.aliceId}::uuid))::int as count`;
 assert.ok(count<99);
 for(let index=count;index<99;index++)await admin`insert into public.reports(author_id,author_name,title,summary,body,environment,reproduction,category) values (${fixture.aliceId}::uuid,'Synthetic A quota seed','Synthetic A quota preparation',${base.summary},${base.body},${base.environment},${base.reproduction},'Other')`;
 const hundredth=await save('tRPC','report',{...base,evidence_bundle:evidence()});await stored('report',hundredth.id,schemas.reportSchema.parse({...base,evidence_bundle:evidence()}).evidence_bundle,fixture.aliceId);
 await denied('REST','report',{...base,evidence_bundle:evidence()},'alice',429);
 await denied('MCP','report',{...base,evidence_bundle:evidence()},'alice',429);pass();
 }
 console.log(`PASS ${passed} A stages for ${fixture.phase} only; actual local app/SQL storage, synthetic identity only`);
 console.log('LIMIT form-service serializer forwards to live tRPC; no clicked browser/RSC POST, real OAuth, hosted Data API HTTP, production or adoption proof');
 console.log('LIMIT form-service forwards TRPCClientError rather than the server caller TRPCError; action error formatting is not certified');
 console.log('LIMIT stage3 raw identifier denial requires the separate platform SQL-role test; public projections alone do not prove it');
 console.log('LIMIT recreated typed markers prove within-stage retention only; cross-stage and rollback retention need a separate platform-owned persistent marker');
}catch(error) {
 console.error(`FAIL A stage: ${step}; raw exception and fixture contents withheld`);
 if(Number.isInteger(error?.actual)&&Number.isInteger(error?.expected))console.error(`FAIL numeric assertion: actual=${error.actual} expected=${error.expected}`);
 process.exitCode=1;
}finally {
 for(const instance of [mcpAlice,mcpBob,mcpPublic])if(instance)try{await instance.close();}catch{process.exitCode=1;console.error('FAIL local MCP transport cleanup');}
 if(authorized)try{await clean();assert.equal(await rowCount(),0);console.log('PASS isolated A cleanup: zero dedicated-account rows and keys');}catch{process.exitCode=1;console.error('FAIL isolated A cleanup; private local inspection required');}
 await admin.end({timeout:3});
}
