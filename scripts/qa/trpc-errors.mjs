// Synthetic adapter regression: no database, credentials, network, or listening server.
// Run: node scripts/qa/trpc-errors.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const {DrizzleQueryError}=require('drizzle-orm');
const {z}=require('zod');
const requestId='10000000-0000-4000-8000-000000000001';
function load(relative,mocks={}) {
 const source=fs.readFileSync(new URL(relative,import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const loaded={exports:{}};
 vm.runInNewContext(code,{Error,module:loaded,exports:loaded.exports,require:name=>Object.hasOwn(mocks,name)?mocks[name]:require(name)});
 return loaded.exports;
}
const {ServiceError}=load('../../server/services/errors.ts');
const privateMarker='synthetic-private-query-parameter';
const privateSql='select synthetic_private_column from synthetic_private_table';
const rawError=()=>new DrizzleQueryError(privateSql,[privateMarker],new Error('synthetic backend failure'));
const priorMode=process.env.NODE_ENV;
try {
 for(const mode of ['development','production']) {
  process.env.NODE_ENV=mode;
  let contextFails=false;
  const setupFailures=[];
  const observation={requestTelemetryContext:()=>({synthetic:true}),startOperation:()=>({requestId,fail:status=>setupFailures.push(status),complete:()=>{},finish:response=>response})};
  const trpc=load('../../server/api/trpc.ts',{
   'server-only':{},'@/lib/observability':observation,
   '@/lib/supabase/server':{serverClient:async()=>{if(contextFails)throw rawError();return {}; }},
   '@/server/services/auth':{AuthenticationError:class extends Error {},requireIdentity:async()=>({})},
   '@/server/services/errors':{ServiceError},
  });
  const router=trpc.createTRPCRouter({
   failure:trpc.publicProcedure.query(()=>{throw rawError();}),
   denied:trpc.publicProcedure.query(()=>{throw new ServiceError('FORBIDDEN','This contribution is not allowed.');}),
   invalid:trpc.publicProcedure.input(z.object({q:z.string().max(3)})).query(()=>true),
  });
  const route=load('../../app/api/trpc/[trpc]/route.ts',{
   '@/server/api/root':{appRouter:router},'@/server/api/trpc':trpc,'@/lib/observability':observation,
  });
  async function request(path) {
   const response=await route.GET(new Request(`https://synthetic.invalid/api/trpc/${path}`));
   const text=await response.text();
   assert.ok(!text.includes(privateMarker)&&!text.includes(privateSql),`${mode}: private driver message leaked`);
   assert.ok(!text.includes('"stack"'),`${mode}: stack leaked`);
   assert.equal(response.headers.get('x-request-id'),requestId);
   assert.equal(response.headers.get('cache-control'),'no-store');
   return {response,error:JSON.parse(text).error};
  }
  const failure=await request('failure');
  assert.equal(failure.response.status,500);
  assert.equal(failure.error.data.code,'INTERNAL_SERVER_ERROR');
  assert.equal(failure.error.message,'Could not complete the request. Please try again.');
  const denied=await request('denied');
  assert.equal(denied.response.status,403);
  assert.equal(denied.error.message,'This contribution is not allowed.');
  const invalid=await request(`invalid?input=${encodeURIComponent(JSON.stringify({q:'too long'}))}`);
  assert.equal(invalid.response.status,400);
  assert.equal(invalid.error.data.code,'BAD_REQUEST');
  assert.match(invalid.error.message,/Too big|maximum|3/);
  contextFails=true;
  const context=await request('failure');
  assert.equal(context.response.status,500);
  assert.equal(context.error.message,'Could not complete the request. Please try again.');
  assert.ok(setupFailures.includes(500));
 }
}finally {
 if(priorMode===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=priorMode;
}
console.log('PASS development/production driver and context error redaction, safe service/validation messages, status/header compatibility');
