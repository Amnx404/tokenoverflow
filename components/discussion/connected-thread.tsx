'use client';

import { startTransition, useRef, useState } from 'react';
import { z } from 'zod';
import { redactDiscussion } from '@/app/discussion-actions';
import { appendDiscussionWithContinuity, prepareDiscussionContinuity } from '@/app/discussion-continuity-actions';
import { readDiscussionContext, readDiscussionPage, type DiscussionContextRead, type DiscussionPageRead } from '@/app/discussion-read-actions';
import type { DiscussionActionState, DiscussionReceipt, PublicDiscussionComment } from '@/lib/discussion-types';
import { DiscussionThread } from './thread';
import { SelectedCommentLanding } from './selected-comment-landing';
import type { CommentContext, CreateComment, CreateOutcome, CreatePayload, DiscussionCommentView, DiscussionPage, RedactComment, RequestPage, SelectedContext } from './types';

type CanonicalView = { row: PublicDiscussionComment; canRedact: boolean };
function rowsOf(read?: DiscussionPageRead | DiscussionContextRead): PublicDiscussionComment[] {
 if (read?.status !== 'available') return [];
 return 'page' in read ? [...read.page.ancestors, ...(read.page.parent ? [read.page.parent] : []), ...read.page.comments] : [...read.context.ancestors, ...(read.context.comment ? [read.context.comment] : [])];
}
const uuid = z.uuid().transform(value => value.toLowerCase());
const timestamp = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
const receiptSchema = z.object({ request_id: uuid.optional(), id: uuid, report_id: uuid, parent_id: uuid.nullable(), root_id: uuid, depth: z.number().int().min(0).max(8), created_at: timestamp, redacted_at: timestamp.nullable(), url: z.unknown().optional() });
/** Real dedicated Server Functions are invoked through a client transition,
 * not passed from an RSC as arbitrary presentation callbacks. */
export function inDiscussionAction<T>(call: () => Promise<T>): Promise<T> {
 return new Promise((resolve, reject) => startTransition(async () => { try { resolve(await call()); } catch (error) { reject(error); } }));
}
export function adaptDiscussionComment(row: PublicDiscussionComment, allowed: readonly string[]): DiscussionCommentView {
 const id = row.id.toLowerCase(), reportId = row.report_id.toLowerCase();
 const base = { id, reportId, parentId: row.parent_id?.toLowerCase() ?? null, rootId: row.root_id.toLowerCase(), depth: row.depth, authorName: row.redacted_at === null ? row.author_name : null, createdAt: row.created_at, canRedact: row.redacted_at === null && allowed.includes(id), permalink: `/reports/${reportId}?comment=${id}#comment-${id}` };
 return row.redacted_at !== null ? { ...base, state: 'redacted' } : { ...base, state: 'visible', body: row.body ?? '' };
}
export function adaptDiscussionPage(read: Extract<DiscussionPageRead, { status: 'available' }>, pages: ReadonlyMap<string | null, DiscussionPageRead> = new Map(), path = new Set<string>(), overrides: ReadonlyMap<string, CanonicalView> = new Map()): DiscussionPage {
 const raw = read.page;
 const view = (row: PublicDiscussionComment) => { const known = overrides.get(row.id.toLowerCase()); return adaptDiscussionComment(known?.row ?? row, known ? (known.canRedact ? [row.id.toLowerCase()] : []) : read.redactableIds); };
 return { reportId: raw.report_id.toLowerCase(), parentId: raw.parent_id?.toLowerCase() ?? null, ancestors: [...raw.ancestors, ...(raw.parent ? [raw.parent] : [])].map(view), hasMore: raw.has_more, nextCursor: raw.next_cursor, limit: 50,
  children: raw.comments.map(row => {
   const comment = view(row);
   const reply = pages.get(comment.id);
   if (reply?.status === 'available' && reply.page.report_id.toLowerCase() === comment.reportId && reply.page.parent_id?.toLowerCase() === comment.id && !path.has(comment.id) && comment.depth < 8) return { ...comment, replies: adaptDiscussionPage(reply, pages, new Set([...path, comment.id]), overrides) };
   return comment;
  }),
 };
}
type ParentIdentity = Pick<DiscussionCommentView, 'id' | 'reportId' | 'rootId' | 'depth'>;
type AttemptSnapshot = { payload: CreatePayload; parent?: ParentIdentity; marker?: string; guardedAction: typeof appendDiscussionWithContinuity };
type KnownReceipt = Omit<DiscussionReceipt, 'url'> & { url?: string };
function checkedReceipt(state: DiscussionActionState, target: CommentContext, parent?: ParentIdentity, requestId?: string): KnownReceipt | undefined {
 const parsed = receiptSchema.safeParse(state.receipt);
 if (!parsed.success) return;
 const row = parsed.data;
 if (row.report_id !== target.reportId.toLowerCase() || row.parent_id !== (target.parentId?.toLowerCase() ?? null)) return;
 if (requestId && (row.request_id !== requestId.toLowerCase() || state.request_id?.toLowerCase() !== requestId.toLowerCase())) return;
 if (row.parent_id === null ? row.depth !== 0 || row.root_id !== row.id : !parent || row.depth !== parent.depth + 1 || row.root_id !== parent.rootId || parent.id !== row.parent_id || parent.reportId !== row.report_id) return;
 const { url, ...core } = row;
 return { ...core, ...(typeof url === 'string' && url === `/reports/${row.report_id}?comment=${row.id}#comment-${row.id}` ? { url } : {}) };
}
function failed(state: DiscussionActionState): Exclude<CreateOutcome, { status: 'saved' }> {
 const status = state?.error?.status;
 if (status === 409 || !Number.isInteger(status) || status! >= 500) return { status: 'unknown' };
 const error = status === 400 ? 'invalid-body' : status === 401 || status === 403 ? 'not-allowed' : status === 404 ? 'parent-unavailable' : status === 429 ? 'rate-limited' : undefined;
 return error ? { status: 'rejected', error } : { status: 'unknown' };
}
/** Exported for focused controlled integration checks; production defaults are
 * the actual imported actions. No transport or identity is synthesized here. */
export function createDiscussionBridge(find: (id: string) => DiscussionCommentView | undefined, onKnown?: (receipt: KnownReceipt) => void, action = appendDiscussionWithContinuity, attempts = new Map<string, AttemptSnapshot>(), prepare = prepareDiscussionContinuity, seen = new Set<string>()): CreateComment {
 return async payload => {
  const target = { reportId: payload.reportId.toLowerCase(), parentId: payload.parentId?.toLowerCase() ?? null };
  const requestId = payload.requestId.toLowerCase();
  let snapshot = attempts.get(requestId);
  if (snapshot && (snapshot.payload.reportId !== target.reportId || snapshot.payload.parentId !== target.parentId || snapshot.payload.body !== payload.body)) return { status: 'unknown' };
  if (!snapshot) {
   if (seen.has(requestId)) return { status: 'unknown' };
   seen.add(requestId);
   const parent = target.parentId === null ? undefined : find(target.parentId);
   if (target.parentId !== null && (!parent || parent.state !== 'visible' || parent.depth >= 8 || !parent.rootId || parent.reportId !== target.reportId || parent.id !== target.parentId)) return { status: 'rejected', error: 'parent-unavailable' };
   snapshot = { guardedAction: action, payload: Object.freeze({ ...target, requestId, body: payload.body }), ...(parent ? { parent: { id: parent.id, reportId: parent.reportId, rootId: parent.rootId, depth: parent.depth } } : {}) };
   attempts.set(requestId, snapshot);
   let prepared;
   try { prepared = await inDiscussionAction(() => prepare({ report_id: target.reportId, request_id: requestId })); }
   catch { attempts.delete(requestId); return { status: 'rejected', error: 'unavailable' }; }
   if (!prepared || typeof prepared !== 'object' || !('marker' in prepared) || typeof prepared.marker !== 'string' || !/^[0-9a-f]{64}$/.test(prepared.marker)) {
    attempts.delete(requestId); return { status: 'rejected', error: 'unavailable' };
   }
   snapshot.marker = prepared.marker;
  }
  // Never re-prepare a possibly sent attempt when original metadata is missing.
  if (!snapshot.marker) return { status: 'unknown' };
  const form = new FormData();
  form.set('report_id', target.reportId); form.set('parent_id', target.parentId ?? ''); form.set('request_id', payload.requestId.toLowerCase()); form.set('body', payload.body); form.set('continuity_marker', snapshot.marker);
  const guardedWrite = snapshot.guardedAction;
  let state;
  try { state = await inDiscussionAction(() => guardedWrite({}, form)); } catch { return { status: 'unknown' }; }
  const receipt = checkedReceipt(state ?? {}, target, snapshot.parent, requestId);
  if (!receipt) return state?.receipt !== undefined || state?.error?.status === 401 || state?.error?.status === 403 ? { status: 'unknown' } : failed(state ?? {});
  attempts.delete(requestId);
  try { onKnown?.(receipt); } catch { /* Optional presentation refresh cannot undo a known save. */ }
  return { status: 'saved', id: receipt.id, reportId: receipt.report_id, parentId: receipt.parent_id, rootId: receipt.root_id, depth: receipt.depth, requestId: receipt.request_id, createdAt: receipt.created_at, redacted: receipt.redacted_at !== null, permalink: receipt.url };
 };
}
export function redactDiscussionBridge(find: (id: string) => DiscussionCommentView | undefined, action = redactDiscussion): RedactComment {
 return async target => {
  const row = find(target.id.toLowerCase());
  if (!row || row.reportId !== target.reportId.toLowerCase()) return { status: 'unknown' };
  const form = new FormData(); form.set('comment_id', row.id);
  let state;
  try { state = await inDiscussionAction(() => action({}, form)); } catch { return { status: 'unknown' }; }
  const parent = row.parentId === null ? undefined : find(row.parentId);
  const receipt = checkedReceipt(state ?? {}, { reportId: row.reportId, parentId: row.parentId }, parent);
  if (!receipt || receipt.id !== row.id || receipt.root_id !== row.rootId || receipt.depth !== row.depth || receipt.redacted_at === null) return state?.receipt !== undefined ? { status: 'unknown' } : failed(state ?? {});
  return { status: 'redacted', comment: { ...row, state: 'redacted', body: undefined, authorName: null, canRedact: false } };
 };
}

type PageHistory = { reads: DiscussionPageRead[]; index: number };
export function ConnectedDiscussionThread({ reportId, initialPage, initialContext, selectedCommentId, selectionRequested = false }: { reportId: string; initialPage: DiscussionPageRead; initialContext?: DiscussionContextRead; selectedCommentId?: string; selectionRequested?: boolean }) {
 const report = reportId.toLowerCase();
 const [histories, setHistories] = useState<ReadonlyMap<string | null, PageHistory>>(() => new Map([[null, { reads: [initialPage], index: 0 }]]));
 const [attempts] = useState(() => new Map<string, AttemptSnapshot>());
 const [seenAttempts] = useState(() => new Set<string>());
 const [selection, setSelection] = useState(initialContext);
 const [tombstones, setTombstones] = useState<ReadonlyMap<string, PublicDiscussionComment>>(() => new Map([...rowsOf(initialPage), ...rowsOf(initialContext)].filter(row => row.redacted_at !== null).map(row => [row.id.toLowerCase(), row])));
 const rememberTombstones = (read: DiscussionPageRead | DiscussionContextRead) => { const removed = rowsOf(read).filter(row => row.redacted_at !== null); if (removed.length) setTombstones(previous => { const next = new Map(previous); for (const row of removed) next.set(row.id.toLowerCase(), row); return next; }); };
 const [selectedId, setSelectedId] = useState<string | undefined>(selectedCommentId?.toLowerCase() ?? (initialContext?.status === 'available' ? initialContext.context.comment?.id.toLowerCase() : undefined));
 const [notice, setNotice] = useState('');
 const selectionVersion = useRef(0);
 const loadingPages = useRef(new Set<string>());
 const currentPages = new Map([...histories].map(([key, history]) => [key, history.reads[history.index]]));
 const root = currentPages.get(null);
 const requestContext = (target: { reportId: string; id: string }) => {
  if (target.reportId.toLowerCase() !== report) return;
  const version = ++selectionVersion.current;
  setSelectedId(target.id.toLowerCase()); setSelection({ status: 'unavailable' });
  void inDiscussionAction(() => readDiscussionContext({ report_id: report, comment_id: target.id })).then(result => { rememberTombstones(result); if (version === selectionVersion.current) setSelection(result); }).catch(() => { if (version === selectionVersion.current) setNotice('Selected comment context unavailable. Any known saved receipt remains valid.'); });
 };
 const requestPage: RequestPage = target => {
  if (target.reportId.toLowerCase() !== report) return;
  const parent = target.parentId?.toLowerCase() ?? null;
  const key = parent ?? 'root';
  if (loadingPages.current.has(key)) return;
  loadingPages.current.add(key);
  void inDiscussionAction(() => readDiscussionPage({ report_id: report, parent_id: parent, ...(target.cursor === null ? {} : { cursor: target.cursor }) })).then(result => {
   if (result.status !== 'available') { setNotice('Discussion page unavailable. Current pages and drafts are retained.'); return; }
   rememberTombstones(result);
   setHistories(previous => { const next = new Map(previous), old = next.get(parent); next.set(parent, { reads: [...(old ? old.reads.slice(0, old.index + 1) : []), result], index: old ? old.index + 1 : 0 }); return next; });
  }).catch(() => setNotice('Discussion page unavailable. Current pages and drafts are retained.')).finally(() => loadingPages.current.delete(key));
 };
 const overrides = new Map<string, CanonicalView>();
 for (const read of [...currentPages.values(), ...(selection ? [selection] : [])]) if (read.status === 'available') for (const row of rowsOf(read)) {
  const id = row.id.toLowerCase(), previous = overrides.get(id);
  if (previous?.row.redacted_at !== null && previous !== undefined) continue;
  overrides.set(id, { row, canRedact: read.capability === 'can-comment' && read.redactableIds.includes(id) });
 }
 for (const [id, row] of tombstones) overrides.set(id, { row, canRedact: false });
 const view = (row: PublicDiscussionComment) => { const known = overrides.get(row.id.toLowerCase()); return adaptDiscussionComment(known?.row ?? row, known?.canRedact ? [row.id.toLowerCase()] : []); };
 const mappedRoot = root?.status === 'available' ? adaptDiscussionPage(root, currentPages, new Set(), overrides) : undefined;
 let selectedContext: SelectedContext | undefined;
 if (selection?.status === 'available' && selection.context.status === 'available' && selection.context.comment) {
  const target = view(selection.context.comment);
  const reply = currentPages.get(target.id);
  selectedContext = { state: 'loaded', target: reply?.status === 'available' ? { ...target, replies: adaptDiscussionPage(reply, currentPages, new Set(), overrides) } : target, ancestors: selection.context.ancestors.map(view) };
 } else if (selectedId) selectedContext = { state: 'unavailable', reportId: report, id: selectedId };
 const validSelected = selectedId && uuid.safeParse(selectedId).success ? selectedId.toLowerCase() : undefined;
 const signInHref = uuid.safeParse(report).success ? `/login?next=${encodeURIComponent(`/reports/${report}${validSelected ? `?comment=${validSelected}` : ''}`)}` : undefined;
 const find = (id: string): DiscussionCommentView | undefined => { const known = overrides.get(id.toLowerCase()); return known ? view(known.row) : undefined; };
 return <div>
  <p role="status" aria-live="polite">{notice}</p>
  {selectionRequested && !selectedId && !(selection?.status === 'available' && selection.context.status === 'available' && selection.context.comment) && <p>Selected comment context unavailable. The selection was not loaded.</p>}
  {mappedRoot ? <><DiscussionThread key={report} page={mappedRoot} selectedContext={selectedContext} capability={root?.status === 'available' ? root.capability : 'read-only'} signInHref={signInHref} onRequestContext={requestContext} onRequestPage={requestPage} onCreate={payload => createDiscussionBridge(find, saved => requestContext({ reportId: saved.report_id, id: saved.id }), appendDiscussionWithContinuity, attempts, prepareDiscussionContinuity, seenAttempts)(payload)} onRedact={redactDiscussionBridge(find)}/>{selectedContext?.state === 'loaded' && selectedContext.target.reportId === report && <SelectedCommentLanding reportId={report} commentId={selectedContext.target.id}/>}</> : <section><h2>Discussion</h2><p>Discussion is temporarily unavailable. The finding above is unchanged.</p><button type="button" onClick={() => requestPage({ reportId: report, parentId: null, cursor: null })}>Retry discussion read</button></section>}
  {[...histories].map(([parent, history]) => history.index > 0 && <button key={parent ?? 'root'} type="button" onClick={() => setHistories(previous => { const next = new Map(previous); next.set(parent, { ...history, index: history.index - 1 }); return next; })}>{parent === null ? 'Previous comments page' : `Previous replies for ${parent}`}</button>)}
 </div>;
}
