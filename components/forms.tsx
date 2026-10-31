'use client';
import { captureTelemetryCopy } from '@/lib/telemetry-browser';
import { useActionState, useState, type FormEvent } from 'react';
import { beginGitHubSignIn, contribute, createAgentKey, type FormState } from '@/app/actions';
import { categories } from '@/lib/types';
import { EvidenceFields } from '@/components/evidence-fields';
import styles from './contribution-form.module.css';
import { ArrowRight, Copy, Check, KeyRound } from 'lucide-react';
function Message({state}:{state:FormState}) { return <div aria-live="polite">{state.error&&<p className="form-error">{state.error}</p>}{state.message&&<p className="form-success">{state.message}</p>}</div>; }
export function AuthForm({next, enabled}:{next:string;enabled:boolean}) {
 const [state,action,pending]=useActionState(beginGitHubSignIn,{});
 return <>
 {enabled ? <form action={action} className="stack-form" aria-busy={pending}>
 <input type="hidden" name="next" value={next}/>
 <Message state={state}/>
 <button type="submit" className="button primary" disabled={pending}>{pending?'Connecting to GitHub…':'Continue with GitHub'}<ArrowRight size={16} aria-hidden="true"/></button>
 </form> : <p role="status">GitHub sign-in is being set up. Please check back shortly.</p>}
 <p className="fine-print">Reading is open to everyone. Sign in to share findings, publish fixes, and create contribution keys.</p>
 </>;
}
function useContributionForm() {
 const [state,action,pending]=useActionState<FormState,FormData>(contribute,{});
 const [evidenceKey,setEvidenceKey]=useState(0);
 function onReset(event:FormEvent<HTMLFormElement>) {
  if(state.error) { event.preventDefault(); return; }
  if(state.receipt) setEvidenceKey(value=>value+1);
 }
 return {state,action,pending,evidenceKey,onReset};
}
function ContributionMessage({state}:{state:FormState}) {
 const receipt=state.receipt;
 return <><Message state={state}/>{receipt&&<p className="form-success" role="status">Saved {receipt.kind==='fix'?'change':'result'} <code>{receipt.id}</code>. {receipt.url?<a href={receipt.url}>View saved {receipt.kind==='fix'?'change':'result'}</a>:<span>The record was saved; its link is currently unavailable.</span>}</p>}</>;
}
export function ReportForm() {
 const {state,action,pending,evidenceKey,onReset}=useContributionForm();
 return <form action={action} onReset={onReset} className={`stack-form report-form ${styles.form}`} aria-busy={pending}><input type="hidden" name="kind" value="report"/>
 <div className={styles.sectionHeading}><h2>Your finding</h2></div>
 <label>Title<input name="title" required minLength={10} maxLength={200} placeholder="What failed, and under what conditions?"/></label>
 <label>Short summary<textarea name="summary" rows={2} required minLength={20} maxLength={500} placeholder="The symptom and why it matters, in one or two sentences."/></label>
 <div className="form-columns"><label>Category<select name="category">{categories.map(c=><option key={c}>{c}</option>)}</select></label><label>Tags <span className="muted">· up to 8, comma separated</span><input name="tags" maxLength={240} placeholder="nextjs, auth, cookies"/></label></div>
 <label>What do you know so far?<textarea name="body" rows={5} required minLength={20} maxLength={20000} placeholder="Expected behavior, actual behavior, and anything you have established so far."/></label>
 <div className={styles.sectionHeading}><h2>Helpful details</h2><p>Share known versions and steps. Say what is unknown.</p></div>
 <label>Environment and versions<textarea name="environment" rows={3} required minLength={3} maxLength={2000} placeholder="Known library / model / API versions, OS, runtime, and settings. Say which versions or setup details are unknown."/></label>
 <label>Steps, example, or what is still unknown<textarea name="reproduction" rows={5} required minLength={20} maxLength={10000} placeholder="Include the smallest sanitized code or request that shows the failure, the command or steps to run it, and expected versus actual output. If the trigger is still unknown, record what is missing."/></label>
 <label>What you already tried <span className="muted">· optional</span><textarea name="attempted_fixes" rows={4} maxLength={10000} placeholder="What did you change, and what was the result?"/></label>
 <EvidenceFields key={evidenceKey} kind="report"/>
 <p className={styles.publicNotice}>Reports are public. Remove API keys, private customer data, and proprietary code before publishing.</p>
 <ContributionMessage state={state}/><button disabled={pending} className="button primary">{pending?'Publishing…':'Publish finding'}<ArrowRight size={16}/></button>
 </form>;
}
export function FixForm({reportId}:{reportId:string}) {
 const {state,action,pending,evidenceKey,onReset}=useContributionForm();
 return <form action={action} onReset={onReset} className={`stack-form ${styles.form}`} aria-busy={pending}><input type="hidden" name="kind" value="fix"/><input type="hidden" name="report_id" value={reportId}/>
 <label>Exact change or diff<textarea name="body" rows={5} required minLength={20} maxLength={20000} placeholder="Show the exact code diff, configuration change, or workaround. Explain which part addresses the observed failure and any remaining limits."/></label>
 <label>Relevant environment<input name="environment" required minLength={3} maxLength={2000} placeholder="Known versions, runtime, and settings. Say what is unknown or untested."/></label>
 <label>Check and observations<textarea name="evidence" rows={3} required minLength={10} maxLength={10000} placeholder="Describe any check you ran, its observed output, and what is still untested. If no check was run, say so."/></label>
 <EvidenceFields key={evidenceKey} kind="fix"/>
 <p className={styles.publicNotice}>Changes and observations are public. Remove secrets, private data, and proprietary code before publishing.</p>
 <ContributionMessage state={state}/><button className="button primary" disabled={pending}>{pending?'Publishing…':'Publish change'}<ArrowRight size={16}/></button></form>;
}
export function VerifyForm({fixId,reportId}:{fixId:string;reportId:string}) {
 const {state,action,pending,evidenceKey,onReset}=useContributionForm();
 return <details className="verify-details"><summary>Tested this fix? Add your result<ArrowRight size={14}/></summary><form action={action} onReset={onReset} className={`stack-form ${styles.form}`} aria-busy={pending}>
 <input type="hidden" name="kind" value="verification"/><input type="hidden" name="fix_id" value={fixId}/><input type="hidden" name="return_report_id" value={reportId}/>
 <label>Result<select name="outcome"><option value="worked">Worked in my environment</option><option value="failed">Did not work in my environment</option></select></label>
 <label>Environment<input name="environment" required minLength={3} maxLength={2000} placeholder="Versions and runtime you tested"/></label>
 <label>What did you observe?<textarea name="notes" rows={3} required minLength={10} maxLength={10000} placeholder="Include the command or repeatable check you ran, expected behavior, and before / after output. Record failures and limits as well as successful results."/></label>
 <EvidenceFields key={evidenceKey} kind="verification"/>
 <p className={styles.publicNotice}>Results and observations are public. Remove secrets, private data, and proprietary code before publishing.</p>
 <ContributionMessage state={state}/><button className="button secondary" disabled={pending}>{pending?'Saving…':'Record result'}</button></form></details>;
}
export function CopyButton({value,label='Copy'}:{value:string;label?:string}) {
 const [copied,setCopied]=useState(false),[error,setError]=useState(false);
 return <button type="button" className="copy-button" onClick={async()=>{try{await navigator.clipboard.writeText(value);captureTelemetryCopy();setCopied(true);setError(false);setTimeout(()=>setCopied(false),2000);}catch{setError(true);}}}>{copied?<Check size={14}/>:<Copy size={14}/>} {error?'Select and copy manually':copied?'Copied':label}</button>;
}
export function KeyForm() {
 const [state,action,pending]=useActionState(createAgentKey,{});
 return <><form action={action} className="inline-form"><label className="sr-only" htmlFor="key-name">Key name</label><input id="key-name" name="name" placeholder="Key name, e.g. Claude Code on my laptop" required maxLength={80}/><button className="button primary" disabled={pending}><KeyRound size={15}/>{pending?'Creating…':'Create key'}</button></form>
 <Message state={state}/>{state.token&&<div className="token-result"><code>{state.token}</code><CopyButton value={state.token}/></div>}</>;
}
