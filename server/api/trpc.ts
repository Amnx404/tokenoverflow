import 'server-only';
import { getHTTPStatusCodeFromError } from '@trpc/server/http';
import { startOperation, type OperationName } from '@/lib/observability';
import { initTRPC, TRPCError } from '@trpc/server';
import { serverClient } from '@/lib/supabase/server';
import { AuthenticationError, requireIdentity } from '@/server/services/auth';

import { ServiceError } from '@/server/services/errors';

export async function createTRPCContext() {
  return { client: await serverClient(), requestId: startOperation('/api/trpc','rpc').requestId, telemetrySynthetic:false };
}

const t = initTRPC.context<typeof createTRPCContext>().create({
  errorFormatter({ shape, error }) {
    // Unexpected driver/context failures may contain SQL, parameters or credentials.
    // Return only the stable public tRPC fields; never serialize stacks in any mode.
    return {
      code: shape.code,
      message: error.code === 'INTERNAL_SERVER_ERROR' ? 'Could not complete the request. Please try again.' : shape.message,
      data: {
        code: shape.data.code,
        httpStatus: shape.data.httpStatus,
        ...(shape.data.path ? { path: shape.data.path } : {}),
      },
    };
  },
});
export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
const serviceErrors = t.middleware(async ({ next, path, ctx }) => {
  const operations:Record<string,OperationName> = {'reports.list':'search_reports','reports.byId':'get_report','contributions.report':'publish_report','contributions.fix':'publish_fix','contributions.verify':'record_verification','agentKeys.list':'list_agent_keys','agentKeys.create':'create_agent_key','agentKeys.revoke':'revoke_agent_key'};
  const operation=startOperation('/api/trpc',operations[path]??'rpc',ctx.requestId,{synthetic:ctx.telemetrySynthetic});
  const result = await next();
  if (!result.ok) {
    const cause=result.error.cause;
    const error=cause instanceof ServiceError ? new TRPCError({code:cause.code,message:cause.message,cause}) : result.error;
    operation.fail(getHTTPStatusCodeFromError(error));
    if(cause instanceof ServiceError)throw error;
  } else operation.complete(200);
  return result;
});
export const publicProcedure = t.procedure.use(serviceErrors);
export const protectedProcedure = publicProcedure.use(async ({ ctx, next }) => {
  try {
    const identity = await requireIdentity(ctx.client);
    return next({ ctx: { ...ctx, identity } });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: error.message, cause: error });
    }
    throw error;
  }
});
