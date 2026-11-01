'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { EvidenceText } from '../evidence-text';
import { commentHref, rejectionText, type DiscussionCommentView, type RedactComment, type RequestPage } from './types';
import styles from './discussion.module.css';

export function DiscussionComment({ comment, children, onReply, onRedact, onRequestPage, onPresentationRedact, selectionIdentity }: { comment: DiscussionCommentView; children?: ReactNode; onReply?: (comment: DiscussionCommentView) => void; onRedact?: RedactComment; onRequestPage?: RequestPage; onPresentationRedact?: (comment: DiscussionCommentView) => void; selectionIdentity?: string }) {
 const branchId = useId();
 const [collapse, setCollapse] = useState({ selectionIdentity, collapsed: false });
 if (collapse.selectionIdentity !== selectionIdentity) setCollapse({ selectionIdentity, collapsed: false });
 const [confirm, setConfirm] = useState(false);
 const [pending, setPending] = useState(false);
 const [notice, setNotice] = useState('');
 const [tombstone, setTombstone] = useState<DiscussionCommentView | null>(null);
 const lock = useRef(false);
 const current = useRef<DiscussionCommentView | null>(comment);
 useEffect(() => { current.current = comment; return () => { current.current = null; }; }, [comment]);
 const hidden = collapse.selectionIdentity === selectionIdentity && collapse.collapsed;
 const shown = tombstone?.id === comment.id && tombstone.reportId === comment.reportId ? tombstone : comment;
 const href = commentHref(shown.reportId, shown.id, shown.permalink);
 const replyable = shown.state === 'visible' && shown.depth < 8;
 const replyContext = children !== undefined || shown.replyCount === undefined || shown.replyCount > 0;
 const countLabel = shown.replyCount === undefined ? '' : ` (${shown.replyCount} known)`;
 return <article id={`comment-${shown.id}`} className={styles.comment}>
  <div className={styles.content} data-indent={Math.min(shown.depth, 3)} data-depth={shown.depth}>
   <header><strong>{shown.state === 'visible' ? (shown.authorName ?? 'Author unavailable') : shown.state === 'redacted' ? 'Removed comment' : 'Author unavailable'}</strong> · <time>{shown.createdAt}</time> · {href ? <a href={href}>Comment link</a> : <span>Permalink unavailable</span>}</header>
   <p className={styles.context}>Comment <code>{shown.id}</code>{shown.parentId !== null && <> · Parent <code>{shown.parentId}</code></>}</p>
   {shown.state === 'visible' ? <pre className={styles.body}><EvidenceText text={shown.body}/></pre> : <p>{shown.state === 'redacted' ? 'Comment removed. Replies and this ID are retained.' : 'Parent context unavailable.'}</p>}
   <p className={styles.context}>{shown.replyCount === undefined ? 'Replies: total not supplied.' : `${shown.replyCount} known ${shown.replyCount === 1 ? 'reply' : 'replies'}`}</p>
   <div className={styles.controls}>
    {onReply && replyable && <button type="button" onClick={() => onReply(shown)}>Reply</button>}
    {shown.depth === 8 && <span>Reply depth limit reached.</span>}
    {replyContext && <button type="button" aria-expanded={!hidden} aria-controls={branchId} onClick={event => { if (!hidden) event.currentTarget.focus(); setCollapse({ selectionIdentity, collapsed: !hidden }); }}>{hidden ? 'Show replies' : 'Collapse replies'}{countLabel}</button>}
    {shown.state === 'visible' && shown.canRedact && onRedact && !confirm && <button type="button" onClick={() => setConfirm(true)}>Remove my comment</button>}
   </div>
   {confirm && shown.state === 'visible' && <div className={styles.confirm}>
    <p>Replace this text with a tombstone? Replies and this comment’s ID remain.</p>
    <button type="button" disabled={pending || !onRedact} onClick={async () => {
     if (lock.current || !onRedact || !shown.canRedact) return;
     lock.current = true; setPending(true); setNotice('');
     const target = shown;
     try {
      const result = await onRedact({ reportId: target.reportId, id: target.id });
      if (current.current?.id !== target.id || current.current?.reportId !== target.reportId) return;
      if (result?.status === 'redacted' && result.comment.state === 'redacted' && result.comment.id === target.id && result.comment.reportId === target.reportId && result.comment.parentId === target.parentId && result.comment.depth === target.depth) {
       setTombstone(result.comment);
       try { onPresentationRedact?.(result.comment); } catch { /* A presentation notification cannot undo a confirmed tombstone. */ }
       setConfirm(false); setNotice('Comment text removed; replies retained.');
      } else setNotice(result?.status === 'rejected' ? rejectionText(result.error, result.retryAfter) : 'Removal outcome unknown. Original text retained until confirmed.');
     } catch { if (current.current?.id === target.id && current.current?.reportId === target.reportId) setNotice('Removal outcome unknown. Original text retained until confirmed.'); }
     finally { lock.current = false; setPending(false); }
    }}>{pending ? 'Removing…' : 'Confirm removal'}</button>
    <button type="button" disabled={pending} onClick={() => setConfirm(false)}>Cancel</button>
   </div>}
   <p role="status" aria-live="polite">{notice}</p>
  </div>
  <div id={branchId} hidden={hidden}>{children ?? (replyContext && shown.depth < 8 ? <div className={styles.notice}><p>Replies are not loaded in this view.</p>{onRequestPage ? <button type="button" onClick={() => onRequestPage({ reportId: shown.reportId, parentId: shown.id, cursor: null })}>Load replies</button> : <p>Reply loading unavailable in this view.</p>}</div> : null)}</div>
 </article>;
}
