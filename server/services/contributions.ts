import 'server-only';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { publicClient } from '@/lib/supabase/server';
import { reportSchema,fixSchema,verificationSchema } from '@/lib/validation';
import { databaseMode,withDatabase } from '@/server/db';
import { assertIdentity,type Identity } from './auth';
import { databaseError, ServiceError } from './errors';

export const APPLICATION_BUNDLE_MAX_BYTES = 12_288;
export const APPLICATION_CONTRIBUTION_MAX_BYTES = 60_000;
// Apply after shared parsing/normalization and identity attribution, before any DB work.
function assertContributionBytes(data:{evidence_bundle?:unknown}) {
  const bytes=(value:unknown)=>new TextEncoder().encode(JSON.stringify(value)).byteLength;
  if(data.evidence_bundle !== undefined && bytes(data.evidence_bundle)>APPLICATION_BUNDLE_MAX_BYTES) {
    throw new ServiceError('PAYLOAD_TOO_LARGE','Evidence bundle too large (12,288 UTF-8 bytes maximum).');
  }
  if(bytes(data)>APPLICATION_CONTRIBUTION_MAX_BYTES) {
    throw new ServiceError('PAYLOAD_TOO_LARGE','Contribution too large (60,000 UTF-8 bytes maximum).');
  }
}

export type ContributionKind='report'|'fix'|'verification';
export async function createReport(identity:Identity,input:unknown) { return createContribution(identity,'report',input); }
export async function createFix(identity:Identity,input:unknown) { return createContribution(identity,'fix',input); }
export async function createVerification(identity:Identity,input:unknown) { return createContribution(identity,'verification',input); }
async function createContribution(identity:Identity,kind:ContributionKind,input:unknown):Promise<{id:string}> {
  assertIdentity(identity);
  const author_name=String(identity.user.user_metadata.display_name??identity.user.email?.split('@')[0]??'Contributor').slice(0,80);
  const value={...(typeof input==='object'&&input?input:{}),author_name};
  const schema=kind==='report'?reportSchema:kind==='fix'?fixSchema:verificationSchema;
  const data=schema.parse(value);
  assertContributionBytes(data);
  try {
    if(databaseMode()==='supabase-data-api') {
      const {data:row,error}=await identity.client.from(kind==='report'?'reports':kind==='fix'?'fixes':'verifications').insert({...data,author_id:identity.user.id}).select('id').single();
      if(error) throw error;
      return {id:row.id as string};
    }
    return await withDatabase(async tx=>{
      // SQL lists only explicitly writable columns. Drizzle's table insert builder
      // also emits DEFAULT for omitted columns, which would require forbidden
      // INSERT privileges on is_example/created_at under the existing grants.
      if(kind==='report') {
        const d=reportSchema.parse(value);
        const column=d.evidence_bundle===undefined?sql``:sql`,evidence_bundle`;
        const bundle=d.evidence_bundle===undefined?sql``:sql`,${JSON.stringify(d.evidence_bundle)}::jsonb`;
        const [row]=await tx.execute<{id:string}>(sql`insert into public.reports(author_id,author_name,title,summary,body,environment,reproduction,attempted_fixes,category,tags${column}) values (${identity.user.id}::uuid,${d.author_name},${d.title},${d.summary},${d.body},${d.environment},${d.reproduction},${d.attempted_fixes},${d.category},array(select jsonb_array_elements_text(${JSON.stringify(d.tags)}::jsonb))${bundle}) returning id`);
        return {id:row.id};
      }
      if(kind==='fix') {
        const d=fixSchema.parse(value);
        const column=d.evidence_bundle===undefined?sql``:sql`,evidence_bundle`;
        const bundle=d.evidence_bundle===undefined?sql``:sql`,${JSON.stringify(d.evidence_bundle)}::jsonb`;
        const [row]=await tx.execute<{id:string}>(sql`insert into public.fixes(report_id,author_id,author_name,body,environment,evidence${column}) values (${d.report_id}::uuid,${identity.user.id}::uuid,${d.author_name},${d.body},${d.environment},${d.evidence}${bundle}) returning id`);
        return {id:row.id};
      }
      const d=verificationSchema.parse(value);
      const column=d.evidence_bundle===undefined?sql``:sql`,evidence_bundle`;
      const bundle=d.evidence_bundle===undefined?sql``:sql`,${JSON.stringify(d.evidence_bundle)}::jsonb`;
      const [row]=await tx.execute<{id:string}>(sql`insert into public.verifications(fix_id,author_id,author_name,outcome,environment,notes${column}) values (${d.fix_id}::uuid,${identity.user.id}::uuid,${d.author_name},${d.outcome},${d.environment},${d.notes}${bundle}) returning id`);
      return {id:row.id};
    },identity);
  } catch(error) { return databaseError(error); }
}
export async function publishAgentContribution(token:string,kind:ContributionKind,input:unknown):Promise<{id:string}> {
  z.string().regex(/^to_[a-f0-9]{64}$/).parse(token);
  z.enum(['report','fix','verification']).parse(kind);
  const data=(kind==='report'?reportSchema:kind==='fix'?fixSchema:verificationSchema).parse(input);
  assertContributionBytes(data);
  try {
    if(databaseMode()==='supabase-data-api') {
      const {data:id,error}=await publicClient().rpc('agent_contribute',{p_key:token,p_kind:kind,p_data:data});
      if(error) throw error;
      return {id:id as string};
    }
    return await withDatabase(async tx=>{
      // Retain the audited hash lookup, revocation, expiry, independent-result
      // checks and per-account limit in the existing private security-definer routine.
      const [row]=await tx.execute<{id:string}>(sql`select public.agent_contribute(${token},${kind},${JSON.stringify(data)}::jsonb) as id`);
      return {id:row.id};
    });
  } catch(error) { return databaseError(error); }
}
