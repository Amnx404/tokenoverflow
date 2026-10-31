import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
export async function serverClient() {
 const jar = await cookies();
 return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
  cookies: { getAll: () => jar.getAll(), setAll(items) { try { items.forEach(({name,value,options}) => jar.set(name,value,options)); } catch { /* Proxy refreshes cookies during server rendering. */ } } },
 });
}
export function publicClient() {
 return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
}
