import { NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase/server';
import { authSiteOrigin } from '@/lib/auth-config';
import { safeNext } from '@/lib/validation';
export async function GET(request:Request) {
 const url=new URL(request.url),hash=url.searchParams.get('token_hash'),type=url.searchParams.get('type');
 const origin=authSiteOrigin(),next=safeNext(url.searchParams.get('next'));
 if(hash&&(type==='email'||type==='signup')&&!url.searchParams.has('error')) {
  try {
   const db=await serverClient();
   const {data,error}=await db.auth.verifyOtp({token_hash:hash,type});
   if(!error&&data.session) return NextResponse.redirect(new URL(next,origin),{headers:{'Cache-Control':'no-store'}});
  } catch { /* Fail closed without exposing token or provider details. */ }
 }
 const retry=new URL('/login',origin);
 retry.searchParams.set('error','confirmation');
 retry.searchParams.set('next',next);
 return NextResponse.redirect(retry,{headers:{'Cache-Control':'no-store'}});
}
