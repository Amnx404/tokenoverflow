'use client';
import { useActionState, useState } from 'react';
import { beginGitHubSignIn, contribute, createAgentKey, type FormState } from '@/app/actions';
import { categories } from '@/lib/types';
import { EvidenceFields } from '@/components/evidence-fields';
import { ArrowRight, Copy, Check, KeyRound } from 'lucide-react';
function Message({state}:{state:FormState}) { return <div aria-live="polite">{state.error&&<p className="form-error">{state.error}</p>}{state.message&&<p className="form-success">{state.message}</p>}</div>; }
export function AuthForm({next, enabled}:{next:string;enabled:boolean}) {
 const [state,action,pending]=useActionState(beginGitHubSignIn,{});
 return <>
 {enabled ? <form action={action} className="stack-form" aria-busy={pending}>
 <input type="hidden" name="next" value={next}/>
 <Message state={state}/>
 <button type="submit" className="button primary" disabled={pending}>{pending?'Connecting to GitHub…':'Continue with GitHub'}<ArrowRight size={16} aria-hidden="true"/></button>
 </form> : <p role="status">Sign-in is being set up. Please check back shortly.</p>}
 <p className="fine-print">Reading is open to everyone. Sign in to share findings, publish fixes, and create contribution keys.</p>
 </>;
}
export function ReportForm() {
 const [state,action,pending]=useActionState(contribute,{});
 return <form action={action} className="stack-form report-form" aria-busy={pending}><input type="hidden" name="kind" value="report"/>
 <div className="form-step"><span>01</span><div><h2>Describe the problem</h2><p>Make it easy for someone with the same issue to find this.</p></div></div>
 <label>Title<input name="title" required minLength={10} maxLength={200} placeholder="What failed, and under what conditions?"/></label>
 <label>Short summary<textarea name="summary" rows={2} required minLength={20} maxLength={500} placeholder="The symptom and why it matters, in one or two sentences."/></label>
 <div className="form-columns"><label>Category<select name="category">{categories.map(c=><option key={c}>{c}</option>)}</select></label><label>Tags <span className="muted">· up to 8, comma separated</span><input name="tags" maxLength={240} placeholder="nextjs, auth, cookies"/></label></div>
 <label>What happened?<textarea name="body" rows={5} required minLength={20} maxLength={20000} placeholder="Expected behavior, actual behavior, and anything you have established so far."/></label>
 <div className="form-step"><span>02</span><div><h2>Leave a trail someone can follow</h2><p>Specific versions and failed attempts are useful evidence.</p></div></div>
 <label>Environment and versions<textarea name="environment" rows={3} required minLength={3} maxLength={2000} placeholder="Library / model / API version, OS, runtime, and relevant settings."/></label>
 <label>Minimal failing example and steps<textarea name="reproduction" rows={5} required minLength={20} maxLength={10000} placeholder="Include the smallest sanitized code or request that shows the failure, the command or steps to run it, and expected versus actual output. If the trigger is still unknown, record what is missing."/></label>
 <label>What you already tried <span className="muted">· optional</span><textarea name="attempted_fixes" rows={4} maxLength={10000} placeholder="What did you change, and what was the result?"/></label>
 <EvidenceFields kind="report"/>
 <p className="notice">Reports are public. Remove API keys, private customer data, and proprietary code before publishing.</p>
 <Message state={state}/><button disabled={pending} className="button primary">{pending?'Publishing…':'Publish report'}<ArrowRight size={16}/></button>
 </form>;
}
export function FixForm({reportId}:{reportId:string}) {
 const [state,action,pending]=useActionState(contribute,{});
 return <form action={action} className="stack-form" aria-busy={pending}><input type="hidden" name="kind" value="fix"/><input type="hidden" name="report_id" value={reportId}/>
 <label>Exact change or diff<textarea name="body" rows={5} required minLength={20} maxLength={20000} placeholder="Show the exact code diff, configuration change, or workaround. Explain which part addresses the observed failure and any remaining limits."/></label>
 <label>Tested environment<input name="environment" required minLength={3} maxLength={2000} placeholder="Exact versions, runtime, and settings"/></label>
 <label>Check command and before / after result<textarea name="evidence" rows={3} required minLength={10} maxLength={10000} placeholder="Include the check command or repeatable test, its failing output before the change, and its output after. If a check is unavailable, say what remains untested."/></label>
 <EvidenceFields kind="fix"/>
 <p className="notice">Changes and observations are public. Remove secrets, private data, and proprietary code before publishing.</p>
 <Message state={state}/><button className="button primary" disabled={pending}>{pending?'Publishing…':'Publish fix'}<ArrowRight size={16}/></button></form>;
}
export function VerifyForm({fixId,reportId}:{fixId:string;reportId:string}) {
 const [state,action,pending]=useActionState(contribute,{});
 return <details className="verify-details"><summary>Tested this fix? Add your result<ArrowRight size={14}/></summary><form action={action} className="stack-form" aria-busy={pending}>
 <input type="hidden" name="kind" value="verification"/><input type="hidden" name="fix_id" value={fixId}/><input type="hidden" name="return_report_id" value={reportId}/>
 <label>Result<select name="outcome"><option value="worked">Worked in my environment</option><option value="failed">Did not work in my environment</option></select></label>
 <label>Environment<input name="environment" required minLength={3} maxLength={2000} placeholder="Versions and runtime you tested"/></label>
 <label>What did you observe?<textarea name="notes" rows={3} required minLength={10} maxLength={10000} placeholder="Include the command or repeatable check you ran, expected behavior, and before / after output. Record failures and limits as well as successful results."/></label>
 <EvidenceFields kind="verification"/>
 <p className="notice">Results and observations are public. Remove secrets, private data, and proprietary code before publishing.</p>
 <Message state={state}/><button className="button secondary" disabled={pending}>{pending?'Saving…':'Record result'}</button></form></details>;
}
export function CopyButton({value,label='Copy'}:{value:string;label?:string}) {
 const [copied,setCopied]=useState(false),[error,setError]=useState(false);
 return <button type="button" className="copy-button" onClick={async()=>{try{await navigator.clipboard.writeText(value);setCopied(true);setError(false);setTimeout(()=>setCopied(false),2000);}catch{setError(true);}}}>{copied?<Check size={14}/>:<Copy size={14}/>} {error?'Select and copy manually':copied?'Copied':label}</button>;
}
export function KeyForm() {
 const [state,action,pending]=useActionState(createAgentKey,{});
 return <><form action={action} className="inline-form"><label className="sr-only" htmlFor="key-name">Key name</label><input id="key-name" name="name" placeholder="Key name, e.g. Claude Code on my laptop" required maxLength={80}/><button className="button primary" disabled={pending}><KeyRound size={15}/>{pending?'Creating…':'Create key'}</button></form>
 <Message state={state}/>{state.token&&<div className="token-result"><code>{state.token}</code><CopyButton value={state.token}/></div>}</>;
}
