'use client';

import { useState } from 'react';
import { DiscussionComment } from './comment';
import { DiscussionComposer } from './composer';
import { validPage, type CommentContext, type CreateComment, type DiscussionCapability, type DiscussionCommentView, type DiscussionPage, type RedactComment, type RequestPage, type SelectedContext } from './types';
import styles from './discussion.module.css';

type Adapters = { signInHref?: string; capability?: DiscussionCapability; onCreate?: CreateComment; onRedact?: RedactComment; onRequestPage?: RequestPage };
type Presentation = { tombstones: ReadonlyMap<string, DiscussionCommentView>; selectedPath: ReadonlySet<string>; selectionIdentity?: string; onPresentationRedact: (comment: DiscussionCommentView) => void };
const identity = (item: { reportId: string; id: string }) => JSON.stringify([item.reportId, item.id]);
function loadedItems(page: DiscussionPage): DiscussionCommentView[] {
 const items = [...page.ancestors];
 for (const item of page.children) {
  items.push(item);
  if (item.replies && item.depth < 8 && item.replies.reportId === page.reportId && item.replies.parentId === item.id && validPage(item.replies)) items.push(...loadedItems(item.replies));
 }
 return items;
}
function Branch({ page, onReply, onRedact, onRequestPage, tombstones, selectedPath, selectionIdentity, onPresentationRedact }: { page: DiscussionPage; onReply?: (item: DiscussionCommentView) => void } & Pick<Adapters, 'onRedact' | 'onRequestPage'> & Presentation) {
 if (!validPage(page)) return <p>Discussion page unavailable: invalid supplied context.</p>;
 return <>
  <p className={styles.context}>{page.children.length} direct {page.parentId === null ? 'comments' : 'replies'} loaded in this page.</p>
  <ul className={styles.list}>{page.children.map(original => {
   const comment = tombstones.get(identity(original)) ?? original;
   return <li key={comment.id}><DiscussionComment comment={comment} onReply={onReply} onRedact={onRedact} onRequestPage={onRequestPage} onPresentationRedact={onPresentationRedact} selectionIdentity={selectedPath.has(comment.id) ? selectionIdentity : undefined}>
    {original.replies ? (original.replies.reportId === comment.reportId && original.replies.parentId === comment.id ? <Branch page={original.replies} onReply={onReply} onRedact={onRedact} onRequestPage={onRequestPage} tombstones={tombstones} selectedPath={selectedPath} selectionIdentity={selectionIdentity} onPresentationRedact={onPresentationRedact}/> : <p>Reply context unavailable.</p>) : undefined}
   </DiscussionComment></li>;
  })}</ul>
  {page.hasMore && <div className={styles.continuation}><p>Additional discussion is not loaded. This is not all of the discussion.</p>{page.nextCursor && onRequestPage ? <button type="button" onClick={() => onRequestPage({ reportId: page.reportId, parentId: page.parentId, cursor: page.nextCursor! })}>Load more {page.parentId === null ? 'comments' : 'replies'}</button> : <p>Continuation unavailable in this view.</p>}</div>}
 </>;
}
/** Unwired presentation adapters only; these booleans/callbacks confer no authorization. */
export function DiscussionThread({ page, selectedContext, onRequestContext, signInHref, capability = 'read-only', onCreate, onRedact, onRequestPage }: { page: DiscussionPage; selectedContext?: SelectedContext; onRequestContext?: (target: { reportId: string; id: string }) => void } & Adapters) {
 const [target, setTarget] = useState<CommentContext>({ reportId: page.reportId, parentId: page.parentId });
 const [tombstones, setTombstones] = useState<ReadonlyMap<string, DiscussionCommentView>>(() => new Map());
 if (!validPage(page)) return <section className={styles.thread}><h2>Discussion</h2><p>Discussion page unavailable: invalid supplied context.</p></section>;
 const focusPage: DiscussionPage | undefined = selectedContext?.state === 'loaded' ? {
  reportId: selectedContext.target.reportId, parentId: selectedContext.target.parentId,
  ancestors: selectedContext.ancestors, children: [selectedContext.target], hasMore: false,
 } : undefined;
 const focused = Boolean(focusPage && focusPage.reportId === page.reportId && focusPage.ancestors.length <= 8 && validPage(focusPage));
 const loaded = loadedItems(page);
 const loadedIds = new Set(loaded.map(item => item.id));
 const extraContext: DiscussionCommentView[] = [];
 if (focused) for (const item of [...focusPage!.ancestors, ...focusPage!.children]) {
  if (loadedIds.has(item.id)) continue;
  extraContext.push(item); loadedIds.add(item.id);
  if (item.replies && validPage(item.replies)) for (const child of loadedItems(item.replies)) loadedIds.add(child.id);
 }
 const selectedPath = new Set(focused ? focusPage!.ancestors.map(item => item.id) : []);
 const selectionIdentity = focused ? JSON.stringify([focusPage!.reportId, focusPage!.children[0].id]) : undefined;
 const sameReport = target.reportId === page.reportId;
 const originalParent = [...loaded, ...extraContext].find(item => item.id === target.parentId && item.reportId === target.reportId);
 const parent = originalParent && (tombstones.get(identity(originalParent)) ?? originalParent);
 const targetAvailable = sameReport && (target.parentId === null || (parent?.state === 'visible' && parent.depth < 8));
 const onPresentationRedact = (item: DiscussionCommentView) => setTombstones(previous => new Map(previous).set(identity(item), item));
 return <section className={styles.thread}><h2>Discussion</h2><p className={styles.notice}>Questions, attempts and follow-ups. Comments are separate from formal evidence and results.</p>
  {selectedContext && <div className={styles.notice}>{focused ? <p>Selected comment context is supplied below. Other discussion may remain unloaded.</p> : <><p>Selected comment is not loaded or its supplied context is unavailable. A saved ID alone does not make its text readable here.</p>{onRequestContext && <button type="button" onClick={() => onRequestContext(selectedContext.state === 'loaded' ? { reportId: selectedContext.target.reportId, id: selectedContext.target.id } : { reportId: selectedContext.reportId, id: selectedContext.id })}>Request selected comment context</button>}</>}</div>}
  {extraContext.length > 0 && <section aria-label="Additional selected comment context">{extraContext.map(original => <DiscussionComment key={original.id} comment={tombstones.get(identity(original)) ?? original} onReply={capability === 'can-comment' ? item => setTarget({ reportId: item.reportId, parentId: item.id }) : undefined} onRedact={onRedact} onRequestPage={onRequestPage} onPresentationRedact={onPresentationRedact} selectionIdentity={selectedPath.has(original.id) ? selectionIdentity : undefined}>{original.replies && <Branch page={original.replies} onReply={capability === 'can-comment' ? item => setTarget({reportId:item.reportId,parentId:item.id}) : undefined} onRedact={onRedact} onRequestPage={onRequestPage} tombstones={tombstones} selectedPath={selectedPath} selectionIdentity={selectionIdentity} onPresentationRedact={onPresentationRedact}/>}</DiscussionComment>)}</section>}
  {page.ancestors.length > 0 && <section aria-label="Actual parent context"><h3>Parent context</h3>{page.ancestors.map(item => <DiscussionComment key={item.id} comment={tombstones.get(identity(item)) ?? item}/>)}</section>}
  {page.children.length === 0 && !page.hasMore && !focused && <p>Ask a question or add what you tried.</p>}
  <Branch page={page} onReply={capability === 'can-comment' ? item => setTarget({ reportId: item.reportId, parentId: item.id }) : undefined} onRedact={onRedact} onRequestPage={onRequestPage} tombstones={tombstones} selectedPath={selectedPath} selectionIdentity={selectionIdentity} onPresentationRedact={onPresentationRedact}/>
  {!targetAvailable && <p>Reply context unavailable. The previous target and draft are retained; no root fallback was made.</p>}
  <button type="button" onClick={() => setTarget({ reportId: page.reportId, parentId: page.parentId })}>{page.parentId === null ? 'New comment on finding' : `Reply to comment ${page.parentId}`}</button>
  <p className={styles.notice}>Drafts stay with their original target while this panel is mounted. Select Reply to change targets explicitly.</p>
  <div hidden={!sameReport}><DiscussionComposer reportId={target.reportId} parentId={target.parentId} capability={sameReport ? capability : 'read-only'} newTargetAvailable={targetAvailable} signInHref={signInHref} onCreate={onCreate}/></div>
 </section>;
}
