// Exact-source synthetic auth acceptance. No real users, mail, credentials or network.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServerClient } from '@supabase/ssr';
const require=createRequire(import.meta.url);
const root=new URL('../../',import.meta.url);
const read=path=>fs.readFileSync(new URL(path,root),'utf8');
const environment={env:{AUTH_SITE_URL:'https://tokenoverflow.app',NODE_ENV:'production',NEXT_PUBLIC_SUPABASE_URL:'https://auth-fixture.invalid',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'synthetic-public-key'}};
function load(path,mocks={},extra={}) {
 const loaded={exports:{}};
 const code=ts.transpileModule(read(path),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(code,{Error,URL,URLSearchParams,Request,Response,TextEncoder,process:environment,module:loaded,exports:loaded.exports,require:name=>name==='@/lib/telemetry-server'?{startAuthTelemetry:async()=>({finish:()=>{}})}:Object.hasOwn(mocks,name)?mocks[name]:require(name),...extra});
 return loaded.exports;
}
const types=load('lib/types.ts');
const validation=load('lib/validation.ts',{'./types':types});
const config=load('lib/auth-config.ts',{'server-only':{},'./validation':validation});
const normalize=value=>JSON.parse(JSON.stringify(value));
const id='10000000-0000-4000-8000-000000000001';
const user={id,aud:'authenticated',role:'authenticated',email:'synthetic@example.invalid',created_at:'2026-10-30T00:00:00Z',app_metadata:{provider:'email'},user_metadata:{}};
const good={data:{user,session:{access_token:'synthetic-session'}},error:null};
const rawFailure='raw-provider-secret-or-account-exists';
const signinFailure='Sign-in could not be completed. Please try again.';
const signupFailure='Account creation could not be completed. Please try again.';
const confirmation='If this address can be registered, check your email for a confirmation link.';
class Redirect extends Error {constructor(destination){super('synthetic redirect');this.destination=destination;}}
function form({email='  synthetic@example.invalid  ',password='  exact password  ',next='/reports/new'}={}) {
 const value=new FormData();value.set('email',email);value.set('password',password);value.set('next',next);return value;
}
function actions({result=good,verified={data:{user},error:null},throws=false,clientThrows=false,verifyThrows=false,clientFactory}={}) {
 const calls=[];
 const auth={};
 for(const method of ['signInWithPassword','signUp'])auth[method]=async args=>{calls.push([method,normalize(args)]);if(throws)throw new Error(rawFailure);return result;};
 auth.getUser=async()=>{calls.push(['getUser']);if(verifyThrows)throw new Error(rawFailure);return verified;};
 const loadedModule=load('app/actions.ts',{'@/lib/supabase/server':{serverClient:clientFactory??(async()=>{calls.push(['serverClient']);if(clientThrows)throw new Error(rawFailure);return {auth};})},'@/lib/auth-config':config,'@/lib/validation':validation,'@/trpc/server':{api:{}},'@/server/services/contribution-source':{contributionReportId:async()=>{throw new Error('Unexpected contribution lookup in auth QA.');}},'next/cache':{revalidatePath:(...args)=>calls.push(['revalidate',...args])},'next/navigation':{redirect:destination=>{calls.push(['redirect',destination]);throw new Redirect(destination);}}});
 return {module:loadedModule,calls};
}
let actionCases=0;
for(const [method,failure] of [['signInWithEmail',signinFailure],['signUpWithEmail',signupFailure]]) {
 for(const input of [form({email:'bad'}),form({password:''}),form({email:new Blob(['not a string'])}),form({password:new Blob(['not a string'])})]) {
  const run=actions();assert.deepEqual(normalize(await run.module[method]({},input)),{error:failure});assert.equal(run.calls.length,0);actionCases++;
 }
 for(const options of [{result:{data:{user:null,session:null},error:{message:rawFailure}}},{throws:true},{clientThrows:true}]) {
  const run=actions(options);const state=await run.module[method]({},form());assert.deepEqual(normalize(state),{error:failure});assert.ok(!JSON.stringify(state).includes(rawFailure));actionCases++;
 }
 for(const options of [{verified:{data:{user:null},error:null}},{verified:{data:{user},error:{message:rawFailure}}},{verifyThrows:true}]) {
  const run=actions(options);assert.deepEqual(normalize(await run.module[method]({},form())),{error:failure});assert.equal(run.calls.filter(call=>call[0]==='getUser').length,1);assert.ok(!run.calls.some(call=>call[0]==='redirect'));actionCases++;
 }
 for(const next of ['/reports/new','//untrusted.invalid','https://untrusted.invalid','/\\untrusted.invalid','/bad\npath']) {
  const run=actions();const target=`https://tokenoverflow.app${next==='/reports/new'?next:'/'}`;
  await assert.rejects(()=>run.module[method]({},form({next})),error=>error instanceof Redirect&&error.destination===target);
  const call=run.calls.find(call=>['signUp','signInWithPassword'].includes(call[0]));
  assert.equal(call[1].email,'synthetic@example.invalid');assert.equal(call[1].password,'  exact password  ');
  if(method==='signUpWithEmail'){assert.equal(call[1].options.emailRedirectTo,config.authCallbackUrl(next));assert.deepEqual(call[1].options.data,{display_name:'Contributor'});}
  assert.deepEqual(run.calls.slice(-3).map(call=>call[0]),['getUser','revalidate','redirect']);
  assert.deepEqual(run.calls.at(-2),['revalidate','/','layout']);actionCases++;
 }
 // A password containing only spaces is still an exact password, never trimmed.
 const spaces=actions();await assert.rejects(()=>spaces.module[method]({},form({password:'   '})),Redirect);
 assert.equal(spaces.calls.find(call=>['signUp','signInWithPassword'].includes(call[0]))[1].password,'   ');actionCases++;
}
for(const data of [{user:null,session:null},{user,session:null},{user:{...user,identities:[]},session:null}]) {
 const run=actions({result:{data,error:null}});
 assert.deepEqual(normalize(await run.module.signUpWithEmail({},form())),{message:confirmation});
 assert.ok(!run.calls.some(call=>['getUser','redirect','revalidate'].includes(call[0])));actionCases++;
}
for(const code of ['user_already_exists','email_exists']) {
 const run=actions({result:{data:{user:null,session:null},error:{code,message:rawFailure}}});
 const state=await run.module.signUpWithEmail({},form());
 assert.deepEqual(normalize(state),{message:confirmation},'Known existing-account code must match neutral no-session signup');
 assert.ok(!JSON.stringify(state).includes(rawFailure));
 assert.ok(!run.calls.some(call=>['getUser','redirect','revalidate'].includes(call[0])));actionCases++;
}
{
 const run=actions({result:{data:{user:null,session:null},error:{code:'user_already_exists_lookalike',message:'email_exists'}}});
 assert.deepEqual(normalize(await run.module.signUpWithEmail({},form())),{error:signupFailure},'Unknown codes/messages must retain generic operational failure');actionCases++;
}
for(const [code,message] of [['weak_password','Choose a stronger password and try again.'],['over_email_send_rate_limit','Please wait before trying again.'],['over_request_rate_limit','Please wait before trying again.'],['weak_password_lookalike',signupFailure],['over_email_send_rate_limit_lookalike',signupFailure]]) {
 const run=actions({result:{data:{user:null,session:null},error:{code,message:rawFailure}}});
 const state=await run.module.signUpWithEmail({},form());assert.deepEqual(normalize(state),{error:message});assert.ok(!JSON.stringify(state).includes(rawFailure));
 assert.ok(!run.calls.some(call=>['getUser','redirect','revalidate'].includes(call[0])));actionCases++;
}
for(const [value,expected] of [[null,'Contributor'],['','Contributor'],['   ','Contributor'],['  Public author  ','Public author'],['x'.repeat(80),'x'.repeat(80)]]) {
 const input=form();if(value!==null)input.set('display_name',value);
 const run=actions({result:{data:{user:null,session:null},error:null}});
 assert.deepEqual(normalize(await run.module.signUpWithEmail({},input)),{message:confirmation});
 assert.deepEqual(run.calls.find(call=>call[0]==='signUp')[1].options.data,{display_name:expected});actionCases++;
}
for(const value of ['x'.repeat(81),new Blob(['name'])]) {
 const input=form();input.set('display_name',value);const run=actions();
 assert.deepEqual(normalize(await run.module.signUpWithEmail({},input)),{error:'Use a public display name of 80 characters or fewer.'});assert.equal(run.calls.length,0);actionCases++;
}
for(const data of [{user:null,session:good.data.session},{user,session:null}]) {
 const run=actions({result:{data,error:null}});assert.deepEqual(normalize(await run.module.signInWithEmail({},form())),{error:signinFailure});actionCases++;
}
// A File next value is ignored instead of coerced into a redirect path.
{const run=actions();await assert.rejects(()=>run.module.signInWithEmail({},form({next:new Blob(['/reports/new'])})),error=>error.destination==='https://tokenoverflow.app/');actionCases++;}
let routeCases=0;
for(const [path,kind,method] of [['app/auth/callback/route.ts','oauth','exchangeCodeForSession'],['app/auth/confirm/route.ts','confirmation','verifyOtp']]) {
 const route=(result=good,throws=false)=>{
  const calls=[];
  const loadedModule=load(path,{'@/lib/supabase/server':{serverClient:async()=>({auth:{[method]:async value=>{calls.push(normalize(value));if(throws)throw new Error(rawFailure);return result;}}})},'@/lib/auth-config':config,'@/lib/validation':validation});
  return {calls,get:query=>loadedModule.GET(new Request(`https://untrusted.invalid/auth?${query}`))};
 };
 const successQueries=kind==='oauth'?['code=synthetic-code']:['token_hash=synthetic-hash&type=email','token_hash=synthetic-hash&type=signup'];
 for(const query of successQueries)for(const next of ['/reports/new','//untrusted.invalid','https://untrusted.invalid','/\\untrusted.invalid']) {
  const run=route();const response=await run.get(`${query}&next=${encodeURIComponent(next)}`);
  assert.equal(response.status,307);assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal(response.headers.get('location'),`https://tokenoverflow.app${next==='/reports/new'?next:'/'}`);assert.equal(run.calls.length,1);routeCases++;
 }
 const invalid=kind==='oauth'?['','error=provider-raw&code=synthetic-code']:['','type=email','token_hash=synthetic-hash','token_hash=synthetic-hash&type=recovery','token_hash=synthetic-hash&type=invite','token_hash=synthetic-hash&type=magiclink','token_hash=synthetic-hash&type=signup&error=raw'];
 for(const query of invalid) {
  const run=route();const response=await run.get(`${query}&next=%2Freports%2Fnew`);
  const destination=new URL(response.headers.get('location'));assert.equal(destination.origin,'https://tokenoverflow.app');assert.equal(destination.pathname,'/login');assert.equal(destination.searchParams.get('error'),kind);assert.equal(destination.searchParams.get('next'),'/reports/new');
  assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(run.calls.length,0);routeCases++;
 }
 for(const [result,throws] of [[{data:{session:null},error:{message:rawFailure}},false],[good,true],[{data:{session:null},error:null},false]]) {
  const run=route(result,throws);const response=await run.get(`${successQueries[0]}&next=%2Freports%2Fnew`);
  assert.equal(response.status,307);assert.equal(response.headers.get('cache-control'),'no-store');
  const location=response.headers.get('location');assert.ok(location.startsWith('https://tokenoverflow.app/login?'));assert.ok(!location.includes(rawFailure)&&!location.includes('synthetic-hash')&&!location.includes('synthetic-code'));assert.equal(new URL(location).searchParams.get('next'),'/reports/new');routeCases++;
 }
}
// Installed SSR + auth SDK, controlled fetch and cookie jar through the actual serverClient source.
let sdkMode='signin';const jar=new Map();let requests=[],cookieWrites=0;
const jwt=`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.synthetic-signature`;
const sessionResponse={access_token:jwt,refresh_token:'synthetic-refresh-token',token_type:'bearer',expires_in:3600,user};
const controlledFetch=async(input,init)=>{
 const url=new URL(typeof input==='string'?input:input.url);assert.equal(url.origin,'https://auth-fixture.invalid','Unexpected network destination');
 const body=init?.body?JSON.parse(init.body):null;requests.push({path:url.pathname,query:url.search,body});
 if(url.pathname==='/auth/v1/signup')return Response.json(sdkMode==='confirmation'?user:sessionResponse);
 if(url.pathname==='/auth/v1/token'||url.pathname==='/auth/v1/verify')return sdkMode.startsWith('bad-')?Response.json({code:'otp_expired',msg:rawFailure},{status:403}):Response.json(sessionResponse);
 if(url.pathname==='/auth/v1/user')return Response.json(user);
 throw new Error('Unexpected synthetic endpoint');
};
const server=load('lib/supabase/server.ts',{'@supabase/ssr':{createServerClient:(url,key,options)=>createServerClient(url,key,{...options,global:{fetch:controlledFetch}})},'next/headers':{cookies:async()=>({getAll:()=>Array.from(jar,([name,value])=>({name,value})),set:(name,value)=>{cookieWrites++;jar.set(name,value);}})}});
for(sdkMode of ['signin','confirmation','signup-session']) {
 jar.clear();requests=[];cookieWrites=0;
 const run=actions({clientFactory:server.serverClient});
 if(sdkMode==='confirmation') {
  assert.deepEqual(normalize(await run.module.signUpWithEmail({},form())),{message:confirmation});
  assert.ok(!requests.some(request=>request.path==='/auth/v1/user'));assert.ok(cookieWrites>0,'PKCE verifier cookie was not written');
  const signup=requests.find(request=>request.path==='/auth/v1/signup');assert.ok(signup.body.code_challenge);assert.equal(new URLSearchParams(signup.query).get('redirect_to'),config.authCallbackUrl('/reports/new'));
 } else {
  const action=sdkMode==='signin'?'signInWithEmail':'signUpWithEmail';
  await assert.rejects(()=>run.module[action]({},form()),error=>error instanceof Redirect&&error.destination==='https://tokenoverflow.app/reports/new');
  assert.ok(cookieWrites>0,'SSR session cookie was not written');assert.ok(requests.some(request=>request.path==='/auth/v1/user'),'Fresh user lookup absent');
  const fresh=await server.serverClient();assert.equal((await fresh.auth.getUser()).data.user.id,id,'Next synthetic request did not recover cookie session');
 }
 const submit=requests.find(request=>request.body?.password);assert.equal(submit.body.password,'  exact password  ');assert.equal(submit.body.email,'synthetic@example.invalid');if(sdkMode!=='signin')assert.deepEqual(submit.body.data,{display_name:'Contributor'});
}
let sdkRouteCases=0;
for(const [path,query,mode] of [
 ['app/auth/callback/route.ts','code=synthetic-code','callback'],
 ['app/auth/confirm/route.ts','token_hash=synthetic-hash&type=email','confirm'],
 ['app/auth/confirm/route.ts','token_hash=synthetic-hash&type=signup','confirm'],
 ['app/auth/callback/route.ts','code=synthetic-code','bad-callback'],
 ['app/auth/confirm/route.ts','token_hash=synthetic-hash&type=email','bad-confirm'],
]) {
 jar.clear();requests=[];cookieWrites=0;
 if(mode.includes('callback')) {
  sdkMode='confirmation';const seed=actions({clientFactory:server.serverClient});
  await seed.module.signUpWithEmail({},form());
 }
 sdkMode=mode;
 const route=load(path,{'@/lib/supabase/server':server,'@/lib/auth-config':config,'@/lib/validation':validation});
 const response=await route.GET(new Request(`https://untrusted.invalid/auth?${query}&next=%2Freports%2Fnew`));
 assert.equal(response.headers.get('cache-control'),'no-store');
 if(mode.startsWith('bad-'))assert.ok(response.headers.get('location').startsWith('https://tokenoverflow.app/login?'));
 else {
  assert.equal(response.headers.get('location'),'https://tokenoverflow.app/reports/new');
  const fresh=await server.serverClient();assert.equal((await fresh.auth.getUser()).data.user.id,id);
 }
 sdkRouteCases++;
}
// Render actual new client form with controlled hook states, then actual page composition.
function emailComponent(state={},pending=false) {
 return load('components/email-auth-form.tsx',{'react':{...React,useActionState:()=>[state,'/synthetic-action',pending]},'@/app/actions':{signUpWithEmail:()=>{},signInWithEmail:()=>{}}}).EmailAuthForm;
}
for(const mode of ['signin','signup'])for(const [state,pending] of [[{},false],[{error:signinFailure},false],[{message:confirmation},false],[{},true]]) {
 const Component=emailComponent(state,pending);const html=renderToStaticMarkup(React.createElement(Component,{mode,next:'/reports/new'}));
 assert.match(html,/<label>Email<input/);assert.match(html,/<label>Password<input/);assert.match(html,/type="password"/);assert.match(html,/autoComplete="username"/);assert.ok(html.includes(`autoComplete="${mode==='signup'?'new-password':'current-password'}"`));assert.match(html,/aria-live="polite"/);
 assert.equal(html.includes('disabled=""'),pending);assert.equal(html.includes('aria-busy="true"'),pending);assert.ok(!html.includes('minLength'));assert.ok(!html.includes('<h2'));assert.ok(html.includes(`aria-label="${mode==='signup'?'Create account with email':'Sign in with email'}"`));assert.equal(html.includes('name="display_name"'),mode==='signup');if(mode==='signup'){assert.ok(html.includes('maxLength="80"'));assert.ok(html.includes('Shown with your public findings.'));}if(state.message)assert.ok(html.includes(confirmation));
}
const Link=({children,href})=>React.createElement('a',{href},children);
for(const page of ['app/login/page.tsx','app/signup/page.tsx'])for(const enabled of [false,true]) {
 const pageModule=load(page,{'next/link':{default:Link},'@/components/forms':{AuthForm:()=>React.createElement('p',null,enabled?'Continue with GitHub':'GitHub sign-in is being set up.')},'@/components/email-auth-form':{EmailAuthForm:emailComponent()},'@/lib/auth-config':{githubAuthEnabled:async()=>enabled},'@/lib/validation':validation,'lucide-react':{Braces:()=>null}});
 const html=renderToStaticMarkup(await pageModule.default({searchParams:Promise.resolve({next:'/reports/new',error:rawFailure})}));
 if(enabled)assert.ok(html.indexOf('GitHub')<html.indexOf('name="email"'),'GitHub must stay first');else{assert.ok(!html.includes('GitHub'));assert.ok(html.includes('name="email"'));assert.ok(!html.includes('Reading is open'));}assert.equal((html.match(/<h[1-6](?:>| )/g)??[]).length,1,'Only page H1 should remain');assert.ok(html.includes('next=%2Freports%2Fnew'));assert.ok(!html.includes(rawFailure));if(page.includes('/login/'))assert.ok(html.includes(signinFailure),'Generic error absent when GitHub disabled');
}
console.log(`PASS ${actionCases} action cases, ${routeCases} route cases, 3 installed-SSR action cookie cases, ${sdkRouteCases} installed-SSR callback/confirm cookie cases and form/page renders. No real signup/mail/session/browser/production claim.`);
