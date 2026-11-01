'use server';

import { isAuthSessionMissingError } from '@supabase/supabase-js';
import { discussionContextSchema, discussionPageSchema } from '@/lib/discussion-validation';
import type { DiscussionContext, DiscussionPage, PublicDiscussionComment } from '@/lib/discussion-types';
import { serverClient } from '@/lib/supabase/server';
import { requireWebDiscussionActor } from '@/server/services/discussion-actor';
import { getDiscussionContext, getDiscussionRedactionCapabilities, listDiscussionComments } from '@/server/services/discussions';

type Permissions = { capability: 'can-comment' | 'read-only' | 'signed-out'; redactableIds: string[] };
export type DiscussionPageRead = ({ status: 'available'; page: DiscussionPage } & Permissions) | { status: 'unavailable' };
export type DiscussionContextRead = ({ status: 'available'; context: DiscussionContext } & Permissions) | { status: 'unavailable' };
function project(row: PublicDiscussionComment): PublicDiscussionComment {
 return { id: row.id.toLowerCase(), report_id: row.report_id.toLowerCase(), parent_id: row.parent_id?.toLowerCase() ?? null, root_id: row.root_id.toLowerCase(), depth: row.depth, author_name: row.redacted_at === null ? row.author_name : null, body: row.redacted_at === null ? row.body : null, created_at: row.created_at, redacted_at: row.redacted_at };
}
async function permissions(loaded: PublicDiscussionComment[]): Promise<Permissions> {
 let client: Awaited<ReturnType<typeof serverClient>>;
 try { client = await serverClient(); } catch { return { capability: 'read-only', redactableIds: [] }; }
 let actor: Awaited<ReturnType<typeof requireWebDiscussionActor>>;
 try { actor = await requireWebDiscussionActor(client); }
 catch {
  // Actor failure alone is ambiguous. Only the actual SDK observation can
  // distinguish an absent session from claims/network/unsupported-user failure.
  try {
   const result = await client.auth.getUser();
   if (result.data?.user === null && (!result.error || isAuthSessionMissingError(result.error))) return { capability: 'signed-out', redactableIds: [] };
  } catch { /* Keep public reads available with no claimed sign-in state. */ }
  return { capability: 'read-only', redactableIds: [] };
 }
 try {
  const allowed = new Set<string>();
  // Only actual service-returned rows, never caller-supplied ownership/rows.
  for (let offset = 0; offset < Math.max(loaded.length, 1); offset += 59) {
   const batch = loaded.slice(offset, offset + 59);
   const ids = new Set(batch.map(row => row.id.toLowerCase()));
   for (const row of await getDiscussionRedactionCapabilities(actor, batch)) if (row.can_redact === true && ids.has(row.id.toLowerCase())) allowed.add(row.id.toLowerCase());
  }
  return { capability: 'can-comment', redactableIds: [...allowed] };
 } catch { return { capability: 'read-only', redactableIds: [] }; }
}
export async function readDiscussionPage(input: unknown): Promise<DiscussionPageRead> {
 const parsed = discussionPageSchema.safeParse(input);
 if (!parsed.success) return { status: 'unavailable' };
 try {
  const page = await listDiscussionComments(parsed.data);
  if (page.report_id.toLowerCase() !== parsed.data.report_id || (page.parent_id?.toLowerCase() ?? null) !== parsed.data.parent_id) return { status: 'unavailable' };
  const loaded = [...page.ancestors, ...(page.parent ? [page.parent] : []), ...page.comments];
  const capability = await permissions(loaded);
  return { status: 'available', ...capability, page: { report_id: page.report_id.toLowerCase(), parent_id: page.parent_id?.toLowerCase() ?? null, parent: page.parent ? project(page.parent) : null, ancestors: page.ancestors.map(project), comments: page.comments.map(project), has_more: page.has_more, next_cursor: page.next_cursor } };
 } catch { return { status: 'unavailable' }; }
}
export async function readDiscussionContext(input: unknown): Promise<DiscussionContextRead> {
 const parsed = discussionContextSchema.safeParse(input);
 if (!parsed.success) return { status: 'unavailable' };
 try {
  const context = await getDiscussionContext(parsed.data);
  if (context.report_id.toLowerCase() !== parsed.data.report_id) return { status: 'unavailable' };
  const capability = await permissions([...context.ancestors, ...(context.comment ? [context.comment] : [])]);
  return { status: 'available', ...capability, context: { report_id: context.report_id.toLowerCase(), status: context.status, comment: context.comment ? project(context.comment) : null, ancestors: context.ancestors.map(project) } };
 } catch { return { status: 'unavailable' }; }
}
