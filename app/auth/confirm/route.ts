import { NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/validation';
export async function GET(request:Request){const url=new URL(request.url),hash=url.searchParams.get('token_hash'),type=url.searchParams.get('type');if(hash&&type==='signup'){const db=await serverClient();const {error}=await db.auth.verifyOtp({token_hash:hash,type:'signup'});if(!error)return NextResponse.redirect(new URL(safeNext(url.searchParams.get('next')),url.origin));}return NextResponse.redirect(new URL('/login?error=confirmation',url.origin));}
