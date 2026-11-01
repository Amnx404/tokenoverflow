import { z } from 'zod';
const uuid=z.uuid().transform(value=>value.toLowerCase());
// Explicit pinned whitespace set, shared literally with the SQL validation rule.
export const discussionWhitespace=/^[\u0009-\u000d\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]*$/u;
export const discussionBodySchema=z.string().refine(value=>!value.includes('\0')&&!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value),'Use valid Unicode without NUL.').refine(value=>[...value].length>=1&&[...value].length<=2000,'Use 1–2000 Unicode scalar values.').refine(value=>new TextEncoder().encode(value).length<=8192,'Use at most 8192 UTF-8 bytes.').refine(value=>!discussionWhitespace.test(value),'Write a nonblank comment.');
export const appendDiscussionSchema=z.strictObject({report_id:uuid,parent_id:uuid.nullable(),request_id:uuid,body:discussionBodySchema});
export const redactDiscussionSchema=z.strictObject({comment_id:uuid});
export const discussionCursorSchema=z.strictObject({v:z.literal(1),report_id:uuid,parent_id:uuid.nullable(),last_id:uuid});
export const discussionPageSchema=z.strictObject({report_id:uuid,parent_id:uuid.nullable().default(null),limit:z.number().int().min(1).max(50).default(20),cursor:z.string().regex(/^[A-Za-z0-9_-]+$/).max(512).optional()});
export const discussionContextSchema=z.strictObject({report_id:uuid,comment_id:uuid});
const timestamp=z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
export const publicDiscussionSchema=z.object({id:uuid,report_id:uuid,parent_id:uuid.nullable(),root_id:uuid,depth:z.number().int().min(0).max(8),author_name:z.string().refine(value=>[...value].length<=80).nullable(),body:discussionBodySchema.nullable(),created_at:timestamp,redacted_at:timestamp.nullable()}).refine(value=>value.parent_id===null?value.depth===0&&value.root_id===value.id:value.depth>=1&&value.parent_id!==value.id&&value.root_id!==value.id).refine(value=>value.redacted_at===null?value.body!==null&&value.author_name!==null:value.body===null&&value.author_name===null);
