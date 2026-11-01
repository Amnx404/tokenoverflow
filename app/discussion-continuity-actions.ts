'use server';

import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { serverClient } from '@/lib/supabase/server';
import { appendDiscussionSchema } from '@/lib/discussion-validation';
import type { DiscussionActionState } from '@/lib/discussion-types';
import { requireWebDiscussionActor } from '@/server/services/discussion-actor';
import { appendDiscussionComment } from '@/server/services/discussions';
import { DiscussionError, discussionFailure } from '@/server/services/discussion-errors';

const uuid = z.uuid().transform(value => value.toLowerCase());
const prepareSchema = z.strictObject({ report_id: uuid, request_id: uuid });
const guardedSchema = appendDiscussionSchema.extend({ continuity_marker: z.string().regex(/^[0-9a-f]{64}$/) });
function marker(account: string, report: string, request: string) {
 return createHash('sha256').update(`${uuid.parse(account)}|${uuid.parse(report)}|${uuid.parse(request)}`, 'utf8').digest('hex');
}
function fields(form: FormData): Record<string, unknown> {
 const value: Record<string, unknown> = Object.create(null);
 for (const [key, item] of form) {
  if (key.startsWith('$ACTION_')) continue;
  if (Object.hasOwn(value, key)) throw new DiscussionError(400);
  value[key] = item;
 }
 return value;
}
/** Transient account-continuity metadata only, not authentication or a grant.
 * Never include this marker in public DTOs, persistence, logs or analytics. */
export async function prepareDiscussionContinuity(input: unknown): Promise<{ marker: string } | { error: NonNullable<DiscussionActionState['error']> }> {
 try {
  const value = prepareSchema.parse(input);
  const actor = await requireWebDiscussionActor(await serverClient());
  return { marker: marker(actor.identity.user.id, value.report_id, value.request_id) };
 } catch (error) {
  const safe = discussionFailure(error);
  return { error: { status: safe.status, code: safe.code, message: safe.message } };
 }
}
export async function appendDiscussionWithContinuity(_state: DiscussionActionState, form: FormData): Promise<DiscussionActionState> {
 let requestId: string | undefined;
 let saved;
 try {
  const raw = fields(form);
  const candidate = uuid.safeParse(raw.request_id);
  if (candidate.success) requestId = candidate.data;
  const { continuity_marker, ...input } = guardedSchema.parse({ ...raw, parent_id: raw.parent_id === '' ? null : raw.parent_id });
  const actor = await requireWebDiscussionActor(await serverClient());
  const expected = marker(actor.identity.user.id, input.report_id, input.request_id);
  if (!timingSafeEqual(Buffer.from(continuity_marker, 'hex'), Buffer.from(expected, 'hex'))) throw new DiscussionError(409);
  // Exactly this freshly verified actor is used by the writer. No second actor
  // lookup can switch the account between the continuity check and append.
  saved = await appendDiscussionComment(actor, input);
 } catch (error) {
  const safe = discussionFailure(error);
  return { ...(requestId ? { request_id: requestId } : {}), error: { status: safe.status, code: safe.code, message: safe.message } };
 }
 try { revalidatePath(`/reports/${saved.report_id}`); } catch { /* Known receipts survive optional revalidation failure. */ }
 return { request_id: requestId, receipt: saved };
}
