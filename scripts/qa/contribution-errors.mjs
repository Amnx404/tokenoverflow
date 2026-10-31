// Exact-source B error-classification regression. No DB, secrets, network or server.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function load(path,mocks={}) {
 const loaded={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{Error,module:loaded,exports:loaded.exports,require:name=>Object.hasOwn(mocks,name)?mocks[name]:require(name)});
 return loaded.exports;
}
const {databaseError,ServiceError}=load('../../server/services/errors.ts');
const known={code:'P0001',message:'Verification needs an independent contributor'};
for(const error of [known,{cause:known}])assert.throws(()=>databaseError(error),value=>value instanceof ServiceError&&value.code==='FORBIDDEN'&&!value.message.includes('P0001'));
for(const error of [{code:'P0001',message:'synthetic private unexpected failure'},{code:'P0001',message:'Verification needs an independent contributor extra'},{code:'OTHER',message:known.message}])assert.throws(()=>databaseError(error),value=>value===error);
const {fetchRequestHandler}=require('@trpc/server/adapters/fetch');
const trpc=load('../../server/api/trpc.ts',{'server-only':{},'@/lib/observability':{startOperation:()=>({fail:()=>{},complete:()=>{}})},'@/lib/supabase/server':{},'@/server/services/auth':{},'@/server/services/errors':{ServiceError}});
const router=trpc.createTRPCRouter({denied:trpc.publicProcedure.query(()=>databaseError(known)),unknown:trpc.publicProcedure.query(()=>databaseError({code:'P0001',message:'synthetic private unexpected failure'}))});
for(const [path,status] of [['denied',403],['unknown',500]]) {
 const response=await fetchRequestHandler({endpoint:'/api/trpc',req:new Request(`https://synthetic.invalid/api/trpc/${path}`),router,createContext:async()=>({})});
 assert.equal(response.status,status);
 const body=await response.text();
 assert.ok(!body.includes('synthetic private unexpected failure'));
 assert.ok(!body.includes('"stack"'));
}
console.log('PASS exact P0001 independence denial maps403, nested driver cause maps403, unknown/lookalike codes remain redacted500 (synthetic)');
