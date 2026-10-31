// Exact-source request graph and adapter query checks; no server, network or DB.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import { renderToStaticMarkup } from 'react-dom/server';
import { drizzle } from 'drizzle-orm/pg-proxy';
const require=createRequire(import.meta.url);
const base='790862f919cd853c09998217f2587a8d8a88fb94';
const root=new URL('../../',import.meta.url);
function loadText(source,mocks={}) {
 const loaded={exports:{}};
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(code,{Error,URLSearchParams,module:loaded,exports:loaded.exports,require:name=>Object.hasOwn(mocks,name)?mocks[name]:require(name)});
 return loaded.exports;
}
const read=path=>fs.readFileSync(new URL(path,root),'utf8');
const tables=loadText(read('server/db/schema.ts'));
const id='10000000-0000-4000-8000-000000000001';
let mode='supabase-data-api',rows=[{id}],failure=null,queries=[],guards=0;
function dataQuery() {
 const calls=[];queries.push(calls);
 const chain={};
 for(const method of ['select','eq','order','limit'])chain[method]=(...args)=>{calls.push([method,...args]);return chain;};
 chain.then=(yes,no)=>Promise.resolve({data:rows,error:failure}).then(yes,no);
 return chain;
}
const tx=drizzle(async(sql,params)=>{queries.push({sql,params});if(failure)throw failure;return {rows:rows.map(row=>[row.id])};});
const service=loadText(read('server/services/reports.ts'),{
 'server-only':{},'@/lib/supabase/server':{publicClient:()=>({from:name=>{assert.equal(name,'reports');return dataQuery();}})},
 '@/server/db/schema':tables,'@/server/db':{databaseMode:()=>mode,withDatabase:async callback=>{guards++;return callback(tx);}},'./auth':{},'./errors':{},
});
for(mode of ['supabase-data-api','drizzle']) {
 queries=[];guards=0;rows=[{id}];failure=null;
 assert.equal(await service.getExampleReportId(),id);
 assert.equal(queries.length,1,'Helper must make exactly one read and no feed/count');
 if(mode==='supabase-data-api') {
  assert.deepEqual(JSON.parse(JSON.stringify(queries[0])),[['select','id'],['eq','is_example',true],['order','created_at',{ascending:false}],['order','id',{ascending:true}],['limit',1]]);
  assert.equal(guards,0);
 } else {
  assert.equal(guards,1,'Drizzle lookup bypassed withDatabase');
  assert.match(queries[0].sql,/^select "id" from "reports" where "reports"\."is_example" = \$1 order by "reports"\."created_at" desc, "reports"\."id" asc limit \$2$/);
  assert.deepEqual(queries[0].params,[true,1]);
 }
 rows=[];assert.equal(await service.getExampleReportId(),null);
 failure=new Error('synthetic dependency failure');
 await assert.rejects(()=>service.getExampleReportId(),error=>error===failure||error.cause===failure);
 failure=null;
}
const types=loadText(read('lib/types.ts'));
const validation=loadText(read('lib/validation.ts'),{'./types':types});
const emptyDetail={report:{id,title:'Illustrative example',environment:'Unknown',reproduction:'Observe'},fixes:[]};
function home(source,state,legacy=false) {
 const events=[];
 const api={reports:{list:async filters=>{events.push(['list-start',filters]);await Promise.resolve();if(state.listError)throw new Error('synthetic list failure');events.push(['list-end']);return {reports:state.populated?[{id}]:[],count:state.count??0};},byId:async value=>{events.push(['detail',value]);if(state.detailError)throw new Error('synthetic detail failure');return emptyDetail;}}};
 const lookup=async()=>{events.push(['lookup']);if(state.lookupError)throw new Error('synthetic lookup failure');return legacy?(state.noExample?null:{id}):(state.noExample?null:id);};
 const component=loadText(source,{'next/link':{default:({href,children,...props})=>require('react').createElement('a',{href,...props},children)},'lucide-react':{Search:()=>null,ChevronRight:()=>null},'@/trpc/server':{api},'@/server/services/reports':{getExampleReportId:lookup,getExampleReport:lookup},'@/components/report-card':{ReportCard:()=>require('react').createElement('article',null,'Synthetic finding')},'@/lib/types':types,'@/lib/validation':validation}).default;
 return {events,run:async()=>renderToStaticMarkup(await component({searchParams:Promise.resolve(state.params??{})}))};
}
const current=read('app/page.tsx');
const original=execFileSync('git',['show',`${base}:app/page.tsx`],{cwd:root,encoding:'utf8'});
const cases=[
 {name:'default-empty',lookup:true},
 {name:'empty-page1000',params:{page:'1000'},lookup:true},
 {name:'whitespace-empty',params:{q:'   '},lookup:true},
 {name:'query',params:{q:'  error  '}},
 {name:'category',params:{category:types.categories[0]}},
 {name:'open-view',params:{view:'needs-investigation'}},
 {name:'worked-view',params:{view:'reproduced'}},
 {name:'examples',params:{examples:'1'}},
 {name:'populated',count:1,populated:true},
 {name:'stale-page',count:1,params:{page:'1000'}},
 {name:'filtered-stale-page',count:1,params:{q:'error',category:types.categories[0],view:'reproduced',examples:'1',page:'1000'}},
 {name:'missing-example',noExample:true,lookup:true},
 {name:'invalid-normalizes-empty',params:{q:['ignored'],category:'invalid',view:'invalid',examples:'no'},lookup:true},
];
for(const state of cases) {
 const next=home(current,state),prior=home(original,state,true);
 const markup=await next.run();
 assert.equal(markup,await prior.run(),`${state.name}: successful rendered behavior changed`);
 assert.deepEqual(next.events.map(event=>event[0]),['list-start','list-end',...(state.lookup?['lookup',...(!state.noExample?['detail']:[])]:[])],state.name);
 if(state.name==='query')assert.equal(next.events[0][1].q,'error');
 if(state.name==='stale-page')assert.match(markup,/View first page/);
 if(state.name==='filtered-stale-page')assert.ok(markup.includes('q=error&amp;category=')&&markup.includes('view=reproduced&amp;examples=1&amp;page=1'));
}
for(const state of [{params:{q:'error'},lookupError:true},{count:1,populated:true,lookupError:true}]) {
 const next=home(current,state);
 await next.run();
 assert.deepEqual(next.events.map(event=>event[0]),['list-start','list-end'],'Unused lookup failure affected a non-example route');
}
for(const [flag,expected,events] of [
 ['listError','Could not load findings. Please try again.',['list-start']],
 ['lookupError','Could not load findings. Please try again.',['list-start','list-end','lookup']],
 ['detailError','synthetic detail failure',['list-start','list-end','lookup','detail']],
]) {
 const next=home(current,{[flag]:true});
 await assert.rejects(next.run,error=>error.message===expected);
 assert.deepEqual(next.events.map(event=>event[0]),events);
}
console.log(`PASS both adapters: one id-only bounded ordered query, empty/error propagation and Drizzle guard boundary; ${cases.length} Home graph/identical-markup cases plus 2 unused-lookup failure skips and 3 failure paths. Synthetic source checks only; no HTTP status, actual DB, browser or timing claim.`);
