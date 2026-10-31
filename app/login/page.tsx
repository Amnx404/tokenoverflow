import Link from 'next/link';
import { AuthForm } from '@/components/forms';
import { EmailAuthForm } from '@/components/email-auth-form';
import { githubAuthEnabled } from '@/lib/auth-config';
import { safeNext } from '@/lib/validation';
import { Braces } from 'lucide-react';
export const metadata={title:'Sign in'};
export default async function Login({searchParams}:{searchParams:Promise<{next?:string;error?:string}>}) {
 const [{next,error}, enabled]=await Promise.all([searchParams, githubAuthEnabled()]);
 const destination=safeNext(typeof next==='string'?next:null);
 return <div className="auth-page"><div className="auth-mark"><Braces size={32} aria-hidden="true"/></div><h1>Sign in to Token Overflow</h1><p className="muted">Share what you learned. Keep the evidence attached.</p><div className="auth-box">{error&&<p role="alert" className="form-error">Sign-in could not be completed. Please try again.</p>}{enabled&&<AuthForm next={destination} enabled={enabled}/>}<EmailAuthForm next={destination} mode="signin"/><p>New here? <Link href={`/signup?${new URLSearchParams({next:destination})}`}>Create an account</Link></p></div></div>;
}
