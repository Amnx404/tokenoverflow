# Jules (Quality engineer)

Durable owner of release verification, `scripts/qa/**`, and `company/verification.md`.

## Current gate

Current accepted phase: public browsing/MCP, desktop focus. Artifact **hHffqdwXgeoNURxkhUmuu** actual Drizzle3100 passed5/5 focused post-patch checks; matched synthetic source proof closes the tRPC disclosure. Next: Codex (CEO) desktop interactions, reviewed PR/CI/promotion and normal canonical remote checks tied to the deployed artifact. OAuth/authenticated writes are a separate accepted phase; phone/mobile support is outside launch scope. Historical notes below preserve prior states and do not override this gate.

## 2026-10-30

- Reviewed product brief, current progress/workboard, research launch checks, API/tRPC contracts, and installed Next.js route-handler/redirect documentation.
- Extended the smoke harness with the installed official tRPC client: public report list, bad input, missing report, anonymous key listing and contribution/key mutations.
- Static validation: `node --check scripts/qa/smoke.mjs` passed.
- Leon supplied `http://127.0.0.1:3000` and confirmed `supabase-data-api` fallback mode with no DATABASE_URL. Final smoke: **49 passed, 0 failed**. Initial two failures were harness assumptions, corrected using observed documented streamed redirects and pre-parsing MCP origin rejection.
- No server started, build run, authenticated user created, or valid database mutation attempted. Awaiting Drizzle server configuration and CEO-supplied authenticated fixtures.

## Release responsibilities

Run read-only and guaranteed-invalid request checks against both configured backend modes. Record concrete failures for Maya (API/auth/MCP), Leon (database/runtime/platform), or Nina (UI/design). Authenticated fixtures require a scoped test account/key supplied by the CEO. Keep email confirmation, valid writes, ownership, duplicate/independent results, and key expiry/revocation unverified until exercised end to end.

## Compiled production Drizzle verification

- Leon supplied final artifact `CN2g7chCCwqW8p0I1a_S2` on port3100 with actual Drizzle configured and sources current. Full smoke **49/49 passed** using production allowed Host `tokenoverflow.app`.
- Added reusable `scripts/qa/auth-pending.mjs`; all **4 checks passed** against canonical production auth origin, including three hostile next destinations.
- Fixed harness transport for an explicit production Host; production MCP correctly rejects local authority. No implementation defect found in this pass.
- Remaining release limits: provider enablement and actual GitHub session/contribution flow, scoped valid writes/key lifecycle/independent-result runtime fixtures, browser UX/accessibility, and deployed DNS/HTTPS. No deploy or commit performed.

## Fresh retrieval/guidance handoff

- Read current AGENTS/company memory index, engineering map, workboard and owner note before review.
- New current artifact `wlrw0JNZKWmPnYOCQO9_E` on production3100/actual Drizzle: fresh **49/49 smoke + 4/4 auth-pending** passed.
- Independently reviewed Rowan's safe projection/public detail sanitizer boundaries; live modern+legacy retrieval passed canonical URL/environment/count fields, privacy, raw REST detail parity, text/structured parity, and truthful scope caveats. Existing example has zero fixes, so mixed live outcomes were not tested. Compiled public guidance assertions passed.
- No repository code/app/server/cloud changes in this pass; only verification records updated. Actual client installation, provider-enabled sign-in, authenticated writes, browser interactions and deployment remain next evidence. See canonical `company/verification.md` for precise limits and commands.

## Finding-journey boundary review

Independent source review of report/detail/forms, shared validation, services, REST/tRPC/MCP projections: no supported unsafe raw HTML rendering, dropped negative outcomes, version-text loss, or private account-ID leak found in the reviewed app boundaries. Baseline-not-reproduced lacks a separate schema outcome as already documented; this review does not relabel that known product limit as a new implementation defect.

One supported **P3** defect: `server/api/root.ts` report-list input permits arbitrary category and page up to10000, while REST/MCP reject invalid categories and cap1000. Read-only live repro on current production3100: tRPC `reports.list({category:'invalid'})` and `{page:1001}` each succeeded with empty data; equivalent REST queries each returned400. This can conceal caller errors as a legitimate empty finding search and breaks portable input behavior. Reported to Maya/CEO; app code unchanged. No repeated smoke, browser/cloud/server/commit activity. Actual-client evidence remains Rowan's separate responsibility.

## Formal role and mock honesty review

Read `company/roles/README.md` and `engineer.md`. Viewed all three originals listed in Nina's owner note. Search Desk's History/Integrations/Settings sidebar and generic desktop menu bar are unsupported feature/control promises relative to the sparse task scope; Nina already records the sidebar caveat. CEO informed: treat them as concept artifacts, not approved implementation scope. All three visibly label Examples and show both worked and failed results; no new fabricated-community or universal-verification claim found. Structured evidence panels remain conceptual presentation and cannot establish a structured backend migration or machine-parsed checks. No redraw, app change or browser/runtime matching performed.

P3 query-schema correction is assigned to Maya; bounded invalidcategory/page1001/emptycategory verification awaits source-ready notice and will remain distinct from stale compiled-artifact evidence. Rowan reports a Claude Code handshake; Codex management registration alone does not establish tool invocation. Actual client evidence is maintained by Rowan.

P3 bounded verification complete: after Leon's dev-only restart, source-aware actual-Drizzle dev3000 passed9 interface/case assertions (REST/tRPC/modern MCP reject invalidcategory and page1001, accept empty category/view). Pre-restart HTTP500 was owner-confirmed stale HMR export, resolved on restart. No full smoke rerun. Production3100 evidence remains historical for pre-correction sources; fresh build/relevant release checks belong to Leon/CEO. No app/cloud/server/commit changes by Jules.

## Diagnostic quality review — active

Assigned independent review of Iris's isolated local MCP #2739 diagnostic; execution remains Iris's responsibility. Requested pinned package/version, primary link, harness and timing artifacts. Acceptance separates a valid matching JSON control from broken SSE EOF/error, SDK settlement from the harness deadline, and baseline observation from a fixed-version comparison. No fix claim is justified without matched before/after evidence. No diagnostic execution duplicated by Jules.

Formal-role review found no concrete authority ambiguity. CEO informed of queue lag: search correction has completed9 assertions while workboard still described it as pending. Canonical queue reconciliation remains CEO-owned.

Diagnostic review complete: independently inspected Iris's harness and final12 outcomes, no duplicate execution. Four matching JSON controls resolve; eight EOF/error SSE requests reach SDK deadline, not outer watchdog. Corrected protocol-label evidence bug via Iris; final artifact now records actual init requested/returned2025-11-25 and separate server identity. Artifact consistency assertions passed. Mock-only Node26 baseline; no fixed-version, real network, or fix-success claim. Canonical detail in `company/verification.md` and Iris's research pilot artifacts. No concrete role-authority ambiguity found; CEO notified of stale queue statuses.

## Launch acceptance — active

Founder sketch3 selection triggers a new final-artifact gate. Coordinated contract/readiness requests to Maya (health/requestIDs/redacted errors), Nina (changed routes/theme states), Rowan (remote public reads vs actualclient proof), Leon (exact build+deploy association). No repeated smoke until changed finalartifact is ready. Canonical bounded gate and synthetic-vs-real-user measurement rule recorded in `company/verification.md`; CEO owns CUA visual/mobile. Current next dependency is owners' readiness, not a passing historical artifact. No fix claim from Iris baseline; valid user auth/contribution remains independently required.

Current launch candidate lp7Ae0aGcPQzv-5v2g2Ov:49/49+4/4 passed, livehealth/requestID/MCPerrorcorrelation/SEO passed. Hired Quinn intern medium/forknone read-only coverage audit; independent finding confirmed raw unexpected tRPC message may include Drizzle SQL/params. Escalated to Maya/CEO/Leon; normalhappy checks don't cover fault response. Need safe unexpected-error formatter/syntheticfault proof and freshartifact. No liveoutage induced. Requested Leon verify synthetic event allowlist using known QA IDs; no secret logs requested. Canonical evidence in verification.

Unexpected-error sourcefix accepted after same independent pre/post synthetic proof: raw SQL/params present before, generic500 with no SQL/params/stack after. Persisted actual-route regression additionally passes dev/prod driver/context faults and safe403/400+headers. Leon rebuilding: next quality step bounded freshartifact tRPC/read/health compatibility, then focused deployed publicread gate. No real outage, no fixedversion claim from Iris. Quinn's concrete finding reviewed by Jules; intern audit complete.

Current compiled candidate **hHffqdwXgeoNURxkhUmuu** actualDrizzle3100:5/5 bounded postpatch live compatibility checks passed (tRPC200/400/401/404 + health200, all generatedIDs/no-store, errorstacks absent). No duplicate49+4. Localbehavior gate passes for founderaccepted publicread/authpending phase; ready for Leon deploymentURL/artifact association and focused normalremote checks. CEOvisual/mobile and Rowan actualremoteclient remain separate evidence.
