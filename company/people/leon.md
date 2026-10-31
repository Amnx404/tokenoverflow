# Leon (Platform and data engineer)

Durable owner: Supabase, schema/RLS, Drizzle runtime, server services, Vercel deployment and Cloudflare/domain diagnostics. Maya owns shared API/auth boundaries; Rowan owns MCP retrieval; Jules verifies integration. See [engineering](../engineering.md), [workboard](../workboard.md), and canonical [verification](../verification.md).

## Current handoff — 2026-10-30

- Rebuilt settled Rowan/Maya/Nina changes successfully. Current compiled BUILD_ID: `wlrw0JNZKWmPnYOCQO9_E`; no runtime source files were newer at build verification.
- Current compiled production test endpoint: `http://127.0.0.1:3100`; actual backend is **Drizzle**, canonical production auth origin `https://tokenoverflow.app`. Home, agents, and login return HTTP 200. This is local production-mode testing, not a public deployment.
- Development endpoint remains `http://127.0.0.1:3000`, also Drizzle. Local sign-in callback origin is `http://localhost:3000`; browser origin must match when testing PKCE.
- Jules verified this exact artifact: 49/49 smoke, 4/4 auth-pending, modern/legacy MCP retrieval packaging, privacy and parity checks passed. Production transport tests use `SMOKE_HOST=tokenoverflow.app` to satisfy the intended Host allowlist. Actual external-client setup/sign-in remains unverified.
- Earlier artifact `CN2g7chCCwqW8p0I1a_S2` passed 49/49 integration checks and 4/4 auth-pending assertions. Those results do not cover newer code.
- No commit, push, application deployment, or cloud configuration change performed for this rebuild. Founder design selection and CEO release gate remain pending.

## Verified platform invariants

- Existing Supabase Free and Vercel Hobby resources retained; no paid upgrade.
- Dedicated restricted runtime login uses NOINHERIT, NOSUPERUSER, NOBYPASSRLS, NOCREATEDB, NOCREATEROLE, NOREPLICATION; exactly anon/authenticated memberships with SET allowed, no inheritance/admin. Native role provisioning omitted plaintext from migration history; administrator credential unchanged.
- Actual Drizzle connection verified restricted flags/memberships, no public schema CREATE, public feed read, and denied private-key reads, anonymous writes, and authenticated wrong-owner writes. Denied write checks rolled back.
- Applied contribution guardrails and reconciled schema snapshot. Rollback-only SQL suite passed ownership, canonical tags, private key isolation, self-verification denial, shared direct/agent quota and revocation; no test accounts remained. Native security advisors clear after role setup.
- Database credential stays in ignored local configuration (0600) and encrypted managed environment variables. Production/preview auth origin explicitly configured to the canonical domain. No secrets printed or tracked.
- Prior prospective staging and client bundle scans found no secret patterns or runtime database password; rerun against the final selected release. Actual Git index was untouched.
- Native domain checks found the canonical domain verified and correctly configured without DNS conflicts. That check covered the existing starter; final public application/DNS/HTTPS verification remains required after approved deployment.

## Next action and limits

Current compiled-artifact evidence is complete; reconcile readiness with CEO. GitHub provider remains disabled; real external sign-in, session persistence, signout and authenticated contribution are unverified until owner provider setup. No universal MCP client compatibility claim. Future design changes require a new build and relevant checks.

## Continuous integration handoff

Added [Application checks](../../.github/workflows/ci.yml), since the repository had no CI workflow. Push/pull-request job uses read-only repository permission, disabled persisted checkout credentials, immutable official action SHAs, exact Node 26.13.0, lockfile-based npm ci, full ESLint, Next route type generation, TypeScript, and production build. Build receives only invalid public placeholders and canonical public origin; no database URL or GitHub secrets are needed.

Validated the entire command sequence in an isolated copy excluding local environment files, using checksum-verified official Node 26.13.0. Clean npm ci, lint, typegen, typecheck and all 19 build routes passed. Existing dev/production servers and artifact were untouched. The GitHub-hosted job itself remains unrun until a reviewed push.

Installation audit reported four moderate findings in the development-only drizzle-kit/esbuild chain (one underlying advisory, GHSA-67mh-4wv8-2f99). Production-only audit has zero findings. npm proposes a breaking drizzle-kit downgrade; no forced dependency change was made. Review a compatible upstream fix separately; CI does not treat a database-backed smoke suite as an offline fixture test.

## Release preparation in progress

Prospective release tree is being refreshed after Maya/Rowan followups settle; real index, commit, push and deployment remain unchanged. Existing company Markdown filelinks resolve and contain no absolute local paths. Three generated PNG design sketches are 1487×1058 each, total 4,019,699 bytes; they remain unselected proposal artifacts. Expected ignores cover .env.local, .vercel, .next and node_modules; package-lock, .env.example, CI and sketches are included. CEO owns reconciliation of stale canonical status summaries.

A stale development HMR export caused empty HTTP500 on a newly added search schema; restarting only dev3000 restored the expected JSON400 without source changes. Production3100 was untouched. Jules then passed nine bounded shared-search assertions on dev3000. This followup source is newer than the current compiled production artifact.

Release preparation handoff: Maya shared-search and Rowan publish-receipt followups are settled. Their focused static/live checks are recorded in the respective owner notes. The production3100 artifact remains intentionally older than those followups; no new build or server replacement was authorized in this snapshot task. Updated isolated prospective index/tree, secret review, generated-artifact sizes and document consistency findings are being delivered to CEO without changing the real index or creating a commit. CEO has reconciled canonical summaries; subsequent edits can change the prospective tree.

Replaced the root starter README with product purpose, Node/npm local setup, environment variable names and roles, check commands, MCP/company/design provenance links, illustrative-data limits, license-file status and accurate deployment/auth/design gates. No real environment values were added. Final prospective review metadata is delivered outside the repository so recording it does not alter the reviewed tree.

## Launch and maintenance preparation

Founder selected Quiet Desktop (option 3) and authorized getting the application live and maintained. Nina is implementing the theme; Leon owns the final build/process, reviewed Git release and existing Vercel/Cloudflare deployment path. Promotion awaits exact-artifact Jules checks and CEO visual/release review, not a new founder permission request.

Native Vercel runtime-error and grouped runtime-log reads work on the existing starter deployment; recent windows are empty, which is not evidence for the unshipped application. Monitor with production/deployment scope, errors first, then bounded error/fatal logs grouped by route; inspect individual request IDs only for an incident and summarize redacted codes/counts rather than copying payloads. Maya owns coarse /api/health and allowlisted server events.

[Runtime logs](https://vercel.com/docs/logs/runtime) retain one hour on Hobby; [basic observability](https://vercel.com/docs/observability/observability-plus) retains twelve hours, while custom Query and Plus features require a paid plan. A 20–30 minute health/error heartbeat with a fifty-minute log lookback fits free runtime retention; no paid feature is enabled. Actual metric query capability is not established (legacy native query returned 400).

[Web Analytics](https://vercel.com/docs/analytics/limits-and-pricing) includes 50,000 monthly events on Hobby, but the native API confirms it is currently disabled here; no tracker or upgrade was added. Existing deployment protection covers generated deployment hosts, so arbitrary previews are not a public MCP compatibility target. Preserve protection and the canonical Host allowlist.

GitHub provider configuration remains an owner credential handoff (OAuth App credentials entered directly into Supabase). Native Supabase tools have no provider-configuration operation; no credential extraction or administrator password reset. Launch public reading/MCP with accurate auth-pending UI until sign-in is actually configured and verified.

Current launch candidate built: `lp7Ae0aGcPQzv-5v2g2Ov`, production-mode `http://127.0.0.1:3100`, actual Drizzle and canonical production origin. All22 routes/TypeScript build pass, no newer runtime sources at verification; includes selected Quiet Desktop, discovery metadata, shared-search correction, MCP receipts and operations helper/health. Health returns200 coarse ok with no-store and request ID; home/login200. Jules's exact-artifact final gate and CEO visual review requested. Repository push permission preflight succeeds; no branch/commit/push/promotion yet. README now reflects option3 selection and points mutable release status to the canonical progress record.

Founder explicitly accepted a phased release with public browsing/MCP first and accurate GitHub sign-in setup pending. Provider credentials are therefore an outstanding owner setup item, not a blocker for this launch phase. CEO is reviewing current artifact in the browser before branch push authorization. Use the native GitHub connector for supported repository/PR/issue operations; local Git remains appropriate for the actual worktree commit and push.

Final integrated full ESLint passes on the selected-theme/operations/discovery sources after the22-route production build. Still awaiting Jules exact-artifact result and CEO browser review before versioning/promotion.

Jules current lp7 artifact passed49 smoke +4 auth-pending checks plus health/SEO/MCP correlation. Leon inspected two synthetic failure events directly from local production stdout: both had exactly the eight allowlisted fields and excluded the synthetic request marker/query/header/body/raw-error data. A newly identified tRPC unexpected-error formatter could expose Drizzle SQL/parameters; release is held for Maya's bounded redaction fix, synthetic regression evidence, rebuild and focused recheck. No real backend failure or private payload was induced.

Redaction-corrected current production-mode artifact: `hHffqdwXgeoNURxkhUmuu`, same3100/Drizzle/canonical origin;22-route TypeScript build passes with no newer runtime sources. Jules bounded live gate passes5/5 (public/invalid/unauthorized/missing tRPC and health), preserving status/no-store/request IDs without stacks. Independent synthetic driver/context redaction proof passes. Prior49+4 and health/SEO tests remain scoped to lp7; no visual application source changed in the correction. Local public-read phase is technically ready; CEO visual/release authorization precedes versioning.

CEO accepted desktop public-read release and authorized the release branch/commit/push/PR path. Nina's final login sentence now accurately distinguishes public agent reading from creating contribution keys; focused forms lint passed. This copy-only change is newer than local hHff; exact-commit CI/Vercel builds will validate the final tree. Source freeze complete across named owners; branch is codex/launch-quiet-desktop. Final main merge/autoproduction still requires CEO review of the exact remote candidate.
