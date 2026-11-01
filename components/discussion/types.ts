/** Presentation-only DTOs. Integration must map authoritative backend DTOs and
 * enforce identity, ownership, quotas, normalization and idempotency server-side.
 * Function adapters below are created inside a client graph, never passed as
 * arbitrary callbacks across a React Server Component boundary. Map backend
 * parent + ancestors (which exclude parent) to the ordered ancestor chain here.
 * Preserve raw timestamps/root identity in the integration DTO; do not normalize
 * dates or infer missing reply totals. Tombstone NULL bodies/names map to state
 * and neutral presentation, never the prior author/text. */
export type DiscussionCapability = 'signed-out' | 'read-only' | 'can-comment';
export type CommentContext = Readonly<{ reportId: string; parentId: string | null }>;
export type DiscussionCommentView = Readonly<{
 id: string; reportId: string; parentId: string | null; depth: number;
 /** Exact supplied root_id; optional only for a pre-integration presentation view. */
 rootId?: string;
 authorName: string | null; createdAt: string; replyCount?: number; canRedact: boolean;
 permalink?: string; replies?: DiscussionPage;
} & ({ state: 'visible'; body: string } | { state: 'redacted' | 'unavailable'; body?: never })>;
export type DiscussionPage = Readonly<{
 reportId: string; parentId: string | null;
 /** Actual bounded root-to-parent context, including tombstones/unavailable entries. */
 ancestors: readonly DiscussionCommentView[];
 children: readonly DiscussionCommentView[];
 limit?: number; hasMore: boolean; nextCursor?: string | null;
}>;
export type SelectedContext = Readonly<{ state: 'loaded'; target: DiscussionCommentView; ancestors: readonly DiscussionCommentView[] } | { state: 'not-loaded' | 'unavailable'; reportId: string; id: string }>;
export type CreatePayload = Readonly<CommentContext & { requestId: string; body: string }>;
export type DiscussionError = 'invalid-body' | 'rate-limited' | 'not-allowed' | 'parent-unavailable' | 'unavailable';
export type Rejection = Readonly<{ status: 'rejected'; error: DiscussionError; retryAfter?: number }>;
export type SavedComment = Readonly<CommentContext & { status: 'saved'; id: string; permalink?: string; redacted?: boolean; rootId?: string; depth?: number; requestId?: string; createdAt?: string }>;
export type CreateOutcome = SavedComment | Rejection | Readonly<{ status: 'unknown' }>;
export type CreateComment = (payload: CreatePayload) => Promise<CreateOutcome>;
export type RedactOutcome = Readonly<{ status: 'redacted'; comment: DiscussionCommentView }> | Rejection | Readonly<{ status: 'unknown' }>;
export type RedactComment = (target: Readonly<{ reportId: string; id: string }>) => Promise<RedactOutcome>;
export type RequestPage = (target: CommentContext & { cursor: string | null }) => void;

export const publicId = (id: string) => /^[A-Za-z0-9_-]+$/.test(id);
/** Omit an unavailable/invalid supplied link; never construct a substitute. */
export function commentHref(reportId: string, id: string, supplied?: string) {
 // Both exact legacy fragment and prospective selected-comment forms are accepted.
 // This validates supplied targets only; neither resolver nor hard-load landing is wired here.
 const fragment = `/reports/${reportId}#comment-${id}`;
 const selected = `/reports/${reportId}?comment=${id}#comment-${id}`;
 return publicId(reportId) && publicId(id) && (supplied === fragment || supplied === selected) ? supplied : undefined;
}
export function bodyProblem(body: string) {
 const points = [...body];
 if (points.length < 1 || points.length > 2000 || new TextEncoder().encode(body).length > 8192) return true;
 const codes = points.map(char => char.codePointAt(0)!);
 if (codes.some(code => code === 0 || (code >= 0xD800 && code <= 0xDFFF))) return true;
 // UI-only blankness guard matching the supplied draft contract. Accepted text
 // stays byte-for-byte raw; this does not replace backend enforcement.
 return codes.every(code => (code >= 9 && code <= 13) || (code >= 0x2000 && code <= 0x200A) ||
  [0x20, 0x85, 0xA0, 0x1680, 0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF].includes(code));
}
export function rejectionText(error: DiscussionError, retryAfter?: number) {
 const messages: Record<DiscussionError, string> = {
  'invalid-body': 'Use 1–2,000 characters and at most 8 KiB of text.',
  'rate-limited': 'Comment creation is temporarily limited. Your draft is retained.',
  'not-allowed': 'This action is not available for this account. Your draft is retained.',
  'parent-unavailable': 'This reply target is unavailable. Your draft and target are retained.',
  unavailable: 'This action is unavailable. Your draft is retained.',
 };
 const delay = Number.isInteger(retryAfter) && retryAfter! >= 0 && retryAfter! <= 86400 ? ` Retry after ${retryAfter} seconds.` : '';
 return (messages[error] ?? messages.unavailable) + delay;
}
export function validPage(page: DiscussionPage) {
 const limit = page.limit ?? 20;
 if (!publicId(page.reportId) || !Number.isInteger(limit) || limit < 1 || limit > 50 || page.children.length > limit || page.ancestors.length > 9) return false;
 let parent: string | null = null;
 const seen = new Set<string>();
 for (let depth = 0; depth < page.ancestors.length; depth++) {
  const item = page.ancestors[depth];
  if (item.reportId !== page.reportId || item.parentId !== parent || item.depth !== depth || !publicId(item.id) || seen.has(item.id)) return false;
  seen.add(item.id); parent = item.id;
 }
 if (page.parentId !== parent) return false;
 const ids = new Set(page.ancestors.map(item => item.id));
 return page.children.every(item => {
  if (ids.has(item.id) || !publicId(item.id) || item.reportId !== page.reportId || item.parentId !== page.parentId || item.depth !== page.ancestors.length || item.depth > 8 || (item.replyCount !== undefined && (!Number.isInteger(item.replyCount) || item.replyCount < 0))) return false;
  ids.add(item.id); return true;
 });
}
