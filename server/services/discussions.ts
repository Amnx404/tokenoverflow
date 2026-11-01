import 'server-only';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { publicClient } from '@/lib/supabase/server';
import { databaseMode,withDatabase } from '@/server/db';
import { appendDiscussionSchema,redactDiscussionSchema,discussionPageSchema,discussionContextSchema,discussionCursorSchema,publicDiscussionSchema } from '@/lib/discussion-validation';
import type { PublicDiscussionComment,DiscussionPage,DiscussionContext,DiscussionReceipt } from '@/lib/discussion-types';
import { assertWebDiscussionActor,type VerifiedWebDiscussionActor } from './discussion-actor';
import { DiscussionError,discussionFailure } from './discussion-errors';
const timestamp=z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
const savedSchema=z.object({id:z.uuid(),report_id:z.uuid(),parent_id:z.uuid().nullable(),root_id:z.uuid(),depth:z.number().int().min(0).max(8),created_at:timestamp,redacted_at:timestamp.nullable()});
function comment(value:unknown):PublicDiscussionComment{const v=publicDiscussionSchema.parse(value);return {id:v.id,report_id:v.report_id,parent_id:v.parent_id,root_id:v.root_id,depth:v.depth,author_name:v.author_name,body:v.body,created_at:v.created_at,redacted_at:v.redacted_at};}
function ancestors(value:unknown,reportId:string,target:PublicDiscussionComment|null):PublicDiscussionComment[]{
 const rows=z.array(z.unknown()).max(8).parse(value).map(comment);
 if(!target){if(rows.length)throw new DiscussionError(500);return [];}
 if(rows.length!==target.depth||rows.some((row,index)=>row.report_id!==reportId||row.depth!==index||row.root_id!==target.root_id||row.parent_id!==(index?rows[index-1].id:null))||target.parent_id!==(rows.at(-1)?.id??null))throw new DiscussionError(500);
 return rows;
}
function receipt(value:unknown,requestId?:string):DiscussionReceipt{const row=savedSchema.parse(value);return {...(requestId?{request_id:requestId}:{}),id:row.id,report_id:row.report_id,parent_id:row.parent_id,root_id:row.root_id,depth:row.depth,created_at:row.created_at,redacted_at:row.redacted_at,url:`/reports/${row.report_id}?comment=${row.id}#comment-${row.id}`};}
// Both adapters invoke exactly the same public routines; only adapter transport differs.
async function call(name:string,args:Record<string,unknown>,statement:ReturnType<typeof sql>,actor?:VerifiedWebDiscussionActor):Promise<unknown>{
 try{
  if(actor)assertWebDiscussionActor(actor);
  if(databaseMode()==='supabase-data-api'){
   const client=actor?actor.identity.client:publicClient();const {data,error}=await client.rpc(name,args);if(error)throw error;return data;
  }
  return await withDatabase(async tx=>{const rows=await tx.execute<{result:unknown}>(statement);return rows[0]?.result;},actor?.identity);
 }catch(error){throw discussionFailure(error);}
}
export async function appendDiscussionComment(actor:VerifiedWebDiscussionActor,input:unknown):Promise<DiscussionReceipt>{
 assertWebDiscussionActor(actor);const v=appendDiscussionSchema.parse(input);
 const result=await call('append_discussion_comment',{p_report_id:v.report_id,p_parent_id:v.parent_id,p_request_id:v.request_id,p_body:v.body},sql`select public.append_discussion_comment(${v.report_id}::uuid,${v.parent_id}::uuid,${v.request_id}::uuid,${JSON.stringify(v.body)}::jsonb) as result`,actor);
 try{const saved=receipt(result,v.request_id);if(saved.report_id!==v.report_id||saved.parent_id!==v.parent_id)throw new DiscussionError(500);return saved;}catch{throw new DiscussionError(500);}
}
export async function redactDiscussionComment(actor:VerifiedWebDiscussionActor,input:unknown):Promise<DiscussionReceipt>{
 assertWebDiscussionActor(actor);const v=redactDiscussionSchema.parse(input);
 const result=await call('redact_discussion_comment',{p_comment_id:v.comment_id},sql`select public.redact_discussion_comment(${v.comment_id}::uuid) as result`,actor);
 try{const saved=receipt(result);if(saved.id!==v.comment_id||saved.redacted_at===null)throw new DiscussionError(500);return saved;}catch{throw new DiscussionError(500);}
}
export async function listDiscussionComments(input:unknown):Promise<DiscussionPage>{
 const v=discussionPageSchema.parse(input);let after:string|null=null;
 if(v.cursor){try{const c=discussionCursorSchema.parse(JSON.parse(Buffer.from(v.cursor,'base64url').toString('utf8')));if(c.report_id!==v.report_id||c.parent_id!==v.parent_id)throw new Error();after=c.last_id;}catch{throw new DiscussionError(400);}}
 const raw=await call('list_discussion_comments',{p_report_id:v.report_id,p_parent_id:v.parent_id,p_limit:v.limit,p_after_id:after},sql`select public.list_discussion_comments(${v.report_id}::uuid,${v.parent_id}::uuid,${v.limit}::integer,${after}::uuid) as result`);
 try{
  const data=z.object({parent:z.unknown().nullable(),ancestors:z.array(z.unknown()).max(8),comments:z.array(z.unknown()).max(50),has_more:z.boolean(),next_id:z.uuid().nullable()}).parse(raw);
  const parent=data.parent===null?null:comment(data.parent),rows=data.comments.map(comment);
  if(rows.length>v.limit||rows.some(row=>row.report_id!==v.report_id||row.parent_id!==v.parent_id||row.depth!==(parent?parent.depth+1:0)||row.root_id!==(parent?parent.root_id:row.id))||(parent?.id??null)!==v.parent_id||parent&&parent.report_id!==v.report_id||data.has_more&&(data.next_id!==rows.at(-1)?.id)||!data.has_more&&data.next_id!==null)throw new DiscussionError(500);
  return {report_id:v.report_id,parent_id:v.parent_id,parent,ancestors:ancestors(data.ancestors,v.report_id,parent),comments:rows,has_more:data.has_more,next_cursor:data.next_id?Buffer.from(JSON.stringify({v:1,report_id:v.report_id,parent_id:v.parent_id,last_id:data.next_id})).toString('base64url'):null};
 }catch{throw new DiscussionError(500);}
}
export async function getDiscussionContext(input:unknown):Promise<DiscussionContext>{
 const v=discussionContextSchema.parse(input);
 const raw=await call('get_discussion_context',{p_report_id:v.report_id,p_comment_id:v.comment_id},sql`select public.get_discussion_context(${v.report_id}::uuid,${v.comment_id}::uuid) as result`);
 try{
  const data=z.object({status:z.enum(['available','unavailable']),comment:z.unknown().nullable(),ancestors:z.array(z.unknown()).max(8)}).parse(raw);
  if(data.status==='unavailable'){if(data.comment!==null||data.ancestors.length)throw new Error();return {report_id:v.report_id,status:'unavailable',comment:null,ancestors:[]};}
  const target=comment(data.comment);if(target.id!==v.comment_id||target.report_id!==v.report_id)throw new Error();
  return {report_id:v.report_id,status:'available',comment:target,ancestors:ancestors(data.ancestors,v.report_id,target)};
 }catch{throw new DiscussionError(500);}
}
export async function getDiscussionRedactionCapabilities(actor:VerifiedWebDiscussionActor,loaded:PublicDiscussionComment[]):Promise<{id:string;can_redact:boolean}[]>{
 assertWebDiscussionActor(actor);const ids=z.array(z.uuid()).max(59).parse(loaded.map(row=>row.id));if(!ids.length)return [];
 const raw=await call('discussion_redaction_capabilities',{p_ids:ids},sql`select public.discussion_redaction_capabilities(${ids}::uuid[]) as result`,actor);
 try{return z.array(z.object({id:z.uuid(),can_redact:z.boolean()})).max(59).parse(raw).filter(row=>ids.includes(row.id)).map(row=>({id:row.id,can_redact:row.can_redact}));}catch{throw new DiscussionError(500);}
}
