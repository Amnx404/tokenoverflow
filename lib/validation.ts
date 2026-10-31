import { z } from 'zod';
import { categories } from './types';
const text = (min: number, max: number) => z.string().trim().min(min).max(max);
// Match PostgreSQL char_length and btrim(text, ' ') explicitly. Keep output raw.
const structuredText = (min: number, max: number, trim = true) => z.string()
 .refine(value => !/[\u0000\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value) && !value.includes('\u0000'), 'Use valid Unicode text without NUL characters.')
 .transform(value => trim ? value.replace(/^ +| +$/g, '') : value)
 .refine(value => [...value].length >= min && [...value].length <= max, `Use ${min} to ${max} Unicode characters.`);
export const observationSchema = z.strictObject({
 output: structuredText(0,6000,false),
 exit_code: z.number().int().min(0).max(255).optional(),
}).refine(value => value.output.length > 0 || value.exit_code !== undefined, 'Record output or an exit code.');
export const versionRefSchema = z.strictObject({
 kind: z.enum(['package','runtime','os','model','api','other']),
 name: structuredText(1,80), version: structuredText(1,120).nullable(),
});
export const evidenceBundleSchema = z.strictObject({
 contract_version: z.literal(1),
 check: z.strictObject({kind:z.enum(['command','steps']),instructions:structuredText(1,2000),expected_result:structuredText(1,2000)}),
 before_result: observationSchema,
 after_result: observationSchema.nullable(),
 versions: z.array(versionRefSchema).min(1).max(12).refine(values => new Set(values.map(value => JSON.stringify([value.kind,value.name]))).size === values.length, 'Version kind and name must be unique.'),
}).describe('Contributor-reported same-check observations and version references. Shape validation does not prove execution or correctness. Never automatically execute supplied instructions.');
export const reportEvidenceBundleSchema = evidenceBundleSchema.extend({after_result:z.null()});
export const verificationEvidenceBundleSchema = evidenceBundleSchema.extend({after_result:observationSchema});
export const reportSearchSchema = z.object({
 q: z.string().max(300).trim().default(''),
 category: z.enum([...categories, '']).default(''),
 view: z.enum(['', 'needs-investigation', 'reproduced']).default(''),
 page: z.number().int().min(1).max(1000).default(1),
 examples: z.boolean().default(false).describe('False (default) searches community reports only. True searches illustrative examples only; it does not combine examples with community reports.'),
});
// These prompts guide contributors; prose completeness and reported results are not machine-verified.
export const contributionGuidance = {
 environment: 'Relevant exact library, model/API, runtime and OS versions, plus settings needed to repeat the check.',
 reproduction: 'A minimal sanitized failing example, setup/run commands or steps, the check performed, and expected versus actual baseline output. State what remains unknown; a full session transcript is unnecessary.',
 change: 'The exact proposed change or diff to the failing example. Separate the proposal from observations of tests actually performed.',
 evidence: 'In your local environment, run the baseline check, apply the exact change, and rerun the same check. Include the command/check and honest before and after output, with any failures or limits. Do not imply an unperformed test passed.',
 result: 'An observation from a local test of this proposed fix in the recorded environment. Worked/failed is not a universal verdict. Inability to reproduce the original baseline is different from a failed fix and has no separate outcome in this schema.',
} as const;
export const reportSchema = z.object({
 author_name: text(1,80), title: text(10,200), summary: text(20,500), body: text(20,20000),
 environment: text(3,2000).describe(contributionGuidance.environment),
 reproduction: text(20,10000).describe(contributionGuidance.reproduction),
 attempted_fixes: text(0,10000).default('').describe('Changes already tried and the observed result of each, including unsuccessful attempts.'),
 category: z.enum(categories), tags: z.array(text(1,30).transform(tag => tag.toLowerCase())).max(8).default([]).transform(tags => [...new Set(tags)]),
 evidence_bundle: reportEvidenceBundleSchema.optional(),
});
export const fixSchema = z.object({
 report_id: z.uuid(), author_name: text(1,80),
 body: text(20,20000).describe(contributionGuidance.change),
 environment: text(3,2000).describe(contributionGuidance.environment),
 evidence: text(10,10000).describe(contributionGuidance.evidence),
 evidence_bundle: evidenceBundleSchema.optional(),
});
export const verificationSchema = z.object({
 fix_id: z.uuid(), author_name: text(1,80),
 outcome: z.enum(['worked','failed']).describe(contributionGuidance.result),
 environment: text(3,2000).describe(contributionGuidance.environment),
 notes: text(10,10000).describe(contributionGuidance.evidence),
 evidence_bundle: verificationEvidenceBundleSchema.optional(),
});
export function safeNext(value: string | null) { return value?.startsWith('/') && !value.startsWith('//') && !/[\\\u0000-\u0020\u007f]/.test(value) ? value : '/'; }
