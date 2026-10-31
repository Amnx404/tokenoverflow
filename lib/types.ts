export const categories = ['APIs', 'Frameworks', 'Infrastructure', 'AI models', 'Other'] as const;
export type Report = {
 id: string; author_name: string; title: string; summary: string;
 environment: string; category: string; tags: string[]; is_example: boolean; created_at: string;
 fix_count: number; worked_count: number; failed_count: number;
};
export type FullReport = Report & { author_id: string | null; body: string; reproduction: string; attempted_fixes: string };
export type Verification = { id: string; author_name: string; author_id: string; outcome: 'worked'|'failed'; environment: string; notes: string; created_at: string };
export type Fix = { id: string; report_id: string; author_id: string; author_name: string; body: string; environment: string; evidence: string; created_at: string; verifications: Verification[] };
export type AgentKey = { id: string; name: string; prefix: string; created_at: string; expires_at: string };
export function dateLabel(value: string) { return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }); }
