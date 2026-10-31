import 'server-only';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './schema';
import { assertIdentity, type Identity } from '@/server/services/auth';

export function databaseMode(): 'drizzle'|'supabase-data-api' {
  return process.env.DATABASE_URL ? 'drizzle' : 'supabase-data-api';
}
let database: ReturnType<typeof drizzle<typeof schema>> | undefined;
function getDatabase() {
  if(!database) {
    if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured.');
    const url=new URL(process.env.DATABASE_URL);
    const login=decodeURIComponent(url.username).split('.')[0];
    if(['postgres','service_role','supabase_admin'].includes(login)) throw new Error('Use the least-privilege application database role.');
    database=drizzle(postgres(process.env.DATABASE_URL,{prepare:false,max:1,ssl:'require',idle_timeout:20,connect_timeout:10}),{schema});
  }
  return database;
}
export type DatabaseTransaction = Parameters<Parameters<ReturnType<typeof getDatabase>['transaction']>[0]>[0];
export async function withDatabase<T>(run:(tx:DatabaseTransaction)=>Promise<T>,identity?:Identity):Promise<T> {
  if(identity) assertIdentity(identity);
  return getDatabase().transaction(async tx=>{
    const [login]=await tx.execute<{unsafe:boolean}>(sql`select (rolsuper or rolbypassrls or rolinherit or rolcreatedb or rolcreaterole or rolreplication) as unsafe from pg_roles where rolname=session_user`);
    if(!login || login.unsafe) throw new Error('Database login must use the restricted NOINHERIT application role.');
    // Fixed roles and transaction-local settings cannot leak between pooled requests.
    if(identity) await tx.execute(sql`set local role authenticated`);
    else await tx.execute(sql`set local role anon`);
    const sub=identity?.user.id ?? '';
    const claims=JSON.stringify(identity?{sub,role:'authenticated'}:{role:'anon'});
    await tx.execute(sql`select set_config('request.jwt.claims',${claims},true), set_config('request.jwt.claim.sub',${sub},true)`);
    return run(tx);
  });
}
