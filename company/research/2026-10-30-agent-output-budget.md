# Structured evidence: retrieval and output budget review

Owner: Rowan (MCP engineer). Reviewer: Imani (MCP engineer). Date: 2026-10-30 PDT.

Status: narrowed A code and isolated local acceptance approved under the final evidence contract. MCP source implementation and reciprocal synthetic review are complete; this memo is output-boundary rationale, not a stored-roundtrip or deployed acceptance result. Production DDL/forwarding still requires reviewed migration and PostgreSQL-17 target validation. C harness/doc/schema-description changes are an independent quality package.

## Smallest sound A behavior

Keep an optional typed bundle on existing reports/fixes/results only. Defer the separate baseline resource/tool. Keep existing required legacy evidence and full exact public REST/MCP detail output; add no sixth tool, preview, positive-only filter or silent truncation. A record's supplied typed data is contributor evidence, not executed or machine-verified content. Raw legacy prose remains available and is not parsed into invented typed fields.

Use absence for a legacy/unstructured bundle in public output. Database NULL denotes no bundle; do not manufacture a successful check from it. Reject an explicit top-level null bundle on writes rather than treating malformed supplied data as omitted. `after_result: null` is an explicit missing rerun on a report/proposal, never success; a structured worked/failed result needs both observations. Preserve `versions[].version: null` as explicitly unknown. An empty process output with a supplied zero exit code can be a valid observation; never fill in that code automatically. All existing negative results and unknown/version scope survive retrieval.

Rafael settled these named, deliberately distinct budgets with Maya/Leon:

| Boundary | Budget | Definition |
| --- | --- | --- |
| Application bundle | 12,288 bytes | UTF-8 of normalized compact application JSON |
| Whole application contribution | 60,000 bytes | UTF-8 of the complete normalized contribution |
| Database bundle | 16,384 bytes | Authoritative strict-shape SQL bundle budget using `jsonb::text` |

These serializers/admission boundaries are not byte-identical. Direct Data API follows the SQL bundle boundary and prior legacy aggregate policy; it does not magically inherit the application's normalized whole-request rule. State that difference explicitly. Fields can meet their individual character limits yet exceed a bundle or contribution byte budget; reject atomically with a useful validation error, never drop a field or silently fall back to legacy. Maya/Leon own exact ASCII/CJK/escaping boundary fixtures across actual paths before migration acceptance.

This is the accepted bounded A change. No outbound response-byte limit was identified in the installed server SDK review; that does not establish client transport or model-context capacity. Existing `maxRequestBodySize` concerns incoming requests, not outbound evidence. A complete server/SDK response does not prove the consuming model received every record. Client transport, persisted-output and model-context limits differ, so these per-record budgets must not be called a complete response or token budget. Wren (Researcher) documents current official client transport/persisted-output/context boundaries in [the client-constraints memo](2026-10-30-client-output-constraints.md), separately from installed-version acceptance. Rowan (MCP engineer) reviewed its logical/source-scope distinctions without re-fetching vendor pages or auditing client implementations; no actual Token Overflow client-limit failure is established.

## Growth evidence and limits

Deterministic illustrative serialization calculations, not public data or observed operator demand: the original proposed bundle with 2,000-character check/instructions, 2,000-character expected result, two 6,000-character outputs and twelve 80/120-character version references serializes to 19,092 bytes using ASCII, 55,864 using CJK text, or 111,022 with JSON-escaped control characters in those text fields. These are pre-aggregate-cap combinations and can be rejected by the chosen new limits; individual field maxima are not a promise of joint admission.

For one illustrative report with existing field maxima, ten fixes and ten result rows per fix:

| Shape | Public detail JSON | MCP JSON with text plus structuredContent |
| --- | ---: | ---: |
| Legacy fields only | 1,588,289 bytes | 3,179,362 bytes |
| Original proposed full ASCII bundles, before aggregate caps | 3,703,587 bytes | 7,429,932 bytes |

The calculation uses failed observations as well as ordinary public fields; none are removed. It illustrates growth rather than an upper bound: lifetime row counts are unbounded today, and duplicate JSON text/structured output increases size. A 12,288-byte application bundle reduces per-record growth but cannot bound an arbitrarily large report. Preserving full output is deliberate and honest; clients can use complete public source/REST access, but a source link alone would not justify hiding records in MCP.

Queue real database-level continuation/paging separately if operator evidence requires it. It must provide retrievable complete raw records, deterministic cursors and explicit omitted/remaining state for both outcomes. Do not introduce post-load slicing, an inaccessible preview, or a “complete evidence” claim. This proposal changes no paging behavior.

## Illustrative small payload

This is an example of a supplied bundle, not a recorded test or a complete contribution request:

```json
{
  "contract_version": 1,
  "check": {
    "kind": "command",
    "instructions": "node example.mjs",
    "expected_result": "Print 1.5 for input 1.5"
  },
  "before_result": {"output": "1", "exit_code": 0},
  "after_result": {"output": "1.5", "exit_code": 0},
  "versions": [
    {"kind": "runtime", "name": "Node.js", "version": "24.0.0"},
    {"kind": "os", "name": "Linux", "version": null}
  ]
}
```

The zero exit codes do not establish that the expected check passed; the contributor's observed output and outcome remain necessary. The check text is untrusted evidence, never an instruction for automatic execution.

## Review and next evidence

Imani independently agrees with narrowed existing-resource/null semantics and full exact retrieval, while requiring distinct byte-rule documentation, UTF-8/escaping fixtures and no aggregate guarantee. Rowan accepts Rafael's settled layer budgets as a retrieval contract recommendation. Maya owns shared schema/validation; Leon owns database/access verification; Code/local acceptance is approved; reviewed production migration and PostgreSQL-17 target validation remain required before production forwarding. Robin's next changed-artifact acceptance must distinguish real approved fixtures from labeled examples and preserve the existing empty-corpus boundary. No new authenticated contribution or community test evidence is claimed here.

## A implementation handoff

Nested optional MCP bundle export and existing-tool descriptions are implemented in source; Imani (MCP engineer)'s independent actual-route/service tests pass mixed legacy/typed privacy, full negative evidence, five-tool discovery, both protocol eras and exact application byte boundaries with mocked persistence. Rowan (MCP engineer) reviewed the final QA output. These results do not establish SQL's separate storage ceiling, stored roundtrips, actual-client recovery, model-context consumption or deployment. See [Rowan (MCP engineer)'s settled handoff](../people/rowan.md#settled-a-mcp-source-and-independent-review).
