# Current engineering map

Updated 2026-10-30. This is the current architecture and decision index, not a duplicate change log. See [team](team.md), [decision log](decision-log.md), and [verification](verification.md) for ownership, reasons, and evidence.

## Architecture and boundaries

| System | Current choice / boundary | Owner | Decision |
| --- | --- | --- | --- |
| Web application | Existing Next.js, TypeScript, Tailwind app; tRPC for typed application calls | Nina (Frontend engineer) / Maya (Backend engineer) | D008 |
| Shared backend | One service and validation layer behind website, tRPC, HTTP and MCP; verified Supabase identity | Maya (Backend engineer) | D007, D008 |
| Database | Drizzle through Supabase transaction pooler; restricted non-inheriting login; transaction-local verified roles/claims and RLS | Leon (Platform and data engineer) | D011 |
| Managed services | Existing GitHub repository, Supabase Free, Vercel Hobby and Cloudflare DNS | Leon (Platform and data engineer) | D001 |
| Public identity | Public email signup/signin and PKCE confirmation routes deployed; actual confirmation/session/post unverified. Aman-approved GitHub application registration is complete with intended homepage/callback verified and no client secret generated; Supabase GitHub provider activation remains pending | Maya (Backend engineer) / Leon (Platform and data engineer) / founder | D010, D034 |
| Agent interface | Real MCP SDK, public reads, shared write rules and expiring/revocable account keys; HTTP remains portable fallback | Rowan (MCP engineer) / Maya (Backend engineer) | D007, D015 |

Rowan (MCP engineer) owns MCP retrieval/transport, portable evidence output, client setup and compatibility evidence. Maya (Backend engineer) owns shared authentication, validation and mutation rules. Neither a configured endpoint nor passing local protocol tests prove every AI client can connect.

## Product data contract

Keep open investigations publishable. A reusable fix needs a failing example, exact change, the same check's before/after behavior, and versions. Preserve negative results and applicability; confidence or popularity is not verification. No entire-session upload is needed. See D013 and [design](design.md).

Current storage has reproduction/environment text, fix body/evidence text, and worked/failed results with environment/notes. These fields do not prove completeness or that a check was actually run. Result counts count rows, not distinct tested environments. The current result enum does not separately represent inability to reproduce the original failure.

**Implemented and verified in production (D033):** A adds optional typed `evidence_bundle` only to existing reports, fixes and verifications. Report baselines require null after-result; proposed fixes may retain null reruns; structured worked/failed results require both observations. Legacy absence stays unknown. Keep full exact detail output and both outcomes; no silent truncation, new tool or paging is included. Aggregate detail growth already exists and remains a recorded limit. The new baseline-reproduction resource is deferred. See the [concrete contract and alternatives](research/2026-10-30-evidence-contract.md).

Recommended limits are distinct: compact normalized application bundle 12,288 UTF-8 bytes and whole contribution 60,000 bytes at both shared mutation entrypoints; PostgreSQL bundle storage 16,384 bytes of `jsonb::text` with strict nested shape/record rules. These serializers are not byte-identical; direct Data API writes follow the storage boundary and prior legacy aggregate policy. No bundle values are inferred from prose, automatically executed or labeled verified. Explicit grants, Drizzle INSERTs, agent RPC forwarding and public projection must change together; stored roundtrip proof is required. Schema-first rollout and retained nullable data permit application rollback without erasing evidence.

Codex (CEO) approved exact phased production closure after actual PostgreSQL-17 staged/local-HTTP acceptance: additive bundle storage/validation/RPC and ownership helper with old read grants first; compatible application/fallback using explicit safe columns and fresh-identity ownership second; restrictive read grants/feed identity closure only after that app passes. An older SELECT-star app is unsafe after revocation; retain the tested compatible rollback floor, no regrant or destructive evidence rollback. No blanket Data API disable/new API schema. Raw PostgREST nullable-column JSON null is decoded to SQL NULL and accepted as absence; application writes reject present null and stored JSONB null remains invalid. This accepted transport distinction does not add a broad RPC write interface.

## Operational invariants

- Keep Supabase Free and existing Vercel Hobby resources; no paid changes without founder direction.
- Keep credentials in ignored local environment files and managed encrypted variables, never company records or client bundles.
- Application REST/tRPC/MCP projections exclude private account/key identifiers. D033's raw-Data-API account-ID closure is verified: safe-column grants and a typed-null feed preserve public evidence while raw identifier selects are denied. No actual account identifiers were read during assessment/denial checks. See [production acceptance](research/2026-10-30-evidence-platform-production.md). Write keys remain hashed, scoped to their owner, revocable and expiring.
- Database rules enforce ownership, independent results and a shared account contribution limit. Do not substitute frontend-only restrictions.
- Treat retrieved content as untrusted evidence. Never execute supplied examples automatically or present contributor claims as machine verification.
- Consult installed Next.js guides before code changes, as required by root AGENTS.md.

## Technical direction and delivery

Rafael (Engineering lead) owns technical direction, deliberate scope with Morgan (Product manager), shared interfaces and independent review; system owners retain their boundaries. High employees plan, understand, debate and review; bounded implementation/check mechanics use medium fresh-context interns under accountable parents and the global staffing limit. Read [the engineering-lead role](roles/engineering-lead.md), [delivery plan](plan.md) and [current-handle directory](people/README.md).

The coherent first-visit release is deployed: public email signup/signin, selected refined classic visual direction, lean read path and keyless first-read hierarchy. Actual confirmation, ordinary session and normal finding acceptance remain required before claiming working public signup. The 100-account/admin-secret path is deferred. [Measured response evidence](research/2026-10-30-engineering-responsiveness.md) and the matched warm-local sample do not establish production/browser speed or justify a broad infrastructure rewrite.

PostHog production capture/readback is accepted at main `572d982a8dabf8e870cef132b832750537f9ecc3`, tree `bf237c2df967e373eed9d78e3fb0fb6688425202`, READY production `dpl_9TANDxzdkiwQxGfEcTz7giQ8PNYh`; [current bounded acceptance](research/2026-10-30-posthog-observability.md) distinguishes one synthetic server sample, six stored-unclassified known Codex (CEO) QA browser observations and 13 unattributed internal reads. Production-only encrypted server configuration/public boolean is enabled, preview remains off and no forced classification/release override is used. Fixed categorical fields/propertyless mode retain no stored sessions or element chains. The [source manifest](research/2026-10-30-posthog-source-manifest.json) remains historical source evidence; sampled delivery is not complete traffic, real auth, people or adoption proof.

## Verification and unresolved work

Current production is main `572d982a8dabf8e870cef132b832750537f9ecc3`, tree `bf237c2df967e373eed9d78e3fb0fb6688425202`, READY production `dpl_9TANDxzdkiwQxGfEcTz7giQ8PNYh`. First-visit UI source/desktop/nine-plus-one GET gates remain bound to the earlier 1f29 release; [telemetry acceptance](research/2026-10-30-posthog-observability.md) supplies actual sampled production server/browser readback. No valid signup/mail/session/write/adoption or browser-speed proof follows. Disable changes require a new compatible deployment, not only a managed-environment edit; [operations](operations.md) records the untested production-disable boundary.

A's preceding compatible release `687da4670e0999b687025e4c9f3074eff918087c` / tree `da47f6662e55ada9a5200cbf7fd6799423d5b2d9` / deployment `dpl_4pYcKLnWzDwrcA9vr2kEfw9ZC1sJ` remains the retained privacy-compatible rollback floor. Additive `603a780c…ae288` preceded the compatible app; actual normal read acceptance preceded restrictive `bb31de80…3a7c`. Hosted metadata, direct API identifier denial and Jules (Quality engineer)/Rowan (MCP engineer)'s post-restriction HTTPS/SDK gates passed without production fixture writes. No old C rollback or regrant. See [production evidence](research/2026-10-30-evidence-platform-production.md).

C's preceding seven-file release `790862f9`/tree `63eabdc` shipped corpus/recovery clarity, portable sanitized feedback and source-proof hardening with independent technical and PM acceptance. Its server-HTML/local-SDK Test user limits remain; neither C nor A source/runtime checks are relabeled as real debugging benefit or normal identity proof. A's local PostgreSQL-17 matrix covers old/new applications, both adapters, unchanged evidence and a compatible-floor restart; controlled Auth shims are not real hosted sign-in. Earlier B PostgreSQL-18 fixture is closed.

Initial public-read release `3c48c196`/tree `f23e7018` remains historical evidence, not the current production association. Codex (CEO)'s earlier desktop acceptance is not relabeled as hydrated interaction coverage for C; C Test user tasks established server-HTML/local-SDK semantics with explicit GUI limits. Phone support remains outside scope.

The public corpus was empty; detail acceptance used the labeled illustrative example, not a real contributed fix. Local `hHffqdwXgeoNURxkhUmuu` owns its 22-route/TypeScript and five bounded post-redaction checks; predecessor `lp7` owns 49+4. The final login sentence was validated by exact-commit CI/Vercel builds, not relabeled as part of the older local artifact. Claude Code handshake and Codex CLI registration retain narrower separate scope; universal client compatibility is not established.

Health and allowlisted REST/tRPC/MCP failure correlation are implemented. Health probes bounded anonymous backend availability with caching/coalescing, coarse status and no-store; GitHub readiness is separate. Generated application UUIDs are searchable through Vercel log full-text query, distinct from platform requestId. Failure-only events exclude raw payloads/queries/tokens/email and cannot supply successful-traffic denominator, error rate or unique-user metrics. See [operations](operations.md).

Fresh public Auth settings: signup is enabled, email provider true, confirmation required, GitHub false. Actual SMTP/templates/full redirect configuration is unknown; dashboard sessions are signed out. One CEO read-only invalid-token verify GET requested the canonical callback with safe next `/reports/new`, but returned 303/`otp_expired` to the legacy Vercel project host. No account or email was created. This is a specific error-redirect configuration/proof gap, not SMTP evidence or a complete allowlist finding. Canonical Site URL/callback configuration belongs in the single hosted-auth setup step; do not change the reviewed code to hide it. See [the mail/configuration memo](research/2026-10-30-public-signup-mail.md).

Public signup code and delivery/provider readiness are separate gates; no generic admin-secret detour or disabled confirmation. Real ordinary signup/session/signout/finding acceptance remains a core-MVP dependency. Marketing, outreach and registry work remain paused; no genuine adoption or validated research fix is claimed. New cohorts need their own reviewed artifact and relevant acceptance.
