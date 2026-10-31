// Exact-source synthetic service checks: no database, credentials, network or server.
// Run: node scripts/qa/evidence-services.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function load(path,mocks={}) {
 const code=ts.transpileModule(fs.readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const loaded={exports:{}};
 vm.runInNewContext(code,{Error,TextEncoder,FormData,Response,Request,process,module:loaded,exports:loaded.exports,require:name=>Object.hasOwn(mocks,name)?mocks[name]:require(name)});
 return loaded.exports;
}
const types=load('../../lib/types.ts');
const schemas=load('../../lib/validation.ts',{'./types':types});
const errors=load('../../server/services/errors.ts');
const bundle={contract_version:1,check:{kind:'command',instructions:'  node example.mjs  ',expected_result:' expected '},before_result:{output:'',exit_code:0},after_result:null,versions:[{kind:'runtime',name:' Node.js ',version:null}]};
const report={author_name:'Example',title:'Structured failing example',summary:'A sanitized failing numeric example.',body:'The numeric conversion example fails.',environment:'Node.js unknown',reproduction:'Run the sanitized numeric conversion example.',attempted_fixes:'',category:'Other',tags:[]};
const fix={report_id:'11111111-1111-4111-8111-111111111111',author_name:'Example',body:'Use Number(input) for numeric conversion.',environment:'Node.js unknown',evidence:'No rerun has been recorded yet.'};
const result={fix_id:'22222222-2222-4222-8222-222222222222',author_name:'Retester',outcome:'failed',environment:'Node.js unknown',notes:'The same check still prints NaN.'};
for(const [schema,payload] of [[schemas.reportSchema,report],[schemas.fixSchema,fix],[schemas.verificationSchema,result]]) assert.equal(schema.safeParse(payload).success,true);
const normalized=schemas.reportSchema.parse({...report,evidence_bundle:bundle}).evidence_bundle;
assert.equal(normalized.check.instructions,'node example.mjs');
assert.equal(normalized.versions[0].name,'Node.js');
assert.equal(normalized.versions[0].version,null);
assert.equal(normalized.before_result.exit_code,0);
const invalid=[];
invalid.push({...bundle,contract_version:2});
invalid.push({...bundle,private_key:'synthetic'});
invalid.push({...bundle,check:{...bundle.check,private_key:'synthetic'}});
invalid.push({...bundle,before_result:{output:''}});
invalid.push({...bundle,before_result:{output:'text',private_key:'synthetic'}});
invalid.push({...bundle,versions:[...bundle.versions,{kind:'runtime',name:'Node.js',version:'24'}]});
invalid.push({...bundle,versions:[{kind:'runtime',name:'Node.js',version:''}]});
invalid.push({...bundle,versions:[{kind:'runtime',name:'Node.js',version:null,private_key:'synthetic'}]});
for(const output of ['\u0000','\uD800','\uDC00','x\uD800x']) invalid.push({...bundle,before_result:{output}});
for(const value of invalid) assert.equal(schemas.reportSchema.safeParse({...report,evidence_bundle:value}).success,false);
assert.equal(schemas.reportSchema.safeParse({...report,evidence_bundle:null}).success,false);
assert.equal(schemas.reportSchema.safeParse({...report,evidence_bundle:{...bundle,after_result:{output:'after'}}}).success,false);
assert.equal(schemas.verificationSchema.safeParse({...result,evidence_bundle:bundle}).success,false);
assert.equal(schemas.fixSchema.safeParse({...fix,evidence_bundle:bundle}).success,true);
for(const output of ['\\u0000 \\uD800','  \n\t','😀'.repeat(6000)]) assert.equal(schemas.fixSchema.safeParse({...fix,evidence_bundle:{...bundle,before_result:{output}}}).success,true);
assert.equal(schemas.fixSchema.safeParse({...fix,evidence_bundle:{...bundle,before_result:{output:'😀'.repeat(6001)}}}).success,false);
const whitespace=schemas.fixSchema.parse({...fix,evidence_bundle:{...bundle,check:{...bundle.check,instructions:' \tnode example.mjs\n '},before_result:{output:' \n'},versions:[{kind:'runtime',name:' Node.js ',version:null},{kind:'runtime',name:'node.js',version:' unknown '}]}}).evidence_bundle;
assert.equal(whitespace.check.instructions,'\tnode example.mjs\n');
assert.equal(whitespace.before_result.output,' \n');
assert.equal(whitespace.versions[1].version,'unknown');
let mode='supabase-data-api';
let calls=0;
let saved;
let query;
const id='33333333-3333-4333-8333-333333333333';
const client={from:()=>{calls++;return {insert:value=>{saved=value;return {select:()=>({single:async()=>({data:{id},error:null})})};}};}};
const service=load('../../server/services/contributions.ts',{
 'server-only':{},'@/lib/supabase/server':{publicClient:()=>({rpc:async(_name,args)=>{calls++;saved=args.p_data;return {data:id,error:null};}})},
 '@/lib/validation':schemas,'@/server/db':{databaseMode:()=>mode,withDatabase:async callback=>{calls++;return callback({execute:async statement=>{query=statement;return [{id}];}});}},
 './auth':{assertIdentity:()=>{}},'./errors':errors,
});
const identity={client,user:{id:'44444444-4444-4444-8444-444444444444',user_metadata:{display_name:'Identity author'},email:'unused@example.invalid'}};
const token=`to_${'a'.repeat(64)}`;
for(const [kind,payload] of [['report',report],['fix',fix],['verification',result]]) {
 const evidence_bundle={...bundle,after_result:kind==='verification'?{output:'NaN',exit_code:0}:null};
 const create=kind==='report'?service.createReport:kind==='fix'?service.createFix:service.createVerification;
 await create(identity,{...payload,evidence_bundle});
 assert.equal(saved.author_name,'Identity author');
 assert.equal(saved.evidence_bundle.check.instructions,'node example.mjs');
 await service.publishAgentContribution(token,kind,{...payload,evidence_bundle});
 assert.equal(saved.evidence_bundle.before_result.exit_code,0);
 assert.equal(saved.evidence_bundle.versions[0].version,null);
}
const hugeBundle={...bundle,before_result:{output:'😀'.repeat(4000)}};
const hugeReport={...report,body:'界'.repeat(19000),reproduction:'界'.repeat(9000)};
for(const payload of [{...report,evidence_bundle:hugeBundle},hugeReport]) {
 for(const run of [()=>service.createReport(identity,payload),()=>service.publishAgentContribution(token,'report',payload)]) {
  const before=calls;
  await assert.rejects(run,error=>error instanceof errors.ServiceError&&error.code==='PAYLOAD_TOO_LARGE');
  assert.equal(calls,before,'oversize reached persistence');
 }
}
const before=calls;
await assert.rejects(()=>service.createReport(identity,{...report,evidence_bundle:null}));
assert.equal(calls,before);
mode='drizzle';
const {PgDialect}=require('drizzle-orm/pg-core');
for(const [kind,payload] of [['report',report],['fix',fix],['verification',result]]) {
 const create=kind==='report'?service.createReport:kind==='fix'?service.createFix:service.createVerification;
 for(const supplied of [false,true]) {
  const evidence_bundle={...bundle,after_result:kind==='verification'?{output:'NaN',exit_code:0}:null};
  await create(identity,{...payload,...(supplied?{evidence_bundle}:{})});
  const compiled=new PgDialect().sqlToQuery(query);
  assert.equal(compiled.sql.includes('evidence_bundle'),supplied);
  if(supplied) assert.ok(compiled.params.some(value=>typeof value==='string'&&value.includes('"contract_version":1')));
 }
}
const trpc=load('../../server/api/trpc.ts',{'server-only':{},'@/lib/observability':{startOperation:()=>({fail:()=>{},complete:()=>{}})},'@/lib/supabase/server':{},'@/server/services/auth':{},'@/server/services/errors':errors});
const router=trpc.createTRPCRouter({large:trpc.publicProcedure.query(()=>{throw new errors.ServiceError('PAYLOAD_TOO_LARGE','Contribution too large.');})});
const {fetchRequestHandler}=require('@trpc/server/adapters/fetch');
const response=await fetchRequestHandler({endpoint:'/api/trpc',req:new Request('https://synthetic.invalid/api/trpc/large'),router,createContext:async()=>({})});
assert.equal(response.status,413);
assert.equal((await response.json()).error.data.code,'PAYLOAD_TOO_LARGE');
// Exercise actual server-action serializer through its mutation boundary.
let actionInput;
const capture=async value=>{actionInput=value;return {id};};
const actions=load('../../app/actions.ts',{'@/lib/telemetry-server':{startAuthTelemetry:async()=>({finish:()=>{}})},'@/lib/supabase/server':{},'@/lib/auth-config':{},'@/lib/validation':schemas,'@/trpc/server':{api:{contributions:{fix:capture,verify:capture,report:capture}}},'next/cache':{revalidatePath:()=>{}},'next/navigation':{redirect:()=>{throw new Error('synthetic report redirect');}}});
const form=new FormData();
for(const [key,value] of Object.entries({...fix,kind:'fix',evidence_enabled:'1',evidence_check_kind:'command',evidence_check_instructions:'node example.mjs',evidence_check_expected_result:'expected',evidence_before_output:'',evidence_before_exit_code:'0',evidence_version_count:'1','evidence_versions.0.kind':'runtime','evidence_versions.0.name':'Node.js','evidence_versions.0.unknown':'1'}))form.set(key,value);
assert.ok((await actions.contribute({},form)).message);
assert.equal(actionInput.evidence_bundle.after_result,null);
assert.equal(actionInput.evidence_bundle.before_result.exit_code,0);
assert.equal(actionInput.evidence_bundle.versions[0].version,null);
form.set('evidence_before_exit_code','  \t');
const previousInput=actionInput;
assert.ok((await actions.contribute({},form)).error);
assert.equal(actionInput,previousInput,'Whitespace-only exit code must not become invented zero');
form.set('evidence_before_output','recorded output');
form.set('evidence_before_exit_code','');
await actions.contribute({},form);
assert.equal(Object.hasOwn(actionInput.evidence_bundle.before_result,'exit_code'),false);
form.set('evidence_after_recorded','1');
form.set('evidence_after_output','after');
form.set('evidence_after_exit_code','0');
await actions.contribute({},form);
assert.equal(actionInput.evidence_bundle.after_result.exit_code,0);
form.set('kind','verification');
for(const [key,value] of Object.entries(result))form.set(key,value);
form.delete('evidence_after_recorded');
await actions.contribute({},form);
assert.equal(actionInput.evidence_bundle.after_result.output,'after');
form.set('kind','report');
for(const [key,value] of Object.entries(report))form.set(key,Array.isArray(value)?value.join(','):value);
await assert.rejects(()=>actions.contribute({},form),/synthetic report redirect/);
assert.equal(actionInput.evidence_bundle.after_result,null);
form.set('kind','fix');
for(const [key,value] of Object.entries(fix))form.set(key,value);
form.delete('evidence_enabled');
await actions.contribute({},form);
assert.equal(Object.hasOwn(actionInput,'evidence_bundle'),false);
console.log('PASS strict Unicode/record contracts, legacy absence, identity/agent pre-DB UTF-8 limits, explicit SQL forwarding, typed tRPC 413, and server-action serialization (synthetic; no stored roundtrip)');
