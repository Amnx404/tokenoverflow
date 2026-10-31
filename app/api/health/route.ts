import { apiJson } from '@/lib/api';
import { startOperation } from '@/lib/observability';
import { backendHealthy, hasPublicServiceConfiguration } from '@/server/services/health';
export const runtime='nodejs';
export async function GET() {
 const operation=startOperation('/api/health','health');
 let timeout:ReturnType<typeof setTimeout>|undefined;
 const ok=await Promise.race([backendHealthy(),new Promise<false>(resolve=>{timeout=setTimeout(()=>resolve(false),3000);})]);
 if(timeout)clearTimeout(timeout);
 return operation.finish(apiJson({status:ok?'ok':'degraded'},ok?200:503),hasPublicServiceConfiguration()?'DEPENDENCY_UNAVAILABLE':'CONFIGURATION_MISSING');
}
