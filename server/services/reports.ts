import 'server-only';
import { and, asc, count, desc, eq, gt, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { publicClient } from '@/lib/supabase/server';
import type { FullReport, Fix, Report } from '@/lib/types';
import { databaseMode, withDatabase } from '@/server/db';
import { fixes, reportFeed, reports, verifications } from '@/server/db/schema';
import { assertIdentity, type Identity } from './auth';
import { databaseError } from './errors';

// Explicit columns work before and after the staged removal of account-ID grants.
const feedFields={id:reportFeed.id,author_name:reportFeed.author_name,title:reportFeed.title,summary:reportFeed.summary,environment:reportFeed.environment,category:reportFeed.category,tags:reportFeed.tags,is_example:reportFeed.is_example,created_at:reportFeed.created_at,fix_count:reportFeed.fix_count,worked_count:reportFeed.worked_count,failed_count:reportFeed.failed_count};
const reportFields={id:reports.id,author_name:reports.author_name,title:reports.title,summary:reports.summary,body:reports.body,environment:reports.environment,reproduction:reports.reproduction,attempted_fixes:reports.attempted_fixes,category:reports.category,tags:reports.tags,is_example:reports.is_example,created_at:reports.created_at,evidence_bundle:reports.evidence_bundle};
const fixFields={id:fixes.id,report_id:fixes.report_id,author_name:fixes.author_name,body:fixes.body,environment:fixes.environment,evidence:fixes.evidence,created_at:fixes.created_at,evidence_bundle:fixes.evidence_bundle};
const verificationFields={id:verifications.id,fix_id:verifications.fix_id,author_name:verifications.author_name,outcome:verifications.outcome,environment:verifications.environment,notes:verifications.notes,created_at:verifications.created_at,evidence_bundle:verifications.evidence_bundle};
const feedSelect='id,author_name,title,summary,environment,category,tags,is_example,created_at,fix_count,worked_count,failed_count';
const reportSelect='id,author_name,title,summary,body,environment,reproduction,attempted_fixes,category,tags,is_example,created_at,evidence_bundle';
const verificationSelect='id,fix_id,author_name,outcome,environment,notes,created_at,evidence_bundle';
const fixSelect=`id,report_id,author_name,body,environment,evidence,created_at,evidence_bundle,verifications(${verificationSelect})`;

// Public feeds carry evidence and display attribution, never account/key identifiers.
function publicReportSummary(row:Report):Report {
  return {id:row.id,author_name:row.author_name,title:row.title,summary:row.summary,
    environment:row.environment,category:row.category,tags:row.tags,is_example:row.is_example,
    created_at:row.created_at,fix_count:row.fix_count,worked_count:row.worked_count,failed_count:row.failed_count};
}
export type ReportFilters={q?:string;category?:string;view?:string;page?:number;examples?:boolean};
export async function listReports({q='',category='',view='',page=1,examples=false}:ReportFilters={}) {
  page=Number.isSafeInteger(page)?Math.max(1,page):1;
  q=q.trim().slice(0,300);
  if(databaseMode()==='supabase-data-api') {
    const db=publicClient();
    let query=q?db.rpc('search_reports',{p_query:q},{count:'exact'}).select(feedSelect).eq('is_example',examples):db.from('report_feed').select(feedSelect,{count:'exact'}).eq('is_example',examples);
    if(category) query=query.eq('category',category);
    if(view==='needs-investigation') query=query.eq('fix_count',0);
    if(view==='reproduced') query=query.gt('worked_count',0);
    const {data,error,count:total}=await query.order('created_at',{ascending:false}).order('id').range((page-1)*20,page*20-1);
    if(error) throw error;
    return {reports:((data??[]) as Report[]).map(publicReportSummary),count:total??0};
  }
  return withDatabase(async tx=>{
    const conditions=[eq(reportFeed.is_example,examples)];
    if(category) conditions.push(eq(reportFeed.category,category));
    if(view==='needs-investigation') conditions.push(eq(reportFeed.fix_count,0));
    if(view==='reproduced') conditions.push(gt(reportFeed.worked_count,0));
    if(q) conditions.push(sql`exists (select 1 from public.search_reports(${q}) search where search.id=${reportFeed.id})`);
    const where=and(...conditions);
    const rows=await tx.select(feedFields).from(reportFeed).where(where).orderBy(desc(reportFeed.created_at),asc(reportFeed.id)).offset((page-1)*20).limit(20);
    const [total]=await tx.select({value:count()}).from(reportFeed).where(where);
    return {reports:rows.map(publicReportSummary),count:total.value};
  });
}
export async function getReport(id:string):Promise<{report:FullReport;fixes:Fix[]}|null> {
  z.uuid().parse(id);
  if(databaseMode()==='supabase-data-api') {
    const db=publicClient();
    const [r,f,feed]=await Promise.all([
      db.from('reports').select(reportSelect).eq('id',id).maybeSingle(),
      db.from('fixes').select(fixSelect).eq('report_id',id).order('created_at').order('id'),
      db.from('report_feed').select(feedSelect).eq('id',id).maybeSingle(),
    ]);
    if(r.error||f.error||feed.error) throw r.error??f.error??feed.error;
    if(!r.data) return null;
    return {report:{...r.data,...feed.data} as FullReport,fixes:(f.data??[]) as Fix[]};
  }
  return withDatabase(async tx=>{
    const [entry]=await tx.select(reportFields).from(reports).where(eq(reports.id,id));
    if(!entry) return null;
    const [feed]=await tx.select(feedFields).from(reportFeed).where(eq(reportFeed.id,id));
    const foundFixes=await tx.select(fixFields).from(fixes).where(eq(fixes.report_id,id)).orderBy(asc(fixes.created_at),asc(fixes.id));
    const results=foundFixes.length?await tx.select(verificationFields).from(verifications).where(inArray(verifications.fix_id,foundFixes.map(f=>f.id))).orderBy(asc(verifications.created_at),asc(verifications.id)):[];
    return {report:{...entry,...feed},fixes:foundFixes.map(f=>({...f,verifications:results.filter(v=>v.fix_id===f.id)}))};
  });
}
// Resolve ownership only in a fresh, verified identity context. The database
// returns public fix IDs and one boolean, never an account ID or caller-chosen user.
export async function getFixOwnership(identity:Identity,reportId:string):Promise<Set<string>> {
  assertIdentity(identity);
  z.uuid().parse(reportId);
  try {
    let rows:unknown;
    if(databaseMode()==='supabase-data-api') {
      const {data,error}=await identity.client.rpc('fix_ownership',{p_report_id:reportId});
      if(error) throw error;
      rows=data;
    } else {
      rows=await withDatabase(tx=>tx.execute<{id:string;is_own_fix:boolean}>(sql`select id,is_own_fix from public.fix_ownership(${reportId}::uuid)`),identity);
    }
    const parsed=z.array(z.object({id:z.uuid(),is_own_fix:z.boolean()})).safeParse(rows);
    if(!parsed.success) throw new Error('Could not resolve fix ownership.');
    return new Set(parsed.data.filter(row=>row.is_own_fix).map(row=>row.id));
  } catch(error) { return databaseError(error); }
}
export async function getCommunityStats() {
  if(databaseMode()==='supabase-data-api') {
    const db=publicClient();
    const [r,f,v]=await Promise.all([
      db.from('reports').select('id',{count:'exact',head:true}).eq('is_example',false),
      db.from('fixes').select('id',{count:'exact',head:true}),db.from('verifications').select('id',{count:'exact',head:true}),
    ]);
    if(r.error||f.error||v.error) throw r.error??f.error??v.error;
    return {reports:r.count??0,fixes:f.count??0,verifications:v.count??0};
  }
  return withDatabase(async tx=>{
    const [r]=await tx.select({value:count()}).from(reports).where(eq(reports.is_example,false));
    const [f]=await tx.select({value:count()}).from(fixes);
    const [v]=await tx.select({value:count()}).from(verifications);
    return {reports:r.value,fixes:f.value,verifications:v.value};
  });
}
export async function getExampleReportId():Promise<string|null> {
  if(databaseMode()==='supabase-data-api') {
    const {data,error}=await publicClient().from('reports').select('id').eq('is_example',true).order('created_at',{ascending:false}).order('id',{ascending:true}).limit(1);
    if(error) throw error;
    return data?.[0]?.id??null;
  }
  return withDatabase(async tx=>{
    const [example]=await tx.select({id:reports.id}).from(reports).where(eq(reports.is_example,true)).orderBy(desc(reports.created_at),asc(reports.id)).limit(1);
    return example?.id??null;
  });
}
