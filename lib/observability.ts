import 'server-only';
import { randomUUID } from 'node:crypto';
import { captureOperationTelemetry, type TelemetryContext } from './telemetry-server';
export { requestTelemetryContext } from './telemetry-server';

export type OperationRoute = '/api/health' | '/api/v1/reports' | '/api/v1/reports/[id]' | '/api/v1/reports/[id]/comments' | '/api/v1/reports/[id]/comments/[commentId]' | '/api/v1/fixes' | '/api/v1/verifications' | '/api/mcp' | '/api/trpc';
export type OperationName = 'health' | 'search_reports' | 'get_report' | 'list_comments' | 'get_comment_context' | 'publish_report' | 'publish_fix' | 'record_verification' | 'mcp_transport' | 'list_agent_keys' | 'create_agent_key' | 'revoke_agent_key' | 'rpc';
export type OperationErrorCode = 'INVALID_INPUT' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'RATE_LIMITED' | 'REQUEST_TOO_LARGE' | 'UNSUPPORTED_MEDIA_TYPE' | 'METHOD_NOT_ALLOWED' | 'DEPENDENCY_UNAVAILABLE' | 'CONFIGURATION_MISSING' | 'INTERNAL_ERROR' | 'TRANSPORT_ERROR';
const codes:Record<number,OperationErrorCode> = {400:'INVALID_INPUT',401:'UNAUTHORIZED',403:'FORBIDDEN',404:'NOT_FOUND',405:'METHOD_NOT_ALLOWED',409:'CONFLICT',413:'REQUEST_TOO_LARGE',415:'UNSUPPORTED_MEDIA_TYPE',429:'RATE_LIMITED',503:'DEPENDENCY_UNAVAILABLE'};

// Generated internally. Never log headers, URLs, exception objects, messages or payloads.
export function startOperation(route:OperationRoute, operation:OperationName, correlationId?:string, context:TelemetryContext={}) {
 const requestId=correlationId && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(correlationId) ? correlationId : randomUUID();
 const started=performance.now();
 let recorded=false;
 function complete(status:number,errorCode?:OperationErrorCode) {
  if(recorded)return;
  recorded=true;
  const duration_ms=Math.min(300_000,Math.max(0,Math.round(performance.now()-started)));
  const error_code=status>=400?(errorCode??codes[status]??'INTERNAL_ERROR'):null;
  if(error_code) console.error(JSON.stringify({schema_version:1,event:'operation_failed',request_id:requestId,route,operation,status,duration_ms,error_code}));
  captureOperationTelemetry({route,operation,status,duration_ms,request_id:requestId,error_code,scope:context.scope??(operation==='mcp_transport'?'transport':'operation'),synthetic:context.synthetic===true});
 }
 return {
  requestId,
  fail: complete,
  complete,
  finish(response:Response,errorCode?:OperationErrorCode) {
   response.headers.set('X-Request-ID',requestId);
   complete(response.status,errorCode);
   return response;
  },
 };
}
