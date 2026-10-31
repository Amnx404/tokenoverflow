'use server';
import { serverClient } from '@/lib/supabase/server';
import { authCallbackUrl, githubAuthEnabled } from '@/lib/auth-config';
import { reportSchema, fixSchema, verificationSchema } from '@/lib/validation';
import { api } from '@/trpc/server';
import { TRPCError } from '@trpc/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z, ZodError } from 'zod';
export type FormState = { error?: string; message?: string; token?: string };
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
export async function signOut() { const db=await serverClient(); await db.auth.signOut(); revalidatePath('/','layout'); redirect('/'); }
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
 try {
  const evidence_bundle=formEvidence(form,kind);
  if(evidence_bundle!==undefined) raw.evidence_bundle=evidence_bundle;
  if(kind==='report') result=await api.contributions.report(reportSchema.omit({author_name:true}).parse({...raw,tags:String(form.get('tags')??'').split(',').map(t=>t.trim()).filter(Boolean)}));
  else if(kind==='fix') result=await api.contributions.fix(fixSchema.omit({author_name:true}).parse(raw));
  else if(kind==='verification') result=await api.contributions.verify(verificationSchema.omit({author_name:true}).parse(raw));
  else return {error:'Choose a valid contribution type.'};
 } catch(error) { return {error:actionError(error)}; }
 revalidatePath('/');
 if(kind==='report') redirect(`/reports/${result.id}`);
 const reportId=String(form.get('return_report_id')??form.get('report_id')??'');
 if(z.uuid().safeParse(reportId).success) revalidatePath(`/reports/${reportId}`);
 return {message:kind==='fix'?'Fix published. Independent contributors can now test it.':'Result recorded with your environment and notes.'};
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
