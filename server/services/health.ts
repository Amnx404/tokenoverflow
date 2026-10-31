import 'server-only';
import { publicClient } from '@/lib/supabase/server';
import { databaseMode, withDatabase } from '@/server/db';
import { reports } from '@/server/db/schema';

let cached: {ok:boolean;expires:number}|undefined;
let pending:Promise<boolean>|undefined;
export function hasPublicServiceConfiguration() {
 return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
}

// Empty data is healthy. One anonymous primary-table row avoids counts/full feeds.
// Cache per warm process and coalesce concurrent probes; no new infrastructure.
export async function backendHealthy():Promise<boolean> {
 if(!hasPublicServiceConfiguration())return false;
 if(cached && cached.expires>Date.now())return cached.ok;
 if(!pending) {
  pending=(async()=>{
   try {
    if(databaseMode()==='drizzle')await withDatabase(tx=>tx.select({id:reports.id}).from(reports).limit(1));
    else {
     const {error}=await publicClient().from('reports').select('id').limit(1);
     if(error)return false;
    }
    return true;
   }catch{return false;}
  })().then(ok=>{cached={ok,expires:Date.now()+15000};return ok;}).finally(()=>{pending=undefined;});
 }
 return pending;
}
