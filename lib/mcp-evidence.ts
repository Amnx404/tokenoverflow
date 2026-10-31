import type { publicReportDetail } from './api';
import type { EvidenceBundleV1, Report } from './types';
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

// Inputs have already passed the shared public record projection. Select nested bundle
// fields again so future stored metadata cannot become an implicit MCP export.
function withEvidenceBundle<T extends object>(
  record: T & { evidence_bundle?: EvidenceBundleV1 | null },
): Omit<T, 'evidence_bundle'> & { evidence_bundle?: EvidenceBundleV1 } {
  const { evidence_bundle: bundle, ...fields } = record;
  if (bundle == null) return fields;
  const observation = (value: EvidenceBundleV1['before_result']) => ({
    output: value.output,
    ...(value.exit_code === undefined ? {} : { exit_code: value.exit_code }),
  });
  return {
    ...fields,
    evidence_bundle: {
      contract_version: bundle.contract_version,
      check: {
        kind: bundle.check.kind,
        instructions: bundle.check.instructions,
        expected_result: bundle.check.expected_result,
      },
      before_result: observation(bundle.before_result),
      after_result: bundle.after_result === null ? null : observation(bundle.after_result),
      versions: bundle.versions.map(version => ({
        kind: version.kind, name: version.name, version: version.version,
      })),
    },
  };
}

export function reportEvidence(data: ReturnType<typeof publicReportDetail>) {
  return {
    ...data,
    report: withEvidenceBundle(data.report),
    fixes: data.fixes.map(fix => ({
      ...withEvidenceBundle(fix),
      verifications: fix.verifications.map(verification => withEvidenceBundle(verification)),
    })),
    url: reportUrl(data.report.id),
    evidence_format: 'Raw contributor text remains complete: report.reproduction is the baseline example; report.attempted_fixes retains prior attempts; fixes[].body is the proposed change; fixes[].evidence is the recorded check/output; fixes[].verifications[] retains every worked and failed observation, environment and note. Optional evidence_bundle supplies a versioned same-check comparison alongside that prose; absent bundles are legacy/unstructured, after_result null means no rerun recorded, and versions[].version null means unknown. Preserve recorded output and exit codes without inferring success. Versions in legacy environment text are not parsed into invented bundle fields. Shape completeness, execution, applicability and results are not machine-verified. Full detail is not truncated; lifetime report size is unbounded despite per-record input limits.',
  };
}
