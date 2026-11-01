'use client';

import { useId, useState } from 'react';
import { bodyProblem, commentHref, publicId, rejectionText, type CommentContext, type CreateComment, type CreatePayload, type DiscussionCapability, type Rejection, type SavedComment } from './types';
import styles from './discussion.module.css';

type Draft = { body: string; status: 'editing' | 'pending' | 'rejected' | 'unknown' | 'saved'; attempt?: CreatePayload; createAttempt?: CreateComment; rejection?: Rejection; localError?: 'invalid-body'; receipt?: SavedComment };
/** Local presentation state only; per-target snapshots prevent late completion
 * from clearing another draft. The backend must implement actual idempotency. */
export class ComposerSession {
 private drafts = new Map<string, Draft>();
 constructor(private uuid: () => string = () => globalThis.crypto.randomUUID()) {}
 private key(target: CommentContext) { return JSON.stringify([target.reportId.toLowerCase(), target.parentId?.toLowerCase() ?? null]); }
 view(target: CommentContext): Readonly<Draft> {
  const key = this.key(target);
  return this.drafts.get(key) ?? { body: '', status: 'editing' };
 }
 edit(target: CommentContext, body: string) {
  const draft = this.view(target);
  if (draft.status !== 'editing' && draft.status !== 'saved') return;
  this.drafts.set(this.key(target), { ...draft, body, status: 'editing', ...(draft.status === 'editing' && !draft.attempt && !draft.createAttempt ? { localError: undefined } : {}) });
 }
 correct(target: CommentContext) {
  const draft = this.view(target);
  if (draft.status === 'rejected') this.drafts.set(this.key(target), { ...draft, status: 'editing', attempt: undefined, createAttempt: undefined, rejection: undefined });
 }
 async submit(target: CommentContext, create?: CreateComment) {
  const draft = this.view(target);
  if (!['editing', 'unknown'].includes(draft.status)) return;
  const originalCreate = draft.attempt ? draft.createAttempt : create;
  // An uncertain attempt cannot adopt a new viewer's callback/continuity marker.
  if (!originalCreate) return;
  if (bodyProblem(draft.body)) {
   // Only this pre-dispatch local check proves there is no attempt to recover.
   if (draft.status === 'editing' && !draft.attempt && !draft.createAttempt) {
    this.drafts.set(this.key(target), { ...draft, localError: 'invalid-body' }); return;
   }
   this.drafts.set(this.key(target), { ...draft, status: 'rejected', rejection: { status: 'rejected', error: 'invalid-body' } }); return;
  }
  const wasUnknown = draft.status === 'unknown';
  const payload = draft.attempt ?? Object.freeze({ requestId: this.uuid().toLowerCase(), reportId: target.reportId.toLowerCase(), parentId: target.parentId?.toLowerCase() ?? null, body: draft.body });
  const key = this.key(target);
  this.drafts.set(key, { ...draft, attempt: payload, createAttempt: originalCreate, status: 'pending', rejection: undefined });
  let outcome;
  try { outcome = await originalCreate(payload); } catch { outcome = { status: 'unknown' as const }; }
  // Apply only to the exact still-current attempt in its original context.
  const current = this.drafts.get(key);
  if (current?.attempt !== payload || current.status !== 'pending') return;
  if (outcome?.status === 'saved' && typeof outcome.id === 'string' && publicId(outcome.id) && outcome.reportId === payload.reportId && outcome.parentId === payload.parentId) {
   const receipt = { ...outcome, permalink: commentHref(outcome.reportId, outcome.id, outcome.permalink) };
   this.drafts.set(key, { ...current, body: '', status: 'saved', attempt: undefined, createAttempt: undefined, receipt });
  } else if (outcome?.status === 'rejected') {
   this.drafts.set(key, { ...current, status: wasUnknown ? 'unknown' : 'rejected', rejection: outcome });
  } else this.drafts.set(key, { ...current, status: 'unknown' });
 }
}

export function DiscussionComposer({ reportId, parentId, capability = 'read-only', onCreate, newTargetAvailable = true, signInHref }: CommentContext & { capability?: DiscussionCapability; onCreate?: CreateComment; newTargetAvailable?: boolean; signInHref?: string }) {
 const id = useId();
 const [session] = useState(() => new ComposerSession());
 const [, render] = useState(0);
 const target = { reportId, parentId };
 const draft = session.view(target);
 const available = capability === 'can-comment' && Boolean(onCreate) && (newTargetAvailable || draft.status === 'unknown');
 const frozen = draft.status === 'pending' || draft.status === 'unknown' || draft.status === 'rejected';
 const refresh = () => render(value => value + 1);
 return <form className={styles.composer} onSubmit={async event => {
  event.preventDefault();
  if (!available) return;
  const submission = session.submit(target, onCreate);
  refresh(); await submission; refresh();
 }}>
  <p className={styles.context}>{parentId === null ? 'New comment' : `Reply to comment ${parentId}`}</p>
  <label htmlFor={id}>Your question or what you tried</label>
  <textarea id={id} value={draft.body} readOnly={!available || !newTargetAvailable || frozen} aria-describedby={`${id}-notice`} onChange={event => { session.edit(target, event.currentTarget.value); refresh(); }}/>
  <p id={`${id}-notice`} className={styles.notice}>Comments are public. Remove secrets and private data. Up to 2,000 characters / 8 KiB.</p>
  {!available && <p>{capability === 'signed-out' ? (signInHref ? <a href={signInHref}>Sign in to comment</a> : 'Sign in to comment.') : 'Comment creation is unavailable here.'}</p>}
  {capability === 'signed-out' && draft.status === 'unknown' && <p>Keep the draft and request ID before signing in or reloading; they may be cleared.</p>}
  <div role="status" aria-live="polite">
   {draft.status === 'editing' && draft.localError && !draft.attempt && !draft.createAttempt && <p>{rejectionText(draft.localError)}</p>}
   {draft.status === 'pending' && <p>Sending this exact attempt…</p>}
   {draft.status === 'rejected' && <p>{rejectionText(draft.rejection?.error ?? 'unavailable', draft.rejection?.retryAfter)}</p>}
   {draft.status === 'unknown' && <><p>Save outcome unknown. Draft, reply target and request ID are retained. Retry only this exact attempt.</p>{draft.rejection && <p>The retry was rejected; that does not establish whether the original save succeeded.</p>}</>}
   {draft.receipt && <p>{draft.status === 'saved' ? 'Saved comment' : 'Previously saved comment'} <code>{draft.receipt.id}</code>{draft.receipt.redacted ? ' (now a tombstone).' : '.'} {draft.receipt.permalink ? <a href={draft.receipt.permalink}>View comment</a> : 'Comment link unavailable; do not publish again to obtain one.'}</p>}
  </div>
  {draft.attempt && <p className={styles.context}>Request ID: <code>{draft.attempt.requestId}</code></p>}
  {draft.status === 'rejected' && <button type="button" disabled={!available} onClick={() => { session.correct(target); refresh(); }}>Correct this draft</button>}
  <button type="submit" disabled={!available || draft.status === 'pending' || draft.status === 'rejected' || draft.status === 'saved'}>{draft.status === 'unknown' ? 'Retry exact attempt' : draft.status === 'pending' ? 'Sending…' : 'Post comment'}</button>
 </form>;
}
