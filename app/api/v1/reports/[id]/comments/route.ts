import { startOperation, requestTelemetryContext } from '@/lib/observability';
import { discussionPageSchema } from '@/lib/discussion-validation';
import { listDiscussionComments } from '@/server/services/discussions';
import { DiscussionError,discussionFailure } from '@/server/services/discussion-errors';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const operation=startOperation('/api/v1/reports/[id]/comments','list_comments',undefined,requestTelemetryContext(request));
 const headers={'Cache-Control':'no-store'};
 try{
  const {id}=await params;const query=new URL(request.url).searchParams;
  for(const key of query.keys())if(!['parent_id','limit','cursor'].includes(key)||query.getAll(key).length!==1)throw new DiscussionError(400);
  const input=discussionPageSchema.parse({report_id:id,parent_id:query.get('parent_id')??null,...(query.has('limit')?{limit:Number(query.get('limit'))}:{}),...(query.has('cursor')?{cursor:query.get('cursor')}:{})});
  return operation.finish(Response.json(await listDiscussionComments(input),{headers}));
 }catch(error){const safe=discussionFailure(error);return operation.finish(Response.json({error:{code:safe.code,message:safe.message}},{status:safe.status,headers}));}
}
