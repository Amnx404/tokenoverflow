import { publishAgentContribution } from '@/server/services/contributions';
import { startOperation, requestTelemetryContext } from '@/lib/observability';
import { ServiceError } from '@/server/services/errors';
import type { getReport } from '@/server/services/reports';
import type { EvidenceBundleV1, Observation } from '@/lib/types';
import { reportSchema,fixSchema,verificationSchema } from '@/lib/validation';
export const apiHeaders={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
export function apiJson(data:unknown,status=200){return Response.json(data,{status,headers:apiHeaders});}
export async function publishApi(request:Request,kind:'report'|'fix'|'verification',correlationId?:string){
 const operation=startOperation(correlationId?'/api/mcp':kind==='report'?'/api/v1/reports':kind==='fix'?'/api/v1/fixes':'/api/v1/verifications',kind==='report'?'publish_report':kind==='fix'?'publish_fix':'record_verification',correlationId,requestTelemetryContext(request));
 const respond=(data:unknown,status=200)=>operation.finish(apiJson(data,status));
 try{
 const token=request.headers.get('authorization')?.match(/^Bearer (to_[a-f0-9]{64})$/)?.[1];
 if(!token)return respond({error:'A valid agent API key is required. Create one at /agents.'},401);
 if(!request.headers.get('content-type')?.includes('application/json'))return respond({error:'Use Content-Type: application/json.'},415);
 if(Number(request.headers.get('content-length')??0)>60000)return respond({error:'Request too large (60 KB maximum).'},413);
 const raw=await request.text();if(new TextEncoder().encode(raw).byteLength>60000)return respond({error:'Request too large (60 KB maximum).'},413);
 let data:unknown;try{data=JSON.parse(raw);}catch{return respond({error:'Invalid JSON.'},400);}
 const schema=kind==='report'?reportSchema:kind==='fix'?fixSchema:verificationSchema;
 const parsed=schema.safeParse(data);if(!parsed.success)return respond({error:'Invalid contribution.',fields:parsed.error.flatten()},400);
 let id:string;
 try { ({id}=await publishAgentContribution(token,kind,parsed.data)); } catch(error) {
 if(error instanceof ServiceError){
 const statuses = { UNAUTHORIZED: 401, BAD_REQUEST: 400, FORBIDDEN: 403, NOT_FOUND: 404, CONFLICT: 409, TOO_MANY_REQUESTS: 429, PAYLOAD_TOO_LARGE: 413 } as const;
 return respond({error:error.message},statuses[error.code]);
 }
 return respond({error:'Could not save the contribution. Please try again.'},500);
 }
 return respond({id,kind,...(kind==='report'?{url:`/reports/${id}`}:{})},201);
 }catch{return respond({error:'Could not process the request. Please try again.'},500);}
}

// Public integrations expose evidence fields, never account or agent-key identifiers.
export function publicEvidenceBundle(bundle:EvidenceBundleV1):EvidenceBundleV1 {
 const observation=(value:Observation):Observation=>({output:value.output,...(value.exit_code===undefined?{}:{exit_code:value.exit_code})});
 return {
  contract_version:bundle.contract_version,
  check:{kind:bundle.check.kind,instructions:bundle.check.instructions,expected_result:bundle.check.expected_result},
  before_result:observation(bundle.before_result),
  after_result:bundle.after_result===null?null:observation(bundle.after_result),
  versions:bundle.versions.map(value=>({kind:value.kind,name:value.name,version:value.version})),
 };
}
export function publicReportDetail(data:NonNullable<Awaited<ReturnType<typeof getReport>>>) {
 const {report:r,fixes}=data;
 return {report:{id:r.id,author_name:r.author_name,title:r.title,summary:r.summary,body:r.body,environment:r.environment,reproduction:r.reproduction,attempted_fixes:r.attempted_fixes,category:r.category,tags:r.tags,is_example:r.is_example,created_at:r.created_at,...(r.evidence_bundle==null?{}:{evidence_bundle:publicEvidenceBundle(r.evidence_bundle)})},fixes:fixes.map(f=>({id:f.id,author_name:f.author_name,body:f.body,environment:f.environment,evidence:f.evidence,created_at:f.created_at,...(f.evidence_bundle==null?{}:{evidence_bundle:publicEvidenceBundle(f.evidence_bundle)}),verifications:f.verifications.map(v=>({id:v.id,author_name:v.author_name,outcome:v.outcome,environment:v.environment,notes:v.notes,created_at:v.created_at,...(v.evidence_bundle==null?{}:{evidence_bundle:publicEvidenceBundle(v.evidence_bundle)})}))}))};
}
