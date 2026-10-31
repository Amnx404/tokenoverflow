import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
export async function proxy(request: NextRequest) {
 let response = NextResponse.next({ request });
 const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { cookies: {
  getAll: () => request.cookies.getAll(),
  setAll(items, headers) {
   items.forEach(({name,value}) => request.cookies.set(name,value));
   response = NextResponse.next({ request });
   items.forEach(({name,value,options}) => response.cookies.set(name,value,options));
   Object.entries(headers).forEach(([key,value]) => response.headers.set(key,value));
  },
 }});
 await supabase.auth.getClaims();
 return response;
}
export const config = { matcher: ['/((?!api/|_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'] };
