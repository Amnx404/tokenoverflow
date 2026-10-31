import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { getHTTPStatusCodeFromError } from '@trpc/server/http';
import { appRouter } from '@/server/api/root';
import { createTRPCContext } from '@/server/api/trpc';
import { startOperation, requestTelemetryContext } from '@/lib/observability';

export const runtime = 'nodejs';
const handler = async (req: Request) => {
 const context=requestTelemetryContext(req);
 const operation=startOperation('/api/trpc','rpc',undefined,{...context,scope:'transport'});
 const response=await fetchRequestHandler({
  endpoint: '/api/trpc', req, router: appRouter,
  // Keep setup inside the adapter so its errors use the public error formatter too.
  createContext: async () => ({...await createTRPCContext(),requestId:operation.requestId,telemetrySynthetic:context.synthetic===true}),
  onError: ({ctx,error}) => { if(!ctx)operation.fail(getHTTPStatusCodeFromError(error)); },
  responseMeta: () => ({ headers: { 'Cache-Control': 'no-store', 'X-Request-ID':operation.requestId } }),
 });
 return operation.finish(response);
};
export { handler as GET, handler as POST };
