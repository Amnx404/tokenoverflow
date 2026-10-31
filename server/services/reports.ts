import 'server-only';
import { and, asc, count, desc, eq, gt, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { publicClient } from '@/lib/supabase/server';
import type { FullReport, Fix, Report } from '@/lib/types';
import { databaseMode, withDatabase } from '@/server/db';
import { fixes, reportFeed, reports, verifications } from '@/server/db/schema';

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
    let query=q?db.rpc('search_reports',{p_query:q},{count:'exact'}).select('*').eq('is_example',examples):db.from('report_feed').select('*',{count:'exact'}).eq('is_example',examples);
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
    const rows=await tx.select().from(reportFeed).where(where).orderBy(desc(reportFeed.created_at),asc(reportFeed.id)).offset((page-1)*20).limit(20);
    const [total]=await tx.select({value:count()}).from(reportFeed).where(where);
    return {reports:rows.map(publicReportSummary),count:total.value};
  });
}
export async function getReport(id:string):Promise<{report:FullReport;fixes:Fix[]}|null> {
  z.uuid().parse(id);
  if(databaseMode()==='supabase-data-api') {
    const db=publicClient();
    const [r,f,feed]=await Promise.all([
      db.from('reports').select('*').eq('id',id).maybeSingle(),
      db.from('fixes').select('*,verifications(*)').eq('report_id',id).order('created_at').order('id'),
      db.from('report_feed').select('*').eq('id',id).maybeSingle(),
    ]);
    if(r.error||f.error||feed.error) throw r.error??f.error??feed.error;
    if(!r.data) return null;
    return {report:{...r.data,...feed.data} as FullReport,fixes:(f.data??[]) as Fix[]};
  }
  return withDatabase(async tx=>{
    const [entry]=await tx.select().from(reports).where(eq(reports.id,id));
    if(!entry) return null;
    const [feed]=await tx.select().from(reportFeed).where(eq(reportFeed.id,id));
    const foundFixes=await tx.select().from(fixes).where(eq(fixes.report_id,id)).orderBy(asc(fixes.created_at),asc(fixes.id));
    const results=foundFixes.length?await tx.select().from(verifications).where(inArray(verifications.fix_id,foundFixes.map(f=>f.id))).orderBy(asc(verifications.created_at),asc(verifications.id)):[];
    return {report:{...entry,...feed},fixes:foundFixes.map(f=>({...f,verifications:results.filter(v=>v.fix_id===f.id)}))};
  });
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
export async function getExampleReport():Promise<Report|null> {
  return (await listReports({examples:true})).reports[0]??null;
}
