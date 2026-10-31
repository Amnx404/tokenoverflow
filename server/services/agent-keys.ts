import 'server-only';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { AgentKey } from '@/lib/types';
import { databaseMode,withDatabase } from '@/server/db';
import { assertIdentity,type Identity } from './auth';
import { databaseError } from './errors';

export async function listAgentKeys(identity:Identity):Promise<AgentKey[]> {
  assertIdentity(identity);
  if(databaseMode()==='supabase-data-api') {
    const {data,error}=await identity.client.rpc('list_agent_keys');
    if(error) databaseError(error);
    return (data??[]) as AgentKey[];
  }
  return withDatabase(async tx=>{
    const [row]=await tx.execute<{keys:AgentKey[]}>(sql`select public.list_agent_keys() as keys`);
    return row.keys;
  },identity);
}
export async function createAgentKey(identity:Identity,name:string):Promise<{id:string;token:string}> {
  assertIdentity(identity);
  name=z.string().trim().min(1).max(80).parse(name);
  try {
    if(databaseMode()==='supabase-data-api') {
      const {data,error}=await identity.client.rpc('create_agent_key',{p_name:name});
      if(error) throw error;
      return data as {id:string;token:string};
    }
    return await withDatabase(async tx=>{
      const [row]=await tx.execute<{key:{id:string;token:string}}>(sql`select public.create_agent_key(${name}) as key`);
      return row.key;
    },identity);
  } catch(error) { return databaseError(error); }
}
export async function revokeAgentKey(identity:Identity,id:string):Promise<boolean> {
  assertIdentity(identity);
  z.uuid().parse(id);
  try {
    if(databaseMode()==='supabase-data-api') {
      const {data,error}=await identity.client.rpc('revoke_agent_key',{p_id:id});
      if(error) throw error;
      return data as boolean;
    }
    return await withDatabase(async tx=>{
      const [row]=await tx.execute<{revoked:boolean}>(sql`select public.revoke_agent_key(${id}::uuid) as revoked`);
      return row.revoked;
    },identity);
  } catch(error) { return databaseError(error); }
}
