'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { serverClient } from '@/lib/supabase/server';
import { appendDiscussionSchema,redactDiscussionSchema } from '@/lib/discussion-validation';
import type { DiscussionActionState } from '@/lib/discussion-types';
import { requireWebDiscussionActor } from '@/server/services/discussion-actor';
import { appendDiscussionComment,redactDiscussionComment } from '@/server/services/discussions';
import { DiscussionError,discussionFailure } from '@/server/services/discussion-errors';
function fields(form:FormData):Record<string,unknown>{const value:Record<string,unknown>=Object.create(null);for(const [key,item]of form){if(key.startsWith('$ACTION_'))continue;if(Object.hasOwn(value,key))throw new DiscussionError(400);value[key]=item;}return value;}
export async function appendDiscussion(_state:DiscussionActionState,form:FormData):Promise<DiscussionActionState>{
 let requestId:string|undefined;let saved;
 try{const raw=fields(form);const candidate=z.uuid().safeParse(raw.request_id);if(candidate.success)requestId=candidate.data.toLowerCase();const input=appendDiscussionSchema.parse({...raw,parent_id:raw.parent_id===''?null:raw.parent_id});saved=await appendDiscussionComment(await requireWebDiscussionActor(await serverClient()),input);}catch(error){const safe=discussionFailure(error);return {...(requestId?{request_id:requestId}:{}),error:{status:safe.status,code:safe.code,message:safe.message}};}
 try{revalidatePath(`/reports/${saved.report_id}`);}catch{/* A known receipt remains a known save. */}
 return {request_id:requestId,receipt:saved};
}
export async function redactDiscussion(_state:DiscussionActionState,form:FormData):Promise<DiscussionActionState>{
 let saved;try{const input=redactDiscussionSchema.parse(fields(form));saved=await redactDiscussionComment(await requireWebDiscussionActor(await serverClient()),input);}catch(error){const safe=discussionFailure(error);return {error:{status:safe.status,code:safe.code,message:safe.message}};}
 try{revalidatePath(`/reports/${saved.report_id}`);}catch{/* A known tombstone remains a known save. */}
 return {receipt:saved};
}
