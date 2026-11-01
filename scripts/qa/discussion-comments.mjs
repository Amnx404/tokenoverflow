// Discussion-only actual-source checks. Controlled SDK/adapter boundaries; no DB/Auth/network/browser.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const root=new URL('../../',import.meta.url);
const read=name=>fs.readFileSync(new URL(name,root),'utf8');
const norm=value=>JSON.parse(JSON.stringify(value));
const env={env:{NEXT_PUBLIC_SUPABASE_URL:'https://discussion-fixture.invalid'}};
function load(name,mocks={}){const loaded={exports:{}};const code=ts.transpileModule(read(name),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(code,{Error,Set,WeakSet,Buffer,URL,Date,TextEncoder,FormData,Request,Response,process:env,module:loaded,exports:loaded.exports,require:id=>Object.hasOwn(mocks,id)?mocks[id]:id==='@/lib/observability'?{startOperation:()=>({finish:response=>response}),requestTelemetryContext:()=>({synthetic:true})}:require(id)});return loaded.exports;}
const validation=load('lib/discussion-validation.ts');
const errors=load('server/services/discussion-errors.ts');
// Narrow actual-action parser regression mode; no actor/writer/provider boundary may be reached.
if(process.argv.includes('--unknown-field')){
 const calls={client:0,actor:0,writer:0,cache:0};
 const denied=name=>()=>{calls[name]++;throw new Error('controlled boundary denied');};
 const action=load('app/discussion-actions.ts',{
  '@/lib/discussion-validation':validation,'@/server/services/discussion-errors':errors,
  '@/lib/supabase/server':{serverClient:denied('client')},
  '@/server/services/discussion-actor':{requireWebDiscussionActor:denied('actor')},
  '@/server/services/discussions':{appendDiscussionComment:denied('writer'),redactDiscussionComment:denied('writer')},
  'next/cache':{revalidatePath:denied('cache')}
 });
 const results=[];
 for(const [kind,value]of [['string','synthetic unknown'],['File',new Blob(['synthetic unknown'])]]){
  const form=new FormData();form.set('report_id','20000000-0000-4000-8000-000000000001');
  form.set('parent_id','');form.set('request_id','40000000-0000-4000-8000-000000000001');form.set('body','Exact synthetic body');
  if(kind==='File')form.set('__proto__',value,'synthetic.txt');else form.set('__proto__',value);
  const state=await action.appendDiscussion({},form);
  results.push({kind,status:state.error?.status,receiptPresent:Object.hasOwn(state,'receipt')});
 }
 console.log(JSON.stringify({mode:'actual-action-unknown-field',results,boundaryCalls:calls}));
 assert.deepEqual(results,[{kind:'string',status:400,receiptPresent:false},{kind:'File',status:400,receiptPresent:false}]);
 assert.deepEqual(calls,{client:0,actor:0,writer:0,cache:0});
 console.log('PASS actual action __proto__ string/File: strict400; zero auth/writer/cache boundary calls. Controlled mocks only.');
 process.exit(0);
}

const auth=load('server/services/auth.ts',{'server-only':{}});
const actors=load('server/services/discussion-actor.ts',{'server-only':{},'./auth':auth,'./discussion-errors':errors});
const userId='10000000-0000-4000-8000-000000000001',reportId='20000000-0000-4000-8000-000000000001',otherReport='20000000-0000-4000-8000-000000000002',id='30000000-0000-4000-8000-000000000001',childId='30000000-0000-4000-8000-000000000002',requestId='40000000-0000-4000-8000-000000000001';
const stamp='2026-10-31T00:00:00.123456Z';
const user={id:userId,is_anonymous:false,user_metadata:{display_name:'Synthetic'},email:'never-public@example.invalid'};
const claims={sub:userId,iss:'https://discussion-fixture.invalid/auth/v1',aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600,session_id:requestId,is_anonymous:false};
let userReads=0,claimReads=0,rpcCalls=[],sqlCalls=[],response,error=null,lastIdentity,mode='supabase-data-api';
let client;
function sdk(options={}){return {auth:{getUser:async()=>{userReads++;if(options.userThrows)throw new Error('private SDK detail');return {data:{user:Object.hasOwn(options,'user')?options.user:user},error:options.userError??null};},getClaims:async()=>{claimReads++;if(options.claimThrows)throw new Error('private SDK detail');return {data:{claims:Object.hasOwn(options,'claims')?options.claims:claims},error:options.claimError??null};}},rpc:async(name,args)=>{rpcCalls.push({name,args:norm(args)});return {data:response,error};}};}
const common={'server-only':{},'@/lib/discussion-validation':validation,'./discussion-errors':errors,'./discussion-actor':actors};
const service=load('server/services/discussions.ts',{...common,'@/lib/supabase/server':{publicClient:()=>client},'@/server/db':{databaseMode:()=>mode,withDatabase:async(callback,identity)=>{lastIdentity=identity;return callback({execute:async statement=>{const {PgDialect}=require('drizzle-orm/pg-core');sqlCalls.push(new PgDialect().sqlToQuery(statement));if(error)throw error;return [{result:response}];}});}}});
let checks=0;
const invalidBodies=['',' ','\t\n','\u0085\u00a0\u1680\u2000\u2028\u2029\u202f\u205f\u3000\ufeff','\0','\ud800','\udc00','x\ud800x','x'.repeat(2001),42,true,null,{}];
for(const body of invalidBodies){assert.equal(validation.discussionBodySchema.safeParse(body).success,false);checks++;}
for(const body of [' exact\r\ntext\t ','😀'.repeat(2000),'\u200b',' e\u0301 ']){assert.equal(validation.discussionBodySchema.parse(body),body);checks++;}
const create={report_id:reportId,parent_id:null,request_id:requestId,body:' exact\r\nbody\t '};
assert.equal(validation.appendDiscussionSchema.parse({...create,report_id:'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA'}).report_id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
for(const extra of ['author_id','author_name','depth','root_id','created_at']){assert.equal(validation.appendDiscussionSchema.safeParse({...create,[extra]:'forged'}).success,false);checks++;}
assert.equal(validation.appendDiscussionSchema.safeParse({...create,body:new Blob(['text'])}).success,false);
for(const options of [{user:null},{userError:{message:'private'}},{userThrows:true},{claimError:{message:'private'}},{claimThrows:true},{claims:null},{user:{...user,is_anonymous:undefined}},{user:{...user,is_anonymous:true}},{claims:{...claims,is_anonymous:undefined}},{claims:{...claims,is_anonymous:true}},{claims:{...claims,sub:otherReport}},{claims:{...claims,iss:'https://untrusted.invalid/auth/v1'}},{claims:{...claims,role:'anon'}},{claims:{...claims,aud:'untrusted'}},{claims:{...claims,exp:0}},{claims:{...claims,session_id:'invalid'}},{claims:{...claims,client_id:null}},{claims:{...claims,client_id:''}},{claims:{...claims,client_id:'delegated'}}]){
 await assert.rejects(()=>actors.requireWebDiscussionActor(sdk(options)),failure=>failure instanceof errors.DiscussionError&&[401,403].includes(failure.status));checks++;
}
client=sdk();const beforeUser=userReads,beforeClaims=claimReads;const actor=await actors.requireWebDiscussionActor(client);assert.equal(userReads,beforeUser+1);assert.equal(claimReads,beforeClaims+1);
const row={id,report_id:reportId,parent_id:null,root_id:id,depth:0,author_name:'Synthetic',body:create.body,created_at:stamp,redacted_at:null,author_id:userId,create_request_id:requestId,create_fingerprint:'PRIVATE',audit:'PRIVATE'};
const child={...row,id:childId,parent_id:id,root_id:id,depth:1};
function saved(overrides={}){return {...row,...overrides};}
function noPrivate(value){if(value&&typeof value==='object')for(const [key,item]of Object.entries(value)){assert.ok(!['author_id','create_request_id','create_fingerprint','audit','email','identity','client'].includes(key),key);noPrivate(item);}}
for(mode of ['supabase-data-api','drizzle']){
 error=null;response=saved();const a=await service.appendDiscussionComment(actor,create);noPrivate(a);assert.equal(a.id,id);assert.equal(a.request_id,requestId);assert.equal(a.created_at,stamp);assert.equal(a.url,`/reports/${reportId}?comment=${id}#comment-${id}`);
 if(mode==='supabase-data-api'){assert.deepEqual(rpcCalls.at(-1).args,{p_report_id:reportId,p_parent_id:null,p_request_id:requestId,p_body:create.body});assert.equal(rpcCalls.at(-1).name,'append_discussion_comment');}
 else{assert.equal(lastIdentity,actor.identity);assert.ok(sqlCalls.at(-1).sql.includes('public.append_discussion_comment'));assert.equal(JSON.parse(sqlCalls.at(-1).params.at(-1)),create.body);assert.ok(sqlCalls.at(-1).sql.includes('::jsonb'));}
 // Controlled DB replay returns current original tombstone, never a reconstructed body.
 response=saved({author_name:null,body:null,redacted_at:stamp});const replay=await service.appendDiscussionComment(actor,create);assert.equal(replay.id,a.id);assert.equal(replay.redacted_at,stamp);noPrivate(replay);
 error={code:'PT409',message:'private conflicting body'};await assert.rejects(()=>service.appendDiscussionComment(actor,{...create,body:'changed'}),e=>e.status===409&&!e.message.includes('private'));error=null;
 response=saved({author_name:null,body:null,redacted_at:stamp});const redacted=await service.redactDiscussionComment(actor,{comment_id:id});assert.equal(redacted.id,id);assert.equal(redacted.redacted_at,stamp);noPrivate(redacted);
 const before=rpcCalls.length+sqlCalls.length;await assert.rejects(()=>service.appendDiscussionComment({identity:actor.identity},create),e=>e.status===403);assert.equal(rpcCalls.length+sqlCalls.length,before);
 response={parent:null,ancestors:[],comments:[row],has_more:true,next_id:id};const page=await service.listDiscussionComments({report_id:reportId,limit:1});noPrivate(page);assert.equal(page.comments[0].created_at,stamp);const cursor=JSON.parse(Buffer.from(page.next_cursor,'base64url').toString('utf8'));assert.deepEqual(cursor,{v:1,report_id:reportId,parent_id:null,last_id:id});
 response={parent:null,ancestors:[],comments:[],has_more:false,next_id:null};await service.listDiscussionComments({report_id:reportId,limit:1,cursor:page.next_cursor});
 if(mode==='supabase-data-api')assert.equal(rpcCalls.at(-1).args.p_after_id,id);else{assert.deepEqual(sqlCalls.at(-1).params,[reportId,null,1,id]);assert.ok(!sqlCalls.at(-1).params.some(v=>v instanceof Date));}
 const count=rpcCalls.length+sqlCalls.length;await assert.rejects(()=>service.listDiscussionComments({report_id:otherReport,cursor:page.next_cursor}),e=>e.status===400);assert.equal(rpcCalls.length+sqlCalls.length,count);
 for(const limit of [0,51])await assert.rejects(()=>service.listDiscussionComments({report_id:reportId,limit}));
 response={parent:{...row,author_name:null,body:null,redacted_at:stamp},ancestors:[],comments:[child],has_more:false,next_id:null};const children=await service.listDiscussionComments({report_id:reportId,parent_id:id});assert.equal(children.parent.body,null);assert.equal(children.comments[0].id,childId);noPrivate(children);
 response={status:'available',comment:child,ancestors:[{...row,author_name:null,body:null,redacted_at:stamp}]};const context=await service.getDiscussionContext({report_id:reportId,comment_id:childId});assert.equal(context.ancestors[0].body,null);noPrivate(context);
 response={status:'unavailable',comment:null,ancestors:[]};assert.deepEqual(norm(await service.getDiscussionContext({report_id:otherReport,comment_id:id})),{report_id:otherReport,status:'unavailable',comment:null,ancestors:[]});
 response={status:'available',comment:{...child,report_id:otherReport},ancestors:[row]};await assert.rejects(()=>service.getDiscussionContext({report_id:reportId,comment_id:childId}),e=>e.status===500);
 response={status:'available',comment:child,ancestors:Array(9).fill(row)};await assert.rejects(()=>service.getDiscussionContext({report_id:reportId,comment_id:childId}),e=>e.status===500);
 response=[{id,can_redact:false,author_id:userId},{id:childId,can_redact:true}];assert.deepEqual(norm(await service.getDiscussionRedactionCapabilities(actor,[row])),[{id,can_redact:false}]);
 response=[{id,can_redact:null}];await assert.rejects(()=>service.getDiscussionRedactionCapabilities(actor,[row]),e=>e.status===500);
 for(const [code,status]of [['PT400',400],['PT401',401],['PT403',403],['PT404',404],['PT409',409],['PT429',429],['PT500',500],['P0001',500],['PT999',500]]){error={code,message:'PRIVATE SQL BODY'};await assert.rejects(()=>service.appendDiscussionComment(actor,create),e=>e.status===status&&!e.message.includes('PRIVATE'));checks++;}error=null;checks+=19;
}
// Uppercase UUIDs exercise actual adapter arguments and canonical receipts, not body normalization.
const uppercase={report_id:'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA',parent_id:'BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB',request_id:'CCCCCCCC-CCCC-4CCC-8CCC-CCCCCCCCCCCC',body:create.body};
for(mode of ['supabase-data-api','drizzle']){
 response=saved({report_id:uppercase.report_id.toLowerCase(),parent_id:uppercase.parent_id.toLowerCase(),root_id:uppercase.parent_id.toLowerCase(),depth:1});
 const canonical=await service.appendDiscussionComment(actor,uppercase);
 assert.equal(canonical.report_id,uppercase.report_id.toLowerCase());assert.equal(canonical.parent_id,uppercase.parent_id.toLowerCase());assert.equal(canonical.request_id,uppercase.request_id.toLowerCase());
 if(mode==='supabase-data-api')assert.deepEqual(rpcCalls.at(-1).args,{p_report_id:canonical.report_id,p_parent_id:canonical.parent_id,p_request_id:canonical.request_id,p_body:create.body});
 else assert.deepEqual(sqlCalls.at(-1).params,[canonical.report_id,canonical.parent_id,canonical.request_id,JSON.stringify(create.body)]);
 const cursor=Buffer.from(JSON.stringify({v:1,report_id:uppercase.report_id,parent_id:uppercase.parent_id,last_id:uppercase.request_id})).toString('base64url');
 response={parent:{...row,id:canonical.parent_id,report_id:canonical.report_id,root_id:canonical.parent_id},ancestors:[],comments:[],has_more:false,next_id:null};
 await service.listDiscussionComments({report_id:uppercase.report_id,parent_id:uppercase.parent_id,cursor});
 if(mode==='supabase-data-api')assert.equal(rpcCalls.at(-1).args.p_after_id,canonical.request_id);else assert.equal(sqlCalls.at(-1).params.at(-1),canonical.request_id);checks+=3;
}
const trpc=load('server/api/trpc.ts',{'server-only':{},'@/lib/observability':{startOperation:()=>({fail(){},complete(){}})},'@/lib/supabase/server':{},'@/server/services/auth':auth,'@/server/services/errors':load('server/services/errors.ts')});
const router=load('server/api/routers/discussions.ts',{'@/lib/discussion-validation':validation,'@/server/services/discussion-actor':actors,'@/server/services/discussion-errors':errors,'@/server/services/discussions':service,'../trpc':trpc}).discussionsRouter;
mode='supabase-data-api';client=sdk();const caller=router.createCaller({client,requestId:'synthetic'});
await assert.rejects(()=>caller.append({...create,author_name:'PRIVATE'}),e=>e.code==='BAD_REQUEST'&&!e.message.includes('PRIVATE'));
response=saved();assert.equal((await caller.append(create)).id,id);
error={code:'UNKNOWN',message:'PRIVATE SQL BODY'};const {fetchRequestHandler}=require('@trpc/server/adapters/fetch');const failedResponse=await fetchRequestHandler({endpoint:'/rpc',req:new Request('https://synthetic.invalid/rpc/append',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(create)}),router,createContext:async()=>({client})});assert.equal(failedResponse.status,500);assert.equal((await failedResponse.json()).error.message,'Could not complete the request. Please try again.');error=null;
const actions=load('app/discussion-actions.ts',{'@/lib/supabase/server':{serverClient:async()=>client},'@/lib/discussion-validation':validation,'@/server/services/discussion-actor':actors,'@/server/services/discussions':service,'@/server/services/discussion-errors':errors,'next/cache':{revalidatePath:()=>{throw new Error('synthetic cache failure');}}});
const form=new FormData();for(const [key,value]of Object.entries({...create,parent_id:''}))form.set(key,value);response=saved();const state=await actions.appendDiscussion({},form);assert.equal(state.receipt.id,id);assert.equal(state.request_id,requestId);noPrivate(state);
const letteredRequest='CCCCCCCC-CCCC-4CCC-8CCC-CCCCCCCCCCCC';form.set('request_id',letteredRequest);response=saved();const letteredState=await actions.appendDiscussion({},form);assert.equal(letteredState.request_id,letteredRequest.toLowerCase());assert.equal(letteredState.receipt.request_id,letteredRequest.toLowerCase());assert.equal(rpcCalls.at(-1).args.p_request_id,letteredRequest.toLowerCase());
error={code:'UNRECOGNIZED',message:'PRIVATE SQL BODY'};const unknown=await actions.appendDiscussion({},form);assert.equal(unknown.request_id,letteredRequest.toLowerCase());assert.equal(unknown.error.status,500);assert.ok(!JSON.stringify(unknown).includes(create.body));error=null;
form.set('author_name','PRIVATE');const rejected=await actions.appendDiscussion({},form);assert.equal(rejected.error.status,400);assert.ok(!JSON.stringify(rejected).includes('PRIVATE'));
const pageRoute=load('app/api/v1/reports/[id]/comments/route.ts',{'@/lib/discussion-validation':validation,'@/server/services/discussions':service,'@/server/services/discussion-errors':errors});
response={parent:null,ancestors:[],comments:[],has_more:false,next_id:null};let http=await pageRoute.GET(new Request('https://synthetic.invalid/comments'),{params:Promise.resolve({id:reportId})});assert.equal(http.status,200);assert.equal(http.headers.get('cache-control'),'no-store');assert.equal(Object.hasOwn(pageRoute,'POST'),false);
http=await pageRoute.GET(new Request('https://synthetic.invalid/comments?limit=51'),{params:Promise.resolve({id:reportId})});assert.equal(http.status,400);assert.equal(http.headers.get('cache-control'),'no-store');
const contextRoute=load('app/api/v1/reports/[id]/comments/[commentId]/route.ts',{'@/lib/discussion-validation':validation,'@/server/services/discussions':service,'@/server/services/discussion-errors':errors});response={status:'unavailable',comment:null,ancestors:[]};http=await contextRoute.GET(new Request('https://synthetic.invalid/comments/'+id),{params:Promise.resolve({id:reportId,commentId:id})});assert.equal(http.status,404);noPrivate(await http.json());
const migration=fs.readdirSync(new URL('supabase/migrations/',root)).find(name=>name.endsWith('_discussion_comments.sql'));const ddl=read('supabase/migrations/'+migration);const canonical=read('supabase/schema.sql');assert.ok(canonical.endsWith(ddl));
assert.equal((ddl.match(/when others then raise sqlstate 'PT500' using message='Discussion request could not be completed\.'/g)??[]).length,2);assert.match(ddl,/p_body jsonb/);assert.match(ddl,/jsonb_typeof\(p_body\)='string'/);assert.match(ddl,/auth\.jwt\(\) \? 'client_id'/);assert.match(ddl,/u\.is_anonymous is false/);assert.match(ddl,/for share/);assert.match(ddl,/'can_redact',\(c.author_id=actor and c.redacted_at is null\) is true/,'Orphan author SQLNULL must become boolean false');assert.ok(ddl.indexOf('stamp:=clock_timestamp()')>ddl.indexOf('pg_advisory_xact_lock'));
assert.match(ddl,/foreign key\(report_id,parent_id\).*on delete restrict/);assert.match(ddl,/foreign key\(report_id,root_id\).*on delete restrict/);assert.match(ddl,/author_id uuid references auth.users\(id\) on delete set null/);assert.ok(!/\bstrict\b/i.test(ddl));assert.match(ddl,/grant execute on function private\.append_discussion_comment\(uuid,uuid,uuid,jsonb\) to authenticated/);assert.match(ddl,/\(c\.created_at,c\.id\)>\(after_time,p_after_id\)/);
console.log(`PASS discussion source/adapters: ${checks}+ validation/actor/projection/page/context/idempotency/error checks, exact body+microseconds, fresh actor and failclosed delegation, actual tRPC/action/GET shapes, explicit SQL source boundary assertions. Controlled mocks only; SQL/source fixtures NOT executed, no hosted account/session/revocation/concurrency/storage proof.`);
