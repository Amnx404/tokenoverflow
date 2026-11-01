import { startOperation, requestTelemetryContext } from '@/lib/observability';
import { discussionContextSchema } from '@/lib/discussion-validation';
import { getDiscussionContext } from '@/server/services/discussions';
import { DiscussionError,discussionFailure } from '@/server/services/discussion-errors';
export async function GET(request:Request,{params}:{params:Promise<{id:string;commentId:string}>}){
 const operation=startOperation('/api/v1/reports/[id]/comments/[commentId]','get_comment_context',undefined,requestTelemetryContext(request));
 const headers={'Cache-Control':'no-store'};
 try{
  if(new URL(request.url).search)throw new DiscussionError(400);
  const {id,commentId}=await params;const input=discussionContextSchema.parse({report_id:id,comment_id:commentId});const context=await getDiscussionContext(input);
  return operation.finish(Response.json(context,{status:context.status==='unavailable'?404:200,headers}));
 }catch(error){const safe=discussionFailure(error);return operation.finish(Response.json({error:{code:safe.code,message:safe.message}},{status:safe.status,headers}));}
}
