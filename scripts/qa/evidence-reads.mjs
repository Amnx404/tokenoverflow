// Exact-source privacy adapter/ownership checks. No DB, credentials, network or server.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function load(path,mocks={}) {
 const loaded={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{Error,Set,TextEncoder,Response,Request,module:loaded,exports:loaded.exports,require:name=>Object.hasOwn(mocks,name)?mocks[name]:require(name)});
 return loaded.exports;
}
const types=load('../../lib/types.ts');
const schemas=load('../../lib/validation.ts',{'./types':types});
const tables=load('../../server/db/schema.ts');
const auth=load('../../server/services/auth.ts',{'server-only':{}});
const errors=load('../../server/services/errors.ts');
const id='10000000-0000-4000-8000-000000000001';
const fixId='20000000-0000-4000-8000-000000000001';
const addedId='20000000-0000-4000-8000-000000000002';
const resultId='30000000-0000-4000-8000-000000000001';
const privateId='40000000-0000-4000-8000-000000000001';
const bundle={contract_version:1,check:{kind:'steps',instructions:'Observe',expected_result:'expected'},before_result:{output:'',exit_code:0},after_result:null,versions:[{kind:'runtime',name:'Node.js',version:null}]};
const feed={id,author_name:'Contributor',title:'Synthetic explicit public detail',summary:'Synthetic public summary only.',environment:'Runtime unknown',category:'Other',tags:[],is_example:false,created_at:'2026-10-30T00:00:00Z',fix_count:1,worked_count:0,failed_count:1,author_id:privateId};
const report={...feed,body:'Public problem context',reproduction:'Public reproduction',attempted_fixes:'Unknown',evidence_bundle:bundle};
const result={id:resultId,fix_id:fixId,author_name:'Independent',outcome:'failed',environment:'Runtime unknown',notes:'The observation failed.',created_at:feed.created_at,evidence_bundle:{...bundle,after_result:{output:'failed'}},author_id:privateId};
const fix={id:fixId,report_id:id,author_name:'Contributor',body:'Proposed exact change',environment:'Runtime unknown',evidence:'Rerun unrecorded',created_at:feed.created_at,evidence_bundle:bundle,author_id:privateId};
const records={reports:[report],report_feed:[feed],fixes:[fix],verifications:[result]};
const selected=[];
const pick=(value,keys)=>Object.fromEntries(keys.map(key=>[key,value[key]]));
function selectSafe(name,fields) {
 assert.ok(fields&&!fields.includes('*')&&!fields.includes('author_id'),'Data API read requested a private/all column');
 selected.push({adapter:'data-api',name,fields});
 const scalar=fields.replace(/,verifications\(.*\)$/,'').split(',');
 return records[name].map(value=>({...pick(value,scalar),...(name==='fixes'?{verifications:records.verifications.map(row=>pick(row,['id','fix_id','author_name','outcome','environment','notes','created_at','evidence_bundle']))}:{})}));
}
function dataQuery(name,fields) {
 const rows=selectSafe(name,fields);
 const chain={eq:()=>chain,gt:()=>chain,order:()=>chain,range:async()=>({data:rows,error:null,count:rows.length}),maybeSingle:async()=>({data:rows[0]??null,error:null}),then:(yes,no)=>Promise.resolve({data:rows,error:null,count:rows.length}).then(yes,no)};
 return chain;
}
const anonymousClient={from:name=>({select:fields=>dataQuery(name,fields)}),rpc:(name)=>{assert.equal(name,'search_reports');return {select:fields=>dataQuery('report_feed',fields)};}};
let mode='supabase-data-api';
let ownershipCalls=0;
let userReads=0;
let lastIdentity;
let flags=[{id:fixId,is_own_fix:true,author_id:privateId},{id:addedId,is_own_fix:true}];
const identityClient={auth:{getUser:async()=>{userReads++;return {data:{user:{id:privateId}},error:null};}},rpc:async(name,args)=>{ownershipCalls++;assert.equal(name,'fix_ownership');assert.deepEqual(Object.keys(args),['p_report_id']);assert.equal(args.p_report_id,id);return {data:flags,error:null};}};
function tableName(table) {return Object.entries(tables).find(([,value])=>value===table)?.[0]==='reportFeed'?'report_feed':Object.entries(tables).find(([,value])=>value===table)?.[0];}
const tx={select:fields=>{
 assert.ok(fields,'Drizzle used SELECT all');
 assert.ok(!Object.hasOwn(fields,'author_id'),'Drizzle requested raw owner');
 let rows;
 const chain={from:table=>{const name=tableName(table);selected.push({adapter:'drizzle',name,fields:Object.keys(fields)});rows=Object.hasOwn(fields,'value')?[{value:records[name].length}]:records[name].map(row=>pick(row,Object.keys(fields)));return chain;},where:()=>chain,orderBy:()=>chain,offset:()=>chain,limit:()=>chain,then:(yes,no)=>Promise.resolve(rows).then(yes,no)};
 return chain;
},execute:async statement=>{
 ownershipCalls++;
 const {PgDialect}=require('drizzle-orm/pg-core');
 const compiled=new PgDialect().sqlToQuery(statement);
 assert.match(compiled.sql,/select id,is_own_fix from public\.fix_ownership/);
 assert.deepEqual(compiled.params,[id]);
 return flags;
}};
const service=load('../../server/services/reports.ts',{'server-only':{},'@/lib/supabase/server':{publicClient:()=>anonymousClient},'@/server/db/schema':tables,'@/server/db':{databaseMode:()=>mode,withDatabase:async(callback,identity)=>{lastIdentity=identity;return callback(tx);}},'./auth':auth,'./errors':errors});
function noPrivate(value) {
 if(value&&typeof value==='object')for(const [key,item] of Object.entries(value)){assert.ok(!['author_id','user_id','token_hash'].includes(key));noPrivate(item);}
}
for(mode of ['supabase-data-api','drizzle']) {
 const detail=await service.getReport(id);
 noPrivate(detail);
 assert.equal(detail.report.id,id);
 assert.equal(detail.fixes[0].verifications[0].outcome,'failed');
 assert.equal(detail.report.evidence_bundle.before_result.exit_code,0);
 assert.equal((await service.listReports()).reports.length,1);
 assert.equal((await service.listReports({q:'synthetic'})).reports.length,1);
 const identity=await auth.requireIdentity(identityClient);
 const before=ownershipCalls;
 const own=await service.getFixOwnership(identity,id);
 assert.equal(ownershipCalls,before+1,'Ownership should be one batched query');
 assert.equal(own.has(fixId),true);
 if(mode==='drizzle')assert.equal(lastIdentity,identity,'Ownership query lost fresh identity');
 await assert.rejects(()=>service.getFixOwnership({user:{id:privateId},client:identityClient},id),error=>error instanceof auth.AuthenticationError);
}
const api=load('../../lib/api.ts',{'@/server/services/contributions':{},'@/lib/observability':{},'@/server/services/errors':errors,'@/lib/validation':schemas});
const trpc=load('../../server/api/trpc.ts',{'server-only':{},'@/lib/observability':{startOperation:()=>({fail:()=>{},complete:()=>{}})},'@/lib/supabase/server':{},'@/server/services/auth':auth,'@/server/services/errors':errors});
const root=load('../../server/api/root.ts',{'@/lib/api':api,'@/lib/validation':schemas,'@/server/services/reports':service,'@/server/services/auth':auth,'@/server/services/contributions':{},'@/server/services/agent-keys':{},'./trpc':trpc});
mode='supabase-data-api';
const caller=client=>root.createCaller({client});
let before=ownershipCalls;
let freshBefore=userReads;
const owned=await caller(identityClient).reports.byId({id});
assert.equal(userReads,freshBefore+1,'Ownership must resolve fresh getUser');
assert.equal(ownershipCalls,before+1);
assert.equal(owned.fixes.length,1,'Ownership lookup injected a concurrently added fix');
assert.equal(owned.fixes[0].is_own_fix,true);noPrivate(owned);
flags=[{id:fixId,is_own_fix:false}];
assert.equal((await caller(identityClient).reports.byId({id})).fixes[0].is_own_fix,false);
before=ownershipCalls;
const anonymous={auth:{getUser:async()=>({data:{user:null},error:null})}};
assert.equal((await caller(anonymous).reports.byId({id})).fixes[0].is_own_fix,false);
assert.equal(ownershipCalls,before,'Anonymous detail called authenticated helper');
flags=[{id:fixId,is_own_fix:'true'}];
await assert.rejects(()=>caller(identityClient).reports.byId({id}),error=>error.code==='INTERNAL_SERVER_ERROR');
console.log('PASS explicit evidence-only Data API/Drizzle read columns, full failed/unknown bundles, fresh-identity report-scoped single ownership lookup, anonymous no-lookup, race-safe mapping and malformed-response failure (synthetic only)');
