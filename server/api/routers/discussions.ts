import { TRPCError } from '@trpc/server';
import { appendDiscussionSchema,redactDiscussionSchema,discussionPageSchema,discussionContextSchema } from '@/lib/discussion-validation';
import { requireWebDiscussionActor } from '@/server/services/discussion-actor';
import { discussionFailure } from '@/server/services/discussion-errors';
import { appendDiscussionComment,redactDiscussionComment,listDiscussionComments,getDiscussionContext } from '@/server/services/discussions';
import { createTRPCRouter,publicProcedure } from '../trpc';
async function run<T>(operation:()=>Promise<T>):Promise<T>{try{return await operation();}catch(error){const safe=discussionFailure(error);throw new TRPCError({code:safe.code as 'BAD_REQUEST'|'UNAUTHORIZED'|'FORBIDDEN'|'NOT_FOUND'|'CONFLICT'|'TOO_MANY_REQUESTS'|'INTERNAL_SERVER_ERROR',message:safe.message,cause:safe});}}
const procedure=publicProcedure.use(async({next})=>{const result=await next();if(!result.ok&&result.error.code==='BAD_REQUEST')throw new TRPCError({code:'BAD_REQUEST',message:'Check the discussion request, parent, or cursor.'});return result;});
export const discussionsRouter=createTRPCRouter({
 list:procedure.input(discussionPageSchema).query(({input})=>run(()=>listDiscussionComments(input))),
 context:procedure.input(discussionContextSchema).query(({input})=>run(()=>getDiscussionContext(input))),
 append:procedure.input(appendDiscussionSchema).mutation(({ctx,input})=>run(async()=>appendDiscussionComment(await requireWebDiscussionActor(ctx.client),input))),
 redact:procedure.input(redactDiscussionSchema).mutation(({ctx,input})=>run(async()=>redactDiscussionComment(await requireWebDiscussionActor(ctx.client),input))),
});
