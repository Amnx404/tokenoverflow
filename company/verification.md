# Release verification

Owner: Jules (Quality engineer). Updated 2026-10-30.

## Current public-read release status

This section supersedes older gate descriptions below; historical artifacts/checks remain preserved.

Current candidate **hHffqdwXgeoNURxkhUmuu**, actual Drizzle on local production3100, passed **5/5 focused post-patch checks**. The matched source synthetic driver/context tests close the tRPC response disclosure defect. Earlier **lp7**49/49 smoke +4/4 auth-pending results remain evidence for that predecessor, not a relabeling of the current artifact.

Remaining launch gates: desktop interaction review, reviewed PR/CI/promotion, and canonical normal remote verification tied to the deployed artifact. Founder accepted public browsing/MCP with OAuth pending; real OAuth and authenticated writes belong to a separate phase and are not blockers for this accepted public-read phase. Founder requested desktop focus; phone/mobile support is outside current launch scope. Jules (Quality engineer) owns behavior/protocol evidence, Codex (CEO) owns desktop browser review, Leon (Platform and data engineer) owns release/promotion, and Rowan (MCP engineer) owns actual-client remote proof. No deployment or user-adoption success is established by local checks.

## Historical evidence and gates

## Evidence so far

- Smoke harness syntax passed: `node --check scripts/qa/smoke.mjs`.
- Harness uses real HTTP and the installed tRPC client. Coverage includes public pages; anonymous creation redirect; REST report search, invalid queries, missing/invalid IDs, authentication/content-type/size rejection; tRPC public reads, bad input, missing report, protected contribution and key routes; modern MCP discovery/tools/search and legacy initialization/notification/tools/search; malformed tool input, anonymous write denial, origin rejection, GET405, envelope bound.
- Fallback runtime smoke completed: **49 passed, 0 failed**. No build, server startup, account creation, or valid database writes were performed by Jules.
- Initial run was 47 passed / 2 harness mismatches. Corrected assumptions after observing Next’s documented streamed meta-refresh auth redirect (HTTP200) and MCP origin rejection before request parsing (null response ID). Full rerun passed. No application fix was required.
- Detail privacy was exercised using an existing report selected read-only from community/example search; both REST and tRPC omit author/key identifiers.
- REST mutation checks omit authentication or use invalid bodies/content types/oversized envelopes. tRPC mutation bodies are invalid and unauthenticated. MCP write has no authentication. No valid key is accepted by this harness and it must not be repurposed for valid contributions without an explicitly scoped fixture.

## Required runtime matrix

| Configuration | Runtime evidence | State |
| --- | --- | --- |
| Supabase Data API fallback | `http://127.0.0.1:3000`; Leon explicitly confirmed `databaseMode=supabase-data-api`, no DATABASE_URL; `BASE_URL=http://127.0.0.1:3000 node scripts/qa/smoke.mjs` | **49 passed, 0 failed** on 2026-10-30 |
| Drizzle with configured DATABASE_URL | Leon-confirmed compiled artifact `CN2g7chCCwqW8p0I1a_S2`, port3100, explicit allowed production Host | **49 passed, 0 failed**; auth-pending **4 passed** |
| Scoped authenticated fixtures in each configured mode | Real contribution; key expiry/revocation; author ownership; independent verification; duplicate result constraints | Awaiting CEO-supplied fixture/account/key |
| Browser and deployment | Founder design choice, production URL, DNS/HTTPS, real auth confirmation/callback, tested agent client | Not run |

## Release blockers

Leon reports final integrated production build passed; Jules verified its exact compiled artifact locally in actual Drizzle mode. Runtime evidence covers local fallback and compiled Drizzle modes. Public signup delivery/configuration, valid authenticated contribution, and the database authorization rules are unverified. Anonymous smoke success cannot establish those properties. A Drizzle pass may only be recorded after Leon confirms that the running server uses the Drizzle configuration; fallback results cannot be relabeled as Drizzle results.

## Compiled production Drizzle verification — 2026-10-30

Leon confirmed final production artifact **CN2g7chCCwqW8p0I1a_S2**, no runtime sources newer than build, running at `http://127.0.0.1:3100` with actual restricted-role Drizzle configuration and canonical production auth origin. Jules ran:

- `BASE_URL=http://127.0.0.1:3100 SMOKE_HOST=tokenoverflow.app node scripts/qa/smoke.mjs`: **49 passed, 0 failed**.
- `BASE_URL=http://127.0.0.1:3100 AUTH_EXPECTED_ORIGIN=https://tokenoverflow.app node scripts/qa/auth-pending.mjs`: **4 passed** (pending login, no password input, and three hostile callback destinations safely returning to canonical login with `next=/` and `no-store`).

The first local production run was 37 passed / 12 MCP failures because production correctly rejects Host `127.0.0.1`. Native HTTP with explicit allowed Host exercises the production contract locally; Node fetch ignores that Host override. No app change was required. Ordinary local Host rejection was confirmed with HTTP403; the successful run does not establish public DNS/network availability.

This adds actual Drizzle runtime evidence to the earlier Data API fallback run. Public read/protocol/rejection behavior passes in both modes. Valid authenticated writes, a real GitHub authorization/session/callback, email delivery (if later offered), browser interaction/accessibility, and deployed DNS/HTTPS remain outside this evidence. GitHub provider is pending, so contribution is not end-to-end ready. No real contribution was published, server started, deployment performed, or commit created by Jules.

## Fresh retrieval/guidance artifact — 2026-10-30

Current tested artifact: **wlrw0JNZKWmPnYOCQO9_E**, replacing the earlier CN2g artifact for this scope. Leon confirmed production3100 uses real Drizzle and canonical `AUTH_SITE_URL=https://tokenoverflow.app`, build/typecheck passed, and no runtime sources were newer than the artifact.

- Fresh production smoke: **49/49 passed**, using the same `BASE_URL`/`SMOKE_HOST` command above.
- Fresh auth-pending suite: **4/4 passed**, using the same production expected origin.
- Independent live modern and legacy MCP retrieval checks passed: canonical report URLs, exact environment preservation, both worked/failed count fields, bounded search projection, text/structured parity, recursive private-ID exclusion, accurate result-scope/completeness caveats, and raw report/fix detail parity against REST.
- Retrieval exercised one existing labeled example with **zero fixes**. Live mixed worked/failed preservation was therefore **not exercised**; Rowan's synthetic test covers that scenario separately. No fixture was created. Legacy responses correctly use SSE; the first focused probe assumed JSON and was corrected before the successful legacy probe. This was a probe parsing error, not an endpoint failure.
- Compiled `/how-it-works` and `/agents` responses include scoped result guidance and public-read-without-key guidance. No authenticated form or browser interaction is established by these HTML checks.

Independent helper review found an explicit safe search projection and a detail boundary through `publicReportDetail`; raw contributor evidence remains untrusted and is not relabeled machine-verified. These are local protocol checks, **not an actual Codex/other agent client install test**. GitHub provider remains pending; real sign-in, scoped valid writes/key lifecycle, browser design/interaction, and deployed DNS/HTTPS remain unverified. No app changes, servers, cloud mutations, deployment, or commits were performed in this verification pass.

## Bounded search-contract correction

Jules confirmed the P3 drift fix after Maya introduced shared `reportSearchSchema`. On Leon's restarted source-aware dev3000 in actual Drizzle mode: **all three interfaces** (REST, official tRPC client, modern MCP) reject invalid category and page1001, and accept empty UI category/view. Nine interface/case assertions passed; no full smoke repeated. An initial pre-restart dev HTTP500 was traced by Leon to Next HMR holding an undefined export and resolved by his dev-only restart. Production3100 was not rebuilt/retested for this later source correction; its previous artifact evidence remains scoped to the previous sources.

## Independent diagnostic evidence review

Jules reviewed Iris's [isolated harness](research/pilots/2026-10-30-mcp-sse/harness.mjs) and [final observations](research/pilots/2026-10-30-mcp-sse/observations.json), without duplicating execution. Official SDK1.29.0, Node26.11.1 on darwin/arm64, in-process mock only: four matching JSON controls resolve; eight zero-frame SSE EOF/error cases reject with SDK timeout -32001 near configured300/1200ms deadlines (two repetitions each). Stream-error callbacks occur before request rejection. No setup-inconclusive or outer-watchdog settlement appears in the final12 cases.

QA identified and Iris corrected initial protocol metadata labeling: final artifacts capture actual initialize requested/returned2025-11-25 and separate server identity. Independent artifact assertions confirm case completeness and settlement classification. This supports a bounded local baseline observation; it does not establish a real network/server reproduction, match upstream Node22/24 environments, or prove a fix. No fixed-version/intervention comparison was performed. A fix claim requires the same check before and after with a valid control. No app, server or cloud state changed by Jules.

## Launch acceptance gate — active, not yet passed

Founder selected sketch3. Jules owns behavior/protocol acceptance; CEO owns browser visual/mobile review; Leon owns build/process/deploy; Maya owns health/error contract; Rowan owns actual-client setup. Earlier artifacts do not prove the changed launch tree.

1. Obtain Leon's settled-source build ID, local production URL, actual database mode and source freshness confirmation. Run one final integrated local pass plus changed health/request-ID/redaction checks; avoid repeated unchanged smoke.
2. Verify honest empty community vs explicitly labeled examples, both outcomes when actual data supports them, no private account/key identifiers, preserved environment text and untrusted-evidence notices. Existing example lacks fixes; synthetic mixed-outcome checks are not evidence of real user results.
3. Verify health status/shape, correlation IDs and redacted errors against Maya's published contract using safe bad inputs. Do not deliberately break backend configuration or log secrets to provoke faults.
4. Check sign-in against actual configured provider state: pending UI is honest but does not establish sign-in/contribution readiness. Configured provider still needs a real authorized session/callback/contribution test; no invented accounts.
5. After Leon supplies deployment and artifact/commit association, verify public pages, normal HTTPS, API empty/example/detail and bounded rejected queries, health/correlation/redaction, and credential-free remote MCP discovery/search/detail. Local allowed-Host checks cannot substitute for normal public network checks. Actual agent-client tool invocation remains distinct from raw protocol probes.
6. Record CEO's visual/mobile outcome and any unresolved contribution/auth limits before launch claims. No automatic fix claim is drawn from Iris's mock-only baseline diagnostic.

All Jules smoke, health, bad-input, MCP and diagnostic probes are **synthetic verification traffic**, not real users, adoption, saved debugging time or real contributed evidence. Unless reliable classification is implemented and checked, request/log counts must not be reported as user/growth metrics. Any later growth readout must explicitly exclude or separately report synthetic/monitor traffic and distinguish requests, sessions, unique people and contributions.

## Selected-theme release candidate lp7 — local acceptance

Leon supplied compiled **lp7Ae0aGcPQzv-5v2g2Ov**, actual Drizzle, canonical production auth origin, all sources settled/current,22 routes. Final justified run: **49/49 smoke + 4/4 auth-pending passed**. Additional live checks passed exact health `{status:'ok'}`200/no-store/generated UUID; REST bad-query body redaction and generated correlation ID; MCP HTTP200 tool-error generated ID overrides inbound spoof and matches structured request_id; robots/sitemap scope; login/query-home/design-lab noindex. Operations synthetic contract test passed allowlist/privacy/deduplication/correlation/success-silence/mocked degraded health. Live outage was not induced. Provider remains pending, accepted by founder for the public-read phase; this is not authenticated contribution readiness.

**Open response-redaction release issue:** Quinn (intern, independent read-only review) found and Jules source-confirmed default tRPC error formatting preserves unexpected error.message. `server/api/trpc.ts` only replaces ServiceError; public reports reads can throw raw Drizzle errors, whose installed implementation includes SQL and params. Production tRPC strips stack but keeps message. Maya notified to sanitize unexpected errors, including context/adapter failures. This is source-supported potential disclosure, not a live induced fault or observed user-data leak. Passing normal-response smoke does not close it. Leon/CEO notified before deploy; requires bounded synthetic failure proof and fresh patch artifact evidence.

Intern scope: Quinn, medium reasoning, forknone; no execution, edits, server/cloud actions or subagents. No human adoption was inferred from synthetic requests. Root retains browser/mobile acceptance; Rowan retains real-client remote setup proof. Deployment gate still pending.

Follow-up: Jules safely reproduced the tRPC gap in-process using the exact source module, real installed fetch adapter/publicProcedure, mocked server/auth/log plumbing and a synthetic DrizzleQueryError. HTTP500 response contained synthetic SQL and param marker. No database or running app fault induced. This verifies the failure path, not an observed real-user leak.

Leon inspected actual production stdout for the two known synthetic live REST/MCP failures: each had exactly the eight allowlisted event fields; REST INVALID_INPUT/search_reports400 and MCP NOT_FOUND/get_report404. Neither JSON event contained the synthetic query marker or raw query/header/body/error fields. No raw logs or secrets were forwarded. This closes live event-redaction evidence for those cases, separately from the open tRPC response issue.

Redaction correction source gate: Maya added an allowlisted formatter (generic unexpected500; no stack in any mode) and moved context creation inside the adapter. Jules reran the **same independent pre/post synthetic fault proof**: HTTP500 now has generic message and no synthetic SQL/parameter/stack. Persisted `scripts/qa/trpc-errors.mjs` also passes actual-route adapter tests in development+production for driver/context faults, preserved deliberate403/validation400, no-store and correlation headers. Source defect closed; fresh compiled artifact association and bounded live tRPC compatibility remain necessary before deployment.

## Redaction-corrected compiled candidate

Leon supplied **hHffqdwXgeoNURxkhUmuu**, actual Drizzle production3100, canonical production origin,22-route build+TypeScript passed and no newer runtime sources. Jules ran five bounded live checks after the formatter/context patch: public empty tRPC search200, invalid category400, unauthenticated key-list401, missing report404, and health200. All passed; every response had generated UUID/no-store, error statuses/codes preserved and no stacks. The prior49+4 suite remains associated with lp7; it was not rerun without cause. Source driver/context fault redaction is established separately by the matched synthetic tests, not by inducing a live outage. Local gate for this corrected candidate passes within the accepted public-read/auth-pending scope. Deployment/public network and CEO visual/mobile gates remain separate.
