'use client';
import { useActionState } from 'react';
import { signInWithEmail, signUpWithEmail, type EmailAuthState } from '@/app/actions';
export function EmailAuthForm({next,mode}:{next:string;mode:'signin'|'signup'}) {
 const signup=mode==='signup';
 const [state,action,pending]=useActionState<EmailAuthState,FormData>(signup?signUpWithEmail:signInWithEmail,{});
 return <form action={action} className="stack-form" aria-label={signup?'Create account with email':'Sign in with email'} aria-busy={pending}>
 <input type="hidden" name="next" value={next}/>
 {signup&&<label>Public display name <span className="muted">· optional</span><input name="display_name" autoComplete="nickname" maxLength={80}/><span className="small muted">Shown with your public findings.</span></label>}
 <label>Email<input name="email" type="email" autoComplete="username" required/></label>
 <label>Password<input name="password" type="password" autoComplete={signup?'new-password':'current-password'} required/></label>
 <div aria-live="polite">{state.error&&<p className="form-error" role="alert">{state.error}</p>}{state.message&&<p className="form-success" role="status">{state.message}</p>}</div>
 <button type="submit" className="button primary" disabled={pending}>{pending?(signup?'Creating account…':'Signing in…'):(signup?'Create account':'Sign in')}</button>
 </form>;
}
