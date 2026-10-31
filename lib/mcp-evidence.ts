import type { publicReportDetail } from './api';
import type { Report } from './types';
import { z } from 'zod';

const reportUrl = (id: string) => `https://tokenoverflow.app/reports/${encodeURIComponent(id)}`;

export async function contributionReceipt(
  data: Record<string, unknown>, status: number,
  resolveReport: (kind: 'fix' | 'verification', id: string) => Promise<string | null>,
): Promise<Record<string, unknown>> {
  const receipt = { ...data, status };
  const id = z.uuid().safeParse(data.id);
  if (status !== 201 || !id.success) return receipt;
  try {
    const reportId = data.kind === 'report' ? id.data
      : data.kind === 'fix' || data.kind === 'verification' ? await resolveReport(data.kind, id.data) : null;
    if (reportId && z.uuid().safeParse(reportId).success) return { ...receipt, source_url: reportUrl(reportId) };
  } catch {
    // A post-save link lookup must not suggest the successful write should be retried.
  }
  return receipt;
}

// Keep search small and explicit: no full bodies, private IDs, or inferred verdicts.
export function searchEvidence(data: { reports: Report[]; count: number }) {
  return {
    reports: data.reports.map(r => ({
      id: r.id, url: reportUrl(r.id), title: r.title, summary: r.summary,
      environment: r.environment, category: r.category, tags: r.tags,
      is_example: r.is_example, created_at: r.created_at, author_name: r.author_name,
      fix_count: r.fix_count, worked_count: r.worked_count, failed_count: r.failed_count,
    })),
    count: data.count,
    result_scope: 'Worked and failed counts are contributor-reported observations, not distinct environments or a universal verdict. Fetch get_report for exact changes, recorded environments and all observed outcomes.',
  };
}

export function reportEvidence(data: ReturnType<typeof publicReportDetail>) {
  return {
    ...data,
    url: reportUrl(data.report.id),
    evidence_format: 'Raw contributor text: report.reproduction is the baseline example; report.attempted_fixes retains prior attempts; fixes[].body is the proposed change; fixes[].evidence is the recorded check/output; fixes[].verifications[] retains worked and failed observations, environments and notes. Versions are recorded in environment text. Check/before/after completeness and results are not machine-verified.',
  };
}
