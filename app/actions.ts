'use server';
import { startAuthTelemetry } from '@/lib/telemetry-server';
import { serverClient } from '@/lib/supabase/server';
import { authCallbackUrl, authSiteOrigin, githubAuthEnabled } from '@/lib/auth-config';
import { reportSchema, fixSchema, verificationSchema, safeNext } from '@/lib/validation';
import { api } from '@/trpc/server';
import { contributionReportId } from '@/server/services/contribution-source';
import { TRPCError } from '@trpc/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z, ZodError } from 'zod';
export type ContributionReceipt = { kind:'fix'|'verification'; id:string; report_id:string|null; url:string|null };
export type FormState = { error?: string; message?: string; token?: string; receipt?:ContributionReceipt };
export async function beginGitHubSignIn(_state: FormState, form: FormData): Promise<FormState> {
 if(!await githubAuthEnabled()) return {error:'GitHub sign-in is being set up. Please check back shortly.'};
 let destination: string;
 try {
  const db=await serverClient();
  const {data,error}=await db.auth.signInWithOAuth({provider:'github',options:{
   redirectTo:authCallbackUrl(String(form.get('next')??'/')), skipBrowserRedirect:true,
  }});
  if(error || !data.url) return {error:'GitHub sign-in could not start. Please try again.'};
  const target=new URL(data.url);
  if(target.origin!==new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin || target.pathname!=='/auth/v1/authorize') {
   return {error:'GitHub sign-in could not start. Please try again.'};
  }
  destination=target.toString();
 } catch { return {error:'GitHub sign-in could not start. Please try again.'}; }
 redirect(destination);
}
export type EmailAuthState = { error?: string; message?: string };
function emailCredentials(form:FormData) {
 const email=form.get('email'),password=form.get('password'),next=form.get('next');
 if(typeof email!=='string'||typeof password!=='string'||password.length===0) return null;
 const parsed=z.email().safeParse(email.trim());
 if(!parsed.success) return null;
 return {email:parsed.data,password,next:safeNext(typeof next==='string'?next:null)};
}
export async function signInWithEmail(_state:EmailAuthState,form:FormData):Promise<EmailAuthState> {
 const telemetry=await startAuthTelemetry('email_signin');
 const failure={error:'Sign-in could not be completed. Please try again.'};
 const credentials=emailCredentials(form);
 if(!credentials) { telemetry.finish('input_rejected'); return failure; }
 let destination:string;
 try {
  const db=await serverClient();
  const {data,error}=await db.auth.signInWithPassword({email:credentials.email,password:credentials.password});
  if(error||!data.session||!data.user) { telemetry.finish(error?'provider_rejected':'session_unverified'); return failure; }
  const verified=await db.auth.getUser();
  if(verified.error||!verified.data.user) { telemetry.finish('session_unverified'); return failure; }
  destination=new URL(credentials.next,authSiteOrigin()).toString();
 } catch { telemetry.finish('unavailable'); return failure; }
 telemetry.finish('server_session_verified');
 revalidatePath('/','layout');
 redirect(destination);
}
export async function signUpWithEmail(_state:EmailAuthState,form:FormData):Promise<EmailAuthState> {
 const telemetry=await startAuthTelemetry('email_signup');
 const failure={error:'Account creation could not be completed. Please try again.'};
 const confirmation={message:'If this address can be registered, check your email for a confirmation link.'};
 const suppliedName=form.get('display_name');
 if(suppliedName!==null&&(typeof suppliedName!=='string'||suppliedName.trim().length>80)) { telemetry.finish('input_rejected'); return {error:'Use a public display name of 80 characters or fewer.'}; }
 const display_name=typeof suppliedName==='string'&&suppliedName.trim()?suppliedName.trim():'Contributor';
 const credentials=emailCredentials(form);
 if(!credentials) { telemetry.finish('input_rejected'); return failure; }
 let destination:string;
 try {
  const db=await serverClient();
  const {data,error}=await db.auth.signUp({email:credentials.email,password:credentials.password,options:{emailRedirectTo:authCallbackUrl(credentials.next),data:{display_name}}});
  if(error) {
   if(error.code==='user_already_exists'||error.code==='email_exists') { telemetry.finish('neutral_confirmation_prompt'); return confirmation; }
   if(error.code==='weak_password') { telemetry.finish('input_rejected'); return {error:'Choose a stronger password and try again.'}; }
   if(error.code==='over_email_send_rate_limit'||error.code==='over_request_rate_limit') { telemetry.finish('rate_limited'); return {error:'Please wait before trying again.'}; }
   telemetry.finish('provider_rejected'); return failure;
  }
  if(!data.session) { telemetry.finish('neutral_confirmation_prompt'); return confirmation; }
  const verified=await db.auth.getUser();
  if(verified.error||!verified.data.user) { telemetry.finish('session_unverified'); return failure; }
  destination=new URL(credentials.next,authSiteOrigin()).toString();
 } catch { telemetry.finish('unavailable'); return failure; }
 telemetry.finish('server_session_verified');
 revalidatePath('/','layout');
 redirect(destination);
}
export async function signOut() {
 const telemetry=await startAuthTelemetry('signout');
 try { const db=await serverClient(); await db.auth.signOut(); }
 catch(error) { telemetry.finish('unavailable'); throw error; }
 telemetry.finish('signout_returned');
 revalidatePath('/','layout'); redirect('/');
}
function actionError(error: unknown) {
 if(error instanceof ZodError) return error.issues[0]?.message ?? 'Check the contribution fields.';
 if(error instanceof TRPCError && error.cause instanceof ZodError) return error.cause.issues[0]?.message ?? 'Check the form fields.';
 if(error instanceof TRPCError && error.code !== 'INTERNAL_SERVER_ERROR') return error.message;
 return 'Could not save this change. Check its fields and try again.';
}
// An explicit opt-in keeps untouched legacy forms absent, while partial bundles
// remain invalid instead of silently turning into legacy evidence.
function formEvidence(form:FormData,kind:string) {
 if(form.get('evidence_enabled')!=='1') return undefined;
 const field=(name:string)=>String(form.get(name)??'');
 const observation=(prefix:string)=>({
  output:field(`${prefix}_output`),
  ...(field(`${prefix}_exit_code`).trim()===''?{}:{exit_code:Number(field(`${prefix}_exit_code`))}),
 });
 const count=Number(field('evidence_version_count'));
 if(!Number.isInteger(count)||count<1||count>12) throw new Error('Invalid evidence version count.');
 return {
  contract_version:1,
  check:{kind:field('evidence_check_kind'),instructions:field('evidence_check_instructions'),expected_result:field('evidence_check_expected_result')},
  before_result:observation('evidence_before'),
  after_result:kind==='report'||(kind==='fix'&&form.get('evidence_after_recorded')!=='1')?null:observation('evidence_after'),
  versions:Array.from({length:count},(_,index)=>({
   kind:field(`evidence_versions.${index}.kind`),name:field(`evidence_versions.${index}.name`),
   version:form.get(`evidence_versions.${index}.unknown`)==='1'?null:field(`evidence_versions.${index}.version`),
  })),
 };
}
export async function contribute(_state: FormState, form: FormData): Promise<FormState> {
 const kind=String(form.get('kind'));
 const raw:Record<string,unknown>=Object.fromEntries(form.entries());
 let result: {id:string};
 let reportId:string|null=null;
 try {
  const evidence_bundle=formEvidence(form,kind);
  if(evidence_bundle!==undefined) raw.evidence_bundle=evidence_bundle;
  if(kind==='report') result=await api.contributions.report(reportSchema.omit({author_name:true}).parse({...raw,tags:String(form.get('tags')??'').split(',').map(t=>t.trim()).filter(Boolean)}));
  else if(kind==='fix') {
   const data=fixSchema.omit({author_name:true}).parse(raw);
   result=await api.contributions.fix(data);
   reportId=data.report_id;
  }
  else if(kind==='verification') result=await api.contributions.verify(verificationSchema.omit({author_name:true}).parse(raw));
  else return {error:'Choose a valid contribution type.'};
 } catch(error) { return {error:actionError(error)}; }
 // A completed write remains a save even when optional refresh/link discovery fails.
 try { revalidatePath('/'); } catch { /* The known saved receipt is still valid. */ }
 if(kind==='report') redirect(`/reports/${result.id}`);
 if(kind==='verification') {
  try {
   const parent=await contributionReportId('verification',result.id);
   reportId=z.uuid().safeParse(parent).success?parent:null;
  } catch { /* Show the saved result ID without claiming an unavailable link. */ }
 }
 if(reportId) {
  try { revalidatePath(`/reports/${reportId}`); } catch { /* Do not invite a duplicate save. */ }
 }
 const receipt:ContributionReceipt={kind:kind==='fix'?'fix':'verification',id:result.id,report_id:reportId,
  url:reportId?`/reports/${reportId}#${kind==='fix'?'fix':'verification'}-${result.id}`:null};
 return {message:kind==='fix'?'Fix published. Independent contributors can now test it.':'Result recorded with your environment and notes.',receipt};
}

export async function createAgentKey(_state: FormState, form: FormData): Promise<FormState> {
 try {
  const data=await api.agentKeys.create({name:String(form.get('name')??'')});
  revalidatePath('/agents');
  return {token:data.token,message:'Copy this key now. It will not be shown again. It expires in 90 days.'};
 } catch(error) { return {error:actionError(error)}; }
}
export async function revokeAgentKey(form:FormData) {
 const id=String(form.get('id')??''); if(!z.uuid().safeParse(id).success) return;
 await api.agentKeys.revoke({id});
 revalidatePath('/agents');
}
