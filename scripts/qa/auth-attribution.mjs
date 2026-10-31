// Exact-source public attribution checks; no real identities, network or DB.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function load(path,mocks={}) {
 const loaded={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{Error,TextEncoder,module:loaded,exports:loaded.exports,require:name=>Object.hasOwn(mocks,name)?mocks[name]:require(name)});
 return loaded.exports;
}
const types=load('../../lib/types.ts');
const schemas=load('../../lib/validation.ts',{'./types':types});
const errors=load('../../server/services/errors.ts');
const identityId='10000000-0000-4000-8000-000000000001',id='20000000-0000-4000-8000-000000000001';
let mode='supabase-data-api',saved,compiled,calls=0,verified=0,dbIdentity;
const client={from:()=>({insert:data=>{calls++;saved=data;return {select:()=>({single:async()=>({data:{id},error:null})})};}})};
const {PgDialect}=require('drizzle-orm/pg-core');
const service=load('../../server/services/contributions.ts',{'server-only':{},'@/lib/supabase/server':{},'@/lib/validation':schemas,'@/server/db':{databaseMode:()=>mode,withDatabase:async(callback,identity)=>{dbIdentity=identity;return callback({execute:async statement=>{calls++;compiled=new PgDialect().sqlToQuery(statement);return [{id}];}});}},'./auth':{assertIdentity:identity=>{verified++;assert.equal(identity.user.id,identityId);}},'./errors':errors});
const report={title:'  Synthetic attribution finding  ',summary:'A synthetic attribution check only.',body:'The observed synthetic behavior has sufficient context.',environment:'Runtime unknown',reproduction:'Repeat the synthetic observation in an isolated test.',attempted_fixes:'',category:'Other',tags:[]};
const fix={report_id:id,body:'A proposed synthetic change with context.',environment:'Runtime unknown',evidence:'No real observation is claimed.'};
const verification={fix_id:id,outcome:'failed',environment:'Runtime unknown',notes:'The synthetic observation remains unsuccessful.'};
let cases=0;
for(mode of ['supabase-data-api','drizzle'])for(const [metadata,expected] of [[undefined,'Contributor'],[{},'Contributor'],[{display_name:''},'Contributor'],[{display_name:'   '},'Contributor'],[{display_name:42},'Contributor'],[{display_name:{name:'bad'}},'Contributor'],[{display_name:'  Public author  '},'Public author'],[{display_name:'x'.repeat(90)},'x'.repeat(80)]]) {
 const identity={client,user:{id:identityId,email:'never-publish-localpart@example.invalid',user_metadata:metadata}};
 for(const [method,payload] of [['createReport',report],['createFix',fix],['createVerification',verification]]) {
  await service[method](identity,{...payload,author_name:'spoof'.repeat(15000),author_id:'30000000-0000-4000-8000-000000000001'});
  if(mode==='supabase-data-api') {
   assert.equal(saved.author_name,expected);assert.equal(saved.author_id,identityId);assert.ok(!JSON.stringify(saved).includes('never-publish-localpart'));if(method==='createReport')assert.equal(saved.title,'Synthetic attribution finding');
  } else {
   assert.equal(dbIdentity,identity);const ownerIndex=method==='createReport'?0:1;assert.equal(compiled.params[ownerIndex],identityId);assert.equal(compiled.params[ownerIndex+1],expected);assert.ok(!JSON.stringify(compiled.params).includes('never-publish-localpart'));assert.ok(!compiled.params.some(value=>typeof value==='string'&&value.includes('spoof')));
  }
  cases++;
 }
}
let byteCases=0;
if(service.APPLICATION_CONTRIBUTION_MAX_BYTES===60000)for(mode of ['supabase-data-api','drizzle']) {
 const identity={client,user:{id:identityId,email:'never-publish-localpart@example.invalid',user_metadata:{}}};
 const before=calls;
 await assert.rejects(()=>service.createReport(identity,{...report,author_name:'caller',body:'界'.repeat(19000),reproduction:'界'.repeat(9000)}),error=>error.code==='PAYLOAD_TOO_LARGE');
 assert.equal(calls,before,'Normalized whole-byte overflow reached persistence');byteCases++;
}
assert.ok(verified>=cases,'Identity guard was skipped');
console.log(`PASS ${cases} attribution cases across both adapters: missing/blank/nonstring/explicit/capped metadata, payload spoof override, no email localpart; ${byteCases} existing A whole-byte guard checks (C has no A byte contract). Synthetic only.`);
