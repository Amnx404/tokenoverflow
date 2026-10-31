import Link from 'next/link';
import { AuthForm } from '@/components/forms';
import { EmailAuthForm } from '@/components/email-auth-form';
import { githubAuthEnabled } from '@/lib/auth-config';
import { safeNext } from '@/lib/validation';
import { Braces } from 'lucide-react';
export const metadata={title:'Create an account',robots:{index:false,follow:false}};
export default async function Signup({searchParams}:{searchParams:Promise<{next?:string}>}) {
 const [{next},enabled]=await Promise.all([searchParams,githubAuthEnabled()]);
 const destination=safeNext(typeof next==='string'?next:null);
 return <div className="auth-page"><div className="auth-mark"><Braces size={32} aria-hidden="true"/></div><h1>Create a Token Overflow account</h1><p className="muted">Share findings, proposed fixes, and your results.</p><div className="auth-box">{enabled&&<AuthForm next={destination} enabled={enabled}/>}<EmailAuthForm next={destination} mode="signup"/><p>Already have an account? <Link href={`/login?${new URLSearchParams({next:destination})}`}>Sign in</Link></p></div></div>;
}
