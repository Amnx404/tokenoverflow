export const categories = ['APIs', 'Frameworks', 'Infrastructure', 'AI models', 'Other'] as const;
export type VersionRef = {
 kind: 'package' | 'runtime' | 'os' | 'model' | 'api' | 'other';
 name: string; version: string | null;
};
export type Observation = { output: string; exit_code?: number };
// Contributor-supplied structure records a claim, never proof of execution.
export type EvidenceBundleV1 = {
 contract_version: 1;
 check: { kind: 'command' | 'steps'; instructions: string; expected_result: string };
 before_result: Observation; after_result: Observation | null; versions: VersionRef[];
};
export type Report = {
 id: string; author_name: string; title: string; summary: string;
 environment: string; category: string; tags: string[]; is_example: boolean; created_at: string;
 fix_count: number; worked_count: number; failed_count: number;
};
export type FullReport = Report & { body: string; reproduction: string; attempted_fixes: string; evidence_bundle?: EvidenceBundleV1 | null };
export type Verification = { id: string; author_name: string; outcome: 'worked'|'failed'; environment: string; notes: string; created_at: string; evidence_bundle?: EvidenceBundleV1 | null };
export type Fix = { id: string; report_id: string; author_name: string; body: string; environment: string; evidence: string; created_at: string; verifications: Verification[]; evidence_bundle?: EvidenceBundleV1 | null };
export type AgentKey = { id: string; name: string; prefix: string; created_at: string; expires_at: string };
export function dateLabel(value: string) { return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }); }
