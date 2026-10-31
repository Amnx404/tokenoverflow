# Lean example read — local implementation evidence

Implemented by Toby (Backend implementation intern), direct report of Maya (Backend engineer). Maya (Backend engineer) owns acceptance; Felix (Frontend engineer) independently reviews Home. This is source/synthetic evidence, not release or runtime acceptance.

Only integrated source slices changed: bottom example helper in `server/services/reports.ts`, plus example import/request sequencing in `app/page.tsx`. The existing A public projections, bundles, ownership helper and other service functions are retained. Home markup, normalized filters, count, links and stale-page recovery remain unchanged.

`getExampleReportId(): Promise<string|null>` reads `reports.id` where `is_example=true`, ordered `created_at DESC, id ASC`, limit 1, through either public Data API or the existing Drizzle `withDatabase` boundary. No feed/count request, extra columns, schema, role/claims, pool or cache changes. Home first resolves its main list; only `count===0 && !q && !category && !view && !examples` triggers lookup, and only a non-null ID triggers full detail. There is deliberately no page-1 condition. Main-list/needed-lookup failures retain the existing fixed load error; detail errors retain their prior behavior.

## Verified locally

- `node scripts/qa/lean-example-read.mjs`: PASS. Actual source is transpiled with installed dependencies and isolated adapters; real Drizzle query construction compiles one `SELECT id FROM reports` with `[true,1]` parameters and deterministic ordering, while the Data API mock observes exactly the equivalent projection/filter/order/limit. Null/error paths and use of `withDatabase` pass. This mocks the boundary and does not execute or re-certify real restricted-role SQL.
- 13 Home request-graph cases PASS, each also comparing actual server-rendered markup to the C commit's original Home with the same synthetic data: empty default, empty page1000, whitespace, query, category, both views, examples, populated default, count-positive stale page, filtered stale page, missing example, invalid normalized parameters. Two unused-lookup failure skips and three list/lookup/detail failure paths PASS. Calls resolve list before lookup before detail. No HTTP status or hydration/browser behavior is inferred.
- Focused ESLint on both source files and the QA file: PASS. Whole-tree `tsc --noEmit --incremental false`: PASS. Source `git diff --check`: PASS.
- `standalone-C.patch` applies cleanly with ordinary patch dry-run and application to temporary copies from live C `790862f919cd853c09998217f2587a8d8a88fb94`; its resulting Home and helper are identical to integrated source. It includes only those two files and no A bundle/schema references. No index/history mutation.

## Exact artifacts and remaining gate

SHA-256:

- Home: `0bb0fe0252213da2d6ebaa915127510da486d758cac1c95b67c70fe3f9604f0b`
- Integrated reports service: `cddc252e9208074a344b379b604ca01cd1defbcd530e564810f0439da1ff0995`
- Standalone C patch: `52124e2ad32408e3ca773c2e18627190828a30f4bfe60ebc9a55ca5d9d9789ef`

No DB/network/server/build, credentials, fixture, cloud or production writes were used. No measured speedup is claimed. Parent/platform owners coordinate comparable same-environment before/after timing, exact runtime/deployment and security acceptance separately. A frozen artifact acceptance is separate. Parent integrates this handoff into the canonical owner note; this intern's lease does not permit existing documentation edits.
