# Evidence contract evolution

Owner: Maya; review: CEO, Leon, Rowan, Nina. Date: 2026-10-30.

**Status: proposal for review; no schema, runtime, or cloud changes approved by this memo.** Accepted product direction is [D013](../decision-log.md): a minimal failing example, exact change, same-check before/after behavior, and relevant versions form the reusable unit. Open investigations remain publishable. Results are contributor observations, never universal verification. Current guidance and truthful worked/failed row labels are implemented separately.

## Smallest useful v1 extension

Keep existing report/fix/verification endpoints and all required legacy fields. Add an optional `evidence_bundle` object to each. Missing object means unstructured evidence; never infer it from prose or backfill a successful test. Reports supply the minimal example through existing `reproduction`; fixes supply the exact change through existing `body`. The bundle makes the check, observations, and version references portable. No execution service, artifact hosting, dependency install, or paid service is needed.

Add a small separate **report reproduction** resource for baseline observations. Do not widen the existing verification `worked|failed` enum: existing clients may exhaustively interpret it, and inability to reproduce the failure is not a failed fix. Proposed `POST /api/v1/reproductions` records `report_id`, `author_name`, `outcome: reproduced|not_reproduced`, `environment`, `notes`, and a baseline bundle. This resource can exist before any fix. Include its rows in an additive `reproductions` array in report detail; Rowan can package the same array for agents. Existing verification endpoints continue to mean results on a particular proposed fix.

Proposed shared types (not executable implementation):

```ts
type VersionRef = {
  kind: 'package' | 'runtime' | 'os' | 'model' | 'api' | 'other';
  name: string;              // 1..80 characters
  version: string | null;   // 1..120 when known; null explicitly means unknown
};
type Observation = {
  output: string;           // 1..6000; sanitized observed output or manual observation
  exit_code?: number;       // integer 0..255; omit for non-process checks
};
type EvidenceBundleV1 = {
  contract_version: 1;
  check: {
    kind: 'command' | 'steps';
    instructions: string;   // 1..2000; text to inspect, never auto-execute
    expected_result: string;// 1..2000; intended correct behavior
  };
  before_result: Observation;
  after_result: Observation | null; // null means no rerun recorded, never success
  versions: VersionRef[];   // 1..12, unique by kind/name; caller states relevance
};
```

A report/reproduction bundle requires `after_result: null`. A fix may have a baseline bundle with null after-result and remains a **proposed change, rerun not recorded**. A structured worked/failed verification requires both observations. Legacy writes without bundles remain valid under existing limits and are labeled unstructured. An unknown version stays visible; formatting checks do not establish that the version or observation is true. No completeness score, verified flag, or accepted answer is introduced.

The same check object applies to both observations. A genuinely different procedure should be recorded as another observation with its own notes, not silently presented as the same-check comparison. The server cannot prove that the contributor actually ran the command. A blocked rerun can be explained in legacy notes/evidence with null after-result on a proposal; it must not create a worked/failed result.

## Outcome rules and preserved negative evidence

| Record | Meaning | Required structured observations | Counts / presentation |
| --- | --- | --- | --- |
| Open report | Investigation, possibly incomplete | Bundle optional | No completed-fix claim |
| Proposed fix | Exact candidate change | Bundle optional; null after allowed | Proposed change; show rerun missing |
| Fix result `worked` | Contributor observed improvement after reproducing baseline | Before and after, same check | Worked result row in its supplied versions |
| Fix result `failed` | Baseline reproduced; candidate change failed its check | Before and after, same check | Failed result row, equally visible |
| Reproduction `reproduced` | Original failure observed locally | Before only | Baseline reproduction row; no fixed claim |
| Reproduction `not_reproduced` | Check ran but original failure was not observed | Before only, notes explain difference | Baseline not reproduced; not counted as failed fix |

Preserve current result rows and negative notes. Do not replace conflicting observations with latest-wins status. Keep current unique account/fix/environment guard for fix results; add equivalent account/report/environment uniqueness for reproduction rows, so this change does not quietly create a history/editing product. No automatic environment canonicalization or version merging: wording differences do not establish distinct environments, and counts remain row counts. API reads include positive and negative rows without a positive-only default. Show reproduced and not-reproduced baseline rows separately from worked/failed fix rows.

Report authors may record baseline observations; mark these as author-reported, not independent. For independent fix results, retain the current different-account rule. Multiple agent keys on one account do not count as independent accounts. A report author testing another account's fix still satisfies the current rule; do not invent a stricter independence claim.

## Concrete proposed payloads

Examples are illustrative, not recorded tests. IDs are placeholders with valid UUID syntax.

A new fix uses the existing `/api/v1/fixes` shape plus the optional bundle:

```json
{
  "report_id": "11111111-1111-4111-8111-111111111111",
  "author_name": "Example contributor",
  "body": "Replace parseInt(input) with Number(input) in the supplied minimal example.",
  "environment": "Node.js 24.0.0 on Linux; input is 1.5",
  "evidence": "The same numeric-conversion check printed 1 before and 1.5 after the change.",
  "evidence_bundle": {
    "contract_version": 1,
    "check": {"kind": "command", "instructions": "node example.mjs", "expected_result": "Print 1.5 for input 1.5"},
    "before_result": {"output": "1", "exit_code": 0},
    "after_result": {"output": "1.5", "exit_code": 0},
    "versions": [{"kind": "runtime", "name": "Node.js", "version": "24.0.0"}, {"kind": "os", "name": "Linux", "version": null}]
  }
}
```

A different account's failed retest retains negative output through existing `/api/v1/verifications`:

```json
{
  "fix_id": "22222222-2222-4222-8222-222222222222",
  "author_name": "Example retester",
  "outcome": "failed",
  "environment": "Node.js 24.0.0 on Linux; localized input is 1,5",
  "notes": "Baseline was reproduced, but the proposed conversion still fails for this input.",
  "evidence_bundle": {
    "contract_version": 1,
    "check": {"kind": "command", "instructions": "node example.mjs", "expected_result": "Print 1.5 for localized input 1,5"},
    "before_result": {"output": "1", "exit_code": 0},
    "after_result": {"output": "NaN", "exit_code": 0},
    "versions": [{"kind": "runtime", "name": "Node.js", "version": "24.0.0"}]
  }
}
```

An inability to reproduce the original baseline goes to the proposed `/api/v1/reproductions`, with no invented fix result:

```json
{
  "report_id": "11111111-1111-4111-8111-111111111111",
  "author_name": "Example retester",
  "outcome": "not_reproduced",
  "environment": "Node.js 24.0.0 on Linux; supplied example revision unclear",
  "notes": "The supplied baseline already prints the expected value. No fixing change was applied.",
  "evidence_bundle": {
    "contract_version": 1,
    "check": {"kind": "command", "instructions": "node example.mjs", "expected_result": "Print 1.5 for input 1.5"},
    "before_result": {"output": "1.5", "exit_code": 0},
    "after_result": null,
    "versions": [{"kind": "runtime", "name": "Node.js", "version": "24.0.0"}]
  }
}
```

## Compatibility, storage and rollout

1. After CEO review, Leon creates nullable JSONB `evidence_bundle` columns on reports/fixes/verifications and one small `report_reproductions` table. Validate the JSON contract in shared Zod and database checks for exposed Data API writes. Preserve existing RLS/grants and independently authorize new writes. Include reproduction rows in the same account-wide contribution quota and agent RPC, not a bypass route. No rewriting of legacy rows; no backfill from prose. Null means absent.
2. Backend supports additive writes and public projections first, retaining old fields/enums and exact status/error shape. For legacy reads omit missing `evidence_bundle`; for new records return it. New writes with bundle reject invalid shape, never silently strip the object. Deploy schema before backend, then forms/MCP input updates. Old writers remain valid throughout; rollback leaves unused nullable data intact.
3. Nina adds optional progressive check/output/version fields. Publishing an open investigation remains available. New structured result forms guide the baseline-first choice: if baseline is not reproduced, record a reproduction observation rather than ask whether the fix worked. Show “structured evidence supplied”, “rerun not recorded”, or “unstructured evidence”; none means verified. Keep both outcomes visible.
4. Rowan adds the fields to portable retrieval allowlists, preserves null/unknown values, and offers a dedicated baseline-result write tool only after the mutation service exists. No synthetic conversion of old prose into structured proof. Existing `get_report` output adds reproduction rows; transport/package revision must distinguish additive contract support from actual record completeness. MCP envelope budgeting must account for the extra fields.

One JSONB column per existing record avoids many nullable relational columns; a separate baseline resource avoids overloading a stable result enum. This is a modest schema extension, but still requires coordinated database/service/agent/UI review. If deferred, keep current guidance and truthful labels; do not advertise typed bundles or a baseline-negative outcome as available.

## Limits, privacy and verification gate

Retain the HTTP contribution cap of **60,000 UTF-8 bytes** and MCP envelope cap of 65,536 bytes. Apply the same serialized contribution bound in the shared mutation service for website/tRPC/new reproduction writes too. Per-field character limits above are secondary; Unicode can exhaust the byte budget sooner. Existing legacy field maxima remain; combined submissions may hit the existing payload cap. Keep examples/output short, manually redact credentials/private paths/customer identifiers, and show a public-content notice. No raw transcript/attachment upload, remote URL fetching, command execution, or claim of automatic secret detection. Render as escaped text; public projections still exclude account/key IDs.

Before implementation acceptance: old payload/read smoke stays compatible; new bundle shape/default/size checks; transaction rollback of invalid exposed-API writes; ownership/independence/quota tests for the new table; negative results survive retrieval; not-reproduced rows never increment failed-fix counts; null after-result never appears as success; anonymous/public retrieval remains public; output budgets/truncation preserve access to omitted evidence; no private identifiers leak. A fresh production build and meaningful runtime tests follow implementation, not this proposal.

## Files and owners affected if approved

| Area | Expected files/interfaces | Owner |
| --- | --- | --- |
| Shared contract | `lib/validation.ts`, `lib/types.ts`; new bundle/reproduction schemas | Maya |
| Persistence and guards | `server/db/schema.ts`, reviewed SQL change under `supabase/changes/`, `supabase/schema.sql`, access tests | Leon |
| Mutation and reads | `server/services/contributions.ts`, `reports.ts`, agent RPC; shared byte limit and quota | Maya / Leon |
| Website/tRPC/HTTP | `server/api/root.ts`, `app/actions.ts`, `lib/api.ts`, new reproduction route and public projection | Maya |
| Forms/detail/docs | `components/forms.tsx`, report detail, agent guide; no accepted badge | Nina |
| MCP portable output/tools | `app/api/mcp/route.ts`, Rowan's packaging helper and install documentation | Rowan / Maya for write rules |
| Verification | `scripts/qa/`, database access tests, compatibility fixtures | Jules / Leon |

No external research or new service capability is assumed. This memo is based on the current repository contract and D013. Approval needed: accept the additive bundle and separate baseline resource before implementation. No founder clarification blocks this design handoff.
