import { NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase/server';
import { authSiteOrigin } from '@/lib/auth-config';
import { safeNext } from '@/lib/validation';

export async function GET(request:Request) {
 const url=new URL(request.url), code=url.searchParams.get('code');
 const origin=authSiteOrigin();
 if(code && !url.searchParams.has('error')) {
  const db=await serverClient();
  const {error}=await db.auth.exchangeCodeForSession(code);
  if(!error) return NextResponse.redirect(new URL(safeNext(url.searchParams.get('next')),origin),{headers:{'Cache-Control':'no-store'}});
 }
 const retry=new URL('/login',origin);
 retry.searchParams.set('error','oauth');
 retry.searchParams.set('next',safeNext(url.searchParams.get('next')));
 return NextResponse.redirect(retry,{headers:{'Cache-Control':'no-store'}});
}
