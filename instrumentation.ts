import type { Instrumentation } from 'next';

export const onRequestError: Instrumentation.onRequestError = async (_error, request, context) => {
 if (process.env.NEXT_RUNTIME !== 'nodejs' || !['render', 'action'].includes(context.routeType)) return;
 try {
  const { captureServerRenderError } = await import('./lib/telemetry-server');
  // Only the local module load is awaited. Network delivery uses after().
  captureServerRenderError(request.path, context.routeType as 'render' | 'action');
 } catch { /* Never replace a framework error with instrumentation failure. */ }
};
