export type TelemetryEnvelope = { event: string; properties: Record<string, string | number | boolean | null> };

// No durable storage or retries. Next's after() owns the callback lifetime;
// each batch has an overall wait deadline, independent of SDK fetch timeouts.
export function createTelemetryQueue(
 deliver: (events: TelemetryEnvelope[]) => Promise<void>,
 schedule: (work: () => Promise<void>) => void,
 maxEvents = 100,
 batchDeadlineMs = 2000,
) {
 const events: TelemetryEnvelope[] = [];
 let scheduled = false;
 let suspended = false;
 let dropped = 0;
 let deliveredBatches = 0;
 let failedBatches = 0;
 return {
  enqueue(event: TelemetryEnvelope) {
   if (suspended || events.length >= maxEvents) { dropped++; return; }
   events.push(event);
   if (scheduled) return;
   scheduled = true;
   try {
    schedule(async () => {
     // At most two bounded batches per lifecycle, including events arriving
     // during the first delivery. Excess is dropped rather than extending work.
     for (let batchNumber = 0; batchNumber < 2 && events.length; batchNumber++) {
      const batch = events.splice(0, maxEvents);
      // Convert rejection to a safe outcome immediately, including a rejection
      // arriving after our deadline. The deadline does not cancel SDK work.
      const delivery = Promise.resolve().then(() => deliver(batch)).then(
       () => 'delivered' as const, () => 'failed' as const,
      );
      let deadline: ReturnType<typeof setTimeout> | undefined;
      const result = await Promise.race([
       delivery,
       new Promise<'timeout'>(resolve => { deadline = setTimeout(() => resolve('timeout'), batchDeadlineMs); }),
      ]);
      clearTimeout(deadline);
      if (result === 'delivered') deliveredBatches++;
      else failedBatches++; // Never log SDK/network errors or event bodies.
      if (result === 'timeout') {
       // Permit only this one pending underlying delivery. Drop queued/new
       // events until it settles; do not launch orphan deliveries on each call.
       suspended = true;
       void delivery.then(() => { suspended = false; });
       break;
      }
     }
     dropped += events.splice(0).length;
     scheduled = false;
    });
   } catch {
    dropped += events.splice(0).length;
    scheduled = false;
   }
  },
  // In-process diagnostics for controlled checks, not a public metrics endpoint.
  stats: () => ({ queued: events.length, dropped, deliveredBatches, failedBatches, suspended }),
 };
}
