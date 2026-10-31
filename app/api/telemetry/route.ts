import { randomUUID } from 'node:crypto';
import { browserTelemetrySchema, captureBrowserTelemetryServer, telemetryEnabled } from '@/lib/telemetry-server';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
let minute = 0;
let count = 0;

export async function POST(request: Request) {
 // Never send collector requests through startOperation: avoid capture loops.
 if (!telemetryEnabled()) return new Response(null, { status: 204, headers });
 const origin = request.headers.get('origin');
 const target = new URL(request.url);
 const host = request.headers.get('host');
 const allowed = ['tokenoverflow.app', 'tokenoverflow.vercel.app'];
 if (process.env.VERCEL_URL) allowed.push(process.env.VERCEL_URL);
 if (process.env.NODE_ENV !== 'production') allowed.push('localhost', '127.0.0.1', '[::1]');
 if (!allowed.includes(target.hostname) || (host !== null && host.toLowerCase() !== target.host.toLowerCase()) || origin !== target.origin) return new Response(null, { status: 403, headers });
 if (!request.headers.get('content-type')?.startsWith('application/json')) return new Response(null, { status: 415, headers });
 const now = Math.floor(Date.now() / 60_000);
 if (minute !== now) { minute = now; count = 0; }
 if (++count > 120) return new Response(null, { status: 429, headers });
 const reader = request.body?.getReader();
 if (!reader) return new Response(null, { status: 400, headers });
 const chunks: Uint8Array[] = [];
 let bytes = 0;
 let timedOut = false;
 const deadline = setTimeout(() => { timedOut = true; void reader.cancel().catch(() => {}); }, 1000);
 try {
  while (true) {
   const value = await reader.read();
   if (value.done) break;
   bytes += value.value.byteLength;
   if (bytes > 1536) { await reader.cancel(); return new Response(null, { status: 413, headers }); }
   chunks.push(value.value);
  }
  if (timedOut) return new Response(null, { status: 408, headers });
  const raw = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { raw.set(chunk, offset); offset += chunk.byteLength; }
  const parsed = browserTelemetrySchema.safeParse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw)));
  if (!parsed.success) return new Response(null, { status: 400, headers });
  const requestId = randomUUID();
  captureBrowserTelemetryServer(parsed.data, requestId);
  return new Response(null, { status: 204, headers: { ...headers, 'X-Request-ID': requestId } });
 } catch { return new Response(null, { status: 400, headers }); }
 finally { clearTimeout(deadline); }
}
