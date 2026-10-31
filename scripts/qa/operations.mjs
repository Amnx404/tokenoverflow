// Synthetic metadata only; no network, credentials, user data or listening server.
// Run: node scripts/qa/operations.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const testModule={exports:{}};
const source=fs.readFileSync(new URL('../../lib/observability.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(code,{module:testModule,exports:testModule.exports,require:name=>name==='server-only'?{}:require(name),performance,console});
const {startOperation}=testModule.exports;
const lines=[];
const original=console.error;
console.error=line=>lines.push(line);
try {
 const secret='synthetic-secret@example.invalid?token=synthetic-token';
 const op=startOperation('/api/v1/reports','search_reports',secret);
 const response=op.finish(Response.json({error:secret},{status:503}));
 op.fail(500,'INTERNAL_ERROR');
 assert.equal(lines.length,1,'An operation should emit one failure event');
 const event=JSON.parse(lines[0]);
 assert.deepEqual(Object.keys(event).sort(),['schema_version','event','request_id','route','operation','status','duration_ms','error_code'].sort());
 assert.match(event.request_id,/^[a-f0-9-]{36}$/);
 assert.equal(response.headers.get('x-request-id'),event.request_id);
 assert.equal(event.error_code,'DEPENDENCY_UNAVAILABLE');
 assert.equal(event.status,503);
 assert.ok(Number.isInteger(event.duration_ms)&&event.duration_ms>=0);
 assert.ok(!lines[0].includes(secret));
 assert.ok(!lines[0].includes('token=')&&!lines[0].includes('@'));
 startOperation('/api/v1/reports','search_reports').finish(Response.json({reports:[]}));
 assert.equal(lines.length,1,'Successful requests are not logged');
 const correlated=startOperation('/api/mcp','get_report',event.request_id);
 correlated.fail(404);
 assert.equal(JSON.parse(lines[1]).request_id,event.request_id);
 assert.equal(JSON.parse(lines[1]).error_code,'NOT_FOUND');
 const healthModule={exports:{}};
 const healthSource=fs.readFileSync(new URL('../../app/api/health/route.ts',import.meta.url),'utf8');
 const healthCode=ts.transpileModule(healthSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(healthCode,{module:healthModule,exports:healthModule.exports,setTimeout,clearTimeout,Promise,require:name=>{
  if(name==='@/lib/api')return {apiJson:(data,status)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}})};
  if(name==='@/lib/observability')return {startOperation};
  if(name==='@/server/services/health')return {backendHealthy:async()=>false,hasPublicServiceConfiguration:()=>false};
  throw new Error('Unexpected health import');
 }});
 const degraded=await healthModule.exports.GET();
 assert.equal(degraded.status,503);
 assert.deepEqual(await degraded.json(),{status:'degraded'});
 assert.equal(degraded.headers.get('cache-control'),'no-store');
 assert.equal(JSON.parse(lines.at(-1)).error_code,'CONFIGURATION_MISSING');
 assert.equal(degraded.headers.get('x-request-id'),JSON.parse(lines.at(-1)).request_id);
}finally{console.error=original;}
console.log('PASS failure event allowlist, secret exclusion, correlation, deduplication, success silence and degraded health contract');
