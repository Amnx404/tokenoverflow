import { startAuthTelemetry } from '@/lib/telemetry-server';
import { NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase/server';
import { authSiteOrigin } from '@/lib/auth-config';
import { safeNext } from '@/lib/validation';
export async function GET(request:Request) {
 const telemetry=await startAuthTelemetry('email_confirm');
 let authStatus:'input_rejected'|'provider_rejected'|'session_unverified'|'unavailable'='input_rejected';
 const url=new URL(request.url),hash=url.searchParams.get('token_hash'),type=url.searchParams.get('type');
 const origin=authSiteOrigin(),next=safeNext(url.searchParams.get('next'));
 if(hash&&(type==='email'||type==='signup')&&!url.searchParams.has('error')) {
  try {
   const db=await serverClient();
   const {data,error}=await db.auth.verifyOtp({token_hash:hash,type});
   if(!error&&data.session) { telemetry.finish('session_returned'); return NextResponse.redirect(new URL(next,origin),{headers:{'Cache-Control':'no-store'}}); }
   authStatus=error?'provider_rejected':'session_unverified';
  } catch { authStatus='unavailable'; /* Fail closed without exposing token or provider details. */ }
 }
 telemetry.finish(authStatus);
 const retry=new URL('/login',origin);
 retry.searchParams.set('error','confirmation');
 retry.searchParams.set('next',next);
 return NextResponse.redirect(retry,{headers:{'Cache-Control':'no-store'}});
}
