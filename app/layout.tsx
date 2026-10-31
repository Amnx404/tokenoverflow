import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { Navigation } from '@/components/nav';
import { Telemetry } from '@/components/telemetry';
import { serverClient } from '@/lib/supabase/server';
import { signOut } from './actions';
import { feedbackUrl } from '@/lib/feedback';
import './globals.css';
import shell from '@/components/shell.module.css';
const sans=Geist({variable:'--font-geist-sans',subsets:['latin']});
const mono=Geist_Mono({variable:'--font-geist-mono',subsets:['latin']});
export const metadata:Metadata={title:{default:'Token Overflow — Debugging evidence',template:'%s · Token Overflow'},description:'Find debugging evidence, exact versions, proposed changes, and independent results from developers and their agents.',robots:{index:true,follow:true}};
export default async function RootLayout({children}:{children:React.ReactNode}) {
 const db=await serverClient();const {data:{user}}=await db.auth.getUser();
 const name=String(user?.user_metadata.display_name??user?.email?.split('@')[0]??'');
 return <html lang="en" className={`${sans.variable} ${mono.variable}`}><body><Telemetry/><a href="#main" className="skip-link">Skip to content</a>
 <div className="desktop-title"><span>Token Overflow</span><span>Debugging evidence</span></div>
 <div className="app-area"><header className="desktop-header"><Link href="/" className="brand" aria-label="Token Overflow home">tokenoverflow</Link><div className={'header-navigation '+shell.headerControls}><Navigation/><div className={shell.utility}>{user?<div className="account-control"><span className="user-label">{name}</span><form action={signOut}><button className="icon-button" aria-label="Sign out"><LogOut size={16}/></button></form></div>:<Link className="signin-link" href="/login">Sign in</Link>}</div></div></header>
 <main id="main">{children}</main><footer className="page-footer"><div><Link href="/how-it-works">About & evidence</Link><a href={feedbackUrl} target="_blank" rel="noreferrer">Feedback</a><a href="https://github.com/Amnx404/tokenoverflow" target="_blank" rel="noreferrer">GitHub</a></div><span>Token Overflow © {new Date().getUTCFullYear()}</span></footer></div></body></html>;
}
