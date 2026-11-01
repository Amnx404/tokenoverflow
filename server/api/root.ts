import { discussionsRouter } from './routers/discussions';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { publicReportDetail } from '@/lib/api';
import { reportSearchSchema, reportSchema, fixSchema, verificationSchema } from '@/lib/validation';
import { listReports, getReport, getFixOwnership } from '@/server/services/reports';
import { AuthenticationError, requireIdentity } from '@/server/services/auth';
import { createReport, createFix, createVerification } from '@/server/services/contributions';
import { listAgentKeys, createAgentKey, revokeAgentKey } from '@/server/services/agent-keys';
import { createCallerFactory, createTRPCRouter, publicProcedure, protectedProcedure } from './trpc';

export const appRouter = createTRPCRouter({
  discussions:discussionsRouter,
  reports: createTRPCRouter({
    list: publicProcedure.input(reportSearchSchema.optional()).query(({ input }) => listReports(input)),
    byId: publicProcedure.input(z.object({ id: z.uuid() })).query(async ({ ctx, input }) => {
      const report = await getReport(input.id);
      if (!report) throw new TRPCError({ code: 'NOT_FOUND', message: 'Report not found.' });
      const publicData = publicReportDetail(report);
      let owned=new Set<string>();
      if(publicData.fixes.length) {
        try {
          const identity=await requireIdentity(ctx.client);
          owned=await getFixOwnership(identity,input.id);
        } catch(error) {
          if(!(error instanceof AuthenticationError)) throw error;
        }
      }
      return { ...publicData, fixes: publicData.fixes.map(fix => ({
        ...fix, is_own_fix: owned.has(fix.id),
      })) };
    }),
  }),
  contributions: createTRPCRouter({
    report: protectedProcedure.input(reportSchema.omit({ author_name: true })).mutation(({ ctx, input }) => createReport(ctx.identity, input)),
    fix: protectedProcedure.input(fixSchema.omit({ author_name: true })).mutation(({ ctx, input }) => createFix(ctx.identity, input)),
    verify: protectedProcedure.input(verificationSchema.omit({ author_name: true })).mutation(({ ctx, input }) => createVerification(ctx.identity, input)),
  }),
  agentKeys: createTRPCRouter({
    list: protectedProcedure.query(({ ctx }) => listAgentKeys(ctx.identity)),
    create: protectedProcedure.input(z.object({ name: z.string().trim().min(1).max(80) })).mutation(({ ctx, input }) => createAgentKey(ctx.identity, input.name)),
    revoke: protectedProcedure.input(z.object({ id: z.uuid() })).mutation(({ ctx, input }) => revokeAgentKey(ctx.identity, input.id)),
  }),
});
export type AppRouter = typeof appRouter;
export const createCaller = createCallerFactory(appRouter);
