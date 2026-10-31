# Evidence contract — package A proposal

Maya (Backend engineer), 2026-10-30. Review: Rafael (Engineering lead), Leon (Platform and data engineer), Arjun (Backend engineer), Rowan (MCP engineer), Nina (Frontend engineer), Jules (Quality engineer).

**Current status: Codex (CEO)/Rafael (Engineering lead) closed A COMPLETE and production verified under D033; [executed production evidence](2026-10-30-evidence-platform-production.md) binds main `687da4670e0999b687025e4c9f3074eff918087c`, tree `da47f6662e55ada9a5200cbf7fd6799423d5b2d9` and deployment `dpl_4pYcKLnWzDwrcA9vr2kEfw9ZC1sJ` to additive→compatible application/read gates→restrictive privacy. This compatible floor supersedes earlier pending-rollout statements below: old C/3c48 SELECT-star rollback and raw-identifier regrant are unsupported; accepted transport SQL-NULL absence remains distinct from invalid shared-application null/literal JSONB null, with no RPC redesign. Typed production writes remain unverified; no synthetic production writes or real signup/mail/OAuth/session/full-MVP acceptance is implied.** [D013](../decision-log.md) defines the reusable unit; shape validation does not establish executed evidence.

Rafael narrowed package A to additive typed evidence on the **existing report, fix and verification resources only**. This supersedes this memo's earlier broader proposal for a baseline reproduction resource. That new table/endpoint/tool/outcome is deferred. Package A does not depend on OAuth setup, a new execution service, artifact hosting, or paid infrastructure; real authenticated-write acceptance still requires an actual authorized identity.

## Minimal contract and record-specific rules

Keep every existing required field and the existing `worked|failed` outcome enum. Add optional `evidence_bundle` to the three resources; existing report `reproduction` remains the minimal example, fix `body` remains the exact change, and legacy `evidence`/`notes` remain readable. Do not add a separate completeness/accepted/verified field.

```ts
type VersionRef = {
  kind: 'package' | 'runtime' | 'os' | 'model' | 'api' | 'other';
  name: string;              // U+0020 edge-trim only, 1..80 Unicode code points
  version: string | null;   // U+0020 edge-trim, 1..120 code points; null unknown
};
type Observation = {
  output: string;           // 0..6000 Unicode code points; preserve observed whitespace
  exit_code?: number;       // integer 0..255; omit for non-process checks
};
type EvidenceBundleV1 = {
  contract_version: 1;
  check: {
    kind: 'command' | 'steps';
    instructions: string;   // U+0020 edge-trim, 1..2000; never auto-execute
    expected_result: string;// U+0020 edge-trim, 1..2000; intended correct behavior
  };
  before_result: Observation;
  after_result: Observation | null;
  versions: VersionRef[];   // 1..12; unique exact kind + case-sensitive edge-trimmed name
};
```

New bundle string limits count Unicode code points (matching PostgreSQL `char_length`), not JavaScript UTF-16 code units; reject NUL and unpaired surrogates before JSONB storage. Rafael (Engineering lead) settled all stated-trim structured fields—check instructions/expected result and version name/version—to U+0020-only edge trimming, resolving the earlier generic check-trim wording. Observed output stays raw. For version identity, compare the enum kind plus resulting name exactly/case-sensitively; preserve internal whitespace, case and Unicode without locale folding. All other normalization must be explicit, not an environment canonicalization scheme.

An observation preserves raw whitespace; whitespace-only output is observed nonempty text, not proof of useful evidence. It must contain nonempty output **or** an exit code: a successful no-output check with exit code 0 is legitimate. Do not require nonzero baseline exit codes or infer success from exit 0; output can show a failed assertion despite exit 0. Never compare free text automatically to declare a fix correct. Versions are supplied references, not authenticated package inventories; explicit unknowns remain visible.

| Record | If a bundle is supplied | Honest presentation |
| --- | --- | --- |
| Report | All keys required; before observation required; `after_result` must be null | Baseline supplied, investigation open; minimal example still comes from reproduction text |
| Fix | All keys required; before required; after may be null | Exact proposed change; null after means rerun not recorded |
| Verification | All keys required; both before and after observations required | Contributor-reported worked/failed result in recorded conditions |

The bundle itself is optional. Present-but-partial objects, unknown nested keys, unsupported contract versions and invalid version duplicates are rejected, not silently stripped. Top-level legacy behavior remains. Top-level null bundle is rejected on write; absent is the legacy form. Database NULL represents absent; public reads omit absent bundles rather than manufacture an object. Both outcomes retain their observations; no positive-only default or latest-result-wins replacement.

One check object applies to before and after. This structurally ties a record's comparison together but cannot prove identical commands were run or that observations are true. A baseline-not-reproduced test must **not** be submitted as a failed-fix verification. During this narrow phase, record that limitation in an open finding's prose or proposed-fix evidence; no dedicated structured baseline-negative outcome is advertised. This is the principal capability sacrificed by deferring the reproduction resource. New proposals may retain a null after result and explain untested/blocked work; legacy verifications remain legacy and are not retroactively required to supply structured proof.

## Payload examples (illustrative, not actual tests)

Existing `/api/v1/fixes`, plus optional bundle:

```json
{
  "report_id": "11111111-1111-4111-8111-111111111111",
  "author_name": "Example contributor",
  "body": "Replace parseInt(input) with Number(input) in the supplied minimal example.",
  "environment": "Node.js 24.0.0 on Linux; input is 1.5",
  "evidence": "The same conversion check printed 1 before and 1.5 after the change.",
  "evidence_bundle": {
    "contract_version": 1,
    "check": {"kind": "command", "instructions": "node example.mjs", "expected_result": "Print 1.5 for input 1.5"},
    "before_result": {"output": "1", "exit_code": 0},
    "after_result": {"output": "1.5", "exit_code": 0},
    "versions": [{"kind": "runtime", "name": "Node.js", "version": "24.0.0"}, {"kind": "os", "name": "Linux", "version": null}]
  }
}
```

A different account's negative result on existing `/api/v1/verifications`:

```json
{
  "fix_id": "22222222-2222-4222-8222-222222222222",
  "author_name": "Example retester",
  "outcome": "failed",
  "environment": "Node.js 24.0.0 on Linux; localized input is 1,5",
  "notes": "Baseline was reproduced, but the proposed change still fails for this input.",
  "evidence_bundle": {
    "contract_version": 1,
    "check": {"kind": "command", "instructions": "node example.mjs", "expected_result": "Print 1.5 for localized input 1,5"},
    "before_result": {"output": "1", "exit_code": 0},
    "after_result": {"output": "NaN", "exit_code": 0},
    "versions": [{"kind": "runtime", "name": "Node.js", "version": "24.0.0"}]
  }
}
```

An unresolved original trigger remains publishable through existing `/api/v1/reports`, with **no bundle or verification invented**:

```json
{
  "author_name": "Example investigator",
  "title": "Baseline differs from the reported numeric conversion failure",
  "summary": "The supplied baseline already returns the expected number in this environment; the original trigger remains unknown.",
  "body": "No fixing change was applied. This open investigation records the inability to reproduce the reported original failure, not a failed fix.",
  "environment": "Node.js 24.0.0 on Linux; supplied example revision unclear",
  "reproduction": "Run node example.mjs with input 1.5. Observed 1.5 already, so no before/after comparison was performed.",
  "attempted_fixes": "No candidate change tested because the original baseline did not fail.",
  "category": "Other",
  "tags": ["numeric-conversion"]
}
```

## Storage, compatibility and enforcement

For the approved local implementation, Leon owns nullable JSONB `evidence_bundle` columns on reports/fixes/verifications, exposed Data API shape/field constraints, explicit writable-column grants, and optional agent RPC forwarding. No new table, outcome, public endpoint, execution service or backfill. Preserve RLS, independent-account checks, immutable result history/unique account-fix-environment guard, and existing shared quota. Null legacy rows stay null; never infer structured output from prose.

Maya adds shared Zod bundle schemas/refinements and two named compact normalized JSON limits: **12,288 UTF-8 bytes for the bundle** and **60,000 UTF-8 bytes for the whole contribution**. Both are enforced in **both** `createContribution` and `publishAgentContribution` before database work. The new shared whole-contribution restriction can reject formerly possible combined website/tRPC submissions over 60,000 bytes; this intentional compatibility restriction aligns contribution cost and privacy across application entrypoints instead of leaving a transport bypass. Preserve HTTP's existing raw-body 60,000-byte cap and MCP's 65,536-byte envelope cap. The shared service counts UTF-8 bytes of normalized allowlisted compact JSON (`JSON.stringify`) (including identity-derived author name on website writes); this catches multibyte combined payloads through website actions, direct tRPC and agent RPC callers too. Individual field maxima remain secondary. Proposed typed `PAYLOAD_TOO_LARGE` ServiceError maps to HTTP/tRPC 413 with the current small error-object convention; no payload is logged. Accepted payloads may still hit a transport limit before service validation because raw formatting/envelope bytes differ.

Direct authenticated Data API clients bypass application services. Leon agreed a separately named **SQL bundle-storage ceiling of 16,384 bytes** measured by `octet_length(evidence_bundle::text)`, on the JSONB object alone, plus strict nested shape/code-point limits. This is not byte-identical to compact application JSON. Existing direct-client aggregate field behavior remains: no new whole-row cap that counts server IDs/timestamps or silently rejects legacy Unicode records. SQL NULL means absence; JSON literal null is invalid. The strict invoker helper must be checked with `IS TRUE` so SQL unknown/NULL cannot bypass validation. No extension or index is needed. Do not advertise application byte budgets as the direct Data API contract.

Actual SQL implementation requires direct writers to supply already-normalized U+0020-edge-trimmed check/version fields; padded values are rejected rather than transformed in SQL. Application paths perform that normalization before forwarding. Raw observations and legacy aggregate policy stay unchanged. The reviewed source artifacts are [phase 1 additive storage/helper/RPC](../../supabase/changes/20261031011039_evidence_bundle_additive.sql) and [phase 3 restrictive privacy grants](../../supabase/changes/20261031011132_evidence_privacy_restrict.sql); source review is not target execution evidence.

Roll out database compatibility before application forwarding; then service/read projections, then forms and MCP. Existing payloads without bundles remain valid under prior semantic rules, subject to the new shared service byte cap. Reads add bundle only when supplied; existing legacy strings/enums/IDs/statuses remain. No truncation on storage, no automatic fetching of linked content, no attachments/full transcripts, and no secret-detection promise. Escape text and warn that all submitted material is public. The bundle is a rendering/portability aid, not verified evidence. Rowan retains full exact detail/REST retrieval with no A truncation: total detail size across many fixes/results is already unbounded, and the new input ceiling does not bound whole-report output or model context. Cursor paging/output budgeting is a separate proposal, never a silent evidence drop.

## Isolated proof and production boundary

Leon is preparing a reversible **PostgreSQL 18.6** isolated fixture using the current schema; hosted production is PostgreSQL 17. Local results must be labeled PG18, not production-equivalent. Proposed A helper design uses a pure PostgreSQL invoker function with explicit object/required-key/type checks, bounded arrays/strings, cross-record after-result rules and `IS TRUE` enforcement; no extension. Inspect PostgreSQL-17 syntax compatibility before approving production DDL, and validate on a PostgreSQL-17 target when available. Current-schema fixture preparation is not authority for production A DDL; the newly approved A implementation/local acceptance is separate from the still-pending production migration gate.

A controlled local auth shim/SQL-provisioned account can exercise identity/key/service/application rules, but is **not real GitHub OAuth**, email confirmation or Supabase session acceptance. Local database-role checks prove SQL grants/RLS; without a local PostgREST/Supabase Data API HTTP service they do not establish generated Data API HTTP behavior. Report those gaps explicitly, not as generic end-to-end authentication success. No production successful write or induced outage is authorized for these preparations.

Schema-first production rollout is mandatory after migration/PG17 approval: apply reviewed nullable columns/helper/constraints/grants/RPC compatibility before an application build forwards bundles, then validate actual stored roundtrips through each supported path, then enable optional forms/tools. Do not deploy a bundle-accepting parser that silently discards the new object in old INSERT/RPC code. Preserve legacy absence in both rollout and rollback; leave stored bundles intact on app rollback.

**Accepted local privacy-closure staging:** Codex (CEO) separately approved closing the existing direct-read account-ID gap within this A data cohort. The privacy revokes have the opposite compatibility order from additive bundle storage: (1) additive bundle columns/constraints/RPC and the ownership helper with old read grants; (2) compatible application reads with explicit evidence-only columns and fresh-identity ownership lookup; (3) restrictive SELECT grants and typed-NULL feed identity after that application is verified. The settled helper is `public.fix_ownership(p_report_id uuid) RETURNS TABLE(id uuid, is_own_fix boolean)`, authenticated-only, tied to nonnull `auth.uid()` without a caller-selected account ID; map only fix IDs already loaded in the detail. A separate positive independent-fix predicate must return false for missing fixes or null identity. After stage 3, the old SELECT-all application is not a safe rollback: retain a minimum compatible application floor or seek a separately reviewed temporary regrant. Stored bundles remain intact. Source/synthetic app projection checks do not prove direct SQL/Data API grants or actual helper execution; those are platform/runtime gates. Production DDL remains unapproved.

## Interface owners and acceptance gate

| Surface | Expected impact / owner |
| --- | --- |
| Shared contract and limits | `lib/validation.ts`, `lib/types.ts`, service errors and both shared contribution entrypoints — Maya |
| Persistence/RPC | `server/db/schema.ts`, reviewed SQL under `supabase/changes/`, canonical schema/grants/RLS/agent RPC and access tests — Leon |
| Browser/tRPC/REST writes | Actions/form serialization, shared mutation parsing, Drizzle explicit INSERT columns; REST schemas remain shared — Maya/Nina |
| Public reads | Service types plus `lib/api.ts` public allowlist; never spread account/key data — Maya/Leon |
| Forms and detail | Progressive optional fields and unstructured/missing-rerun/unknown-version labels — Nina |
| MCP tools and packaging | Shared input schemas, explicit bundle output, complete negative observations, no inferred fields — Rowan/Maya |
| Independent evidence | Old/new payload compatibility, null/partial/refinement cases, oversized UTF-8 payloads on service paths, exposed Data API malformed JSON, negative retrieval/privacy — Jules/Leon; Arjun peer review |

Required bounded acceptance: old writes/read fixtures unchanged; report rejects after observation, fix accepts null after, structured verification rejects null after; malformed objects are rejected before persistence; valid no-output exit-0 observation works; unknown version is preserved; worked and failed observations both round-trip; canonical byte limit rejects combined multibyte overflow without DB work; each write path persists the optional object; existing independence/quota/privacy rules still hold; a supplied bundle is never labeled executed/verified. Final runtime evidence must use the actual reviewed artifact; synthetic tests do not establish a real authenticated write or adoption.

**Alternative/risk considered:** ship prose guidance alone until an actual contribution warrants schema. It avoids migration but leaves output/check extraction ambiguous. Recommended A is the smallest coherent machine-readable vertical slice; the baseline-negative resource remains a separate future proposal. Narrowed implementation/local acceptance is approved; production DDL remains a separate gate.
