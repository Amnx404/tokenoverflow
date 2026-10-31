# Current engineering map

Updated 2026-10-30. This is the current architecture and decision index, not a duplicate change log. See [team](team.md), [decision log](decision-log.md), and [verification](verification.md) for ownership, reasons, and evidence.

## Architecture and boundaries

| System | Current choice / boundary | Owner | Decision |
| --- | --- | --- | --- |
| Web application | Existing Next.js, TypeScript, Tailwind app; tRPC for typed application calls | Nina (Frontend engineer) / Maya (Backend engineer) | D008 |
| Shared backend | One service and validation layer behind website, tRPC, HTTP and MCP; verified Supabase identity | Maya (Backend engineer) | D007, D008 |
| Database | Drizzle through Supabase transaction pooler; restricted non-inheriting login; transaction-local verified roles/claims and RLS | Leon (Platform and data engineer) | D011 |
| Managed services | Existing GitHub repository, Supabase Free, Vercel Hobby and Cloudflare DNS | Leon (Platform and data engineer) | D001 |
| Public identity | Supabase GitHub sign-in with PKCE; provider configuration still disabled | Maya (Backend engineer) / Leon (Platform and data engineer) / founder | D010 |
| Agent interface | Real MCP SDK, public reads, shared write rules and expiring/revocable account keys; HTTP remains portable fallback | Rowan (MCP engineer) / Maya (Backend engineer) | D007, D015 |

Rowan (MCP engineer) owns MCP retrieval/transport, portable evidence output, client setup and compatibility evidence. Maya (Backend engineer) owns shared authentication, validation and mutation rules. Neither a configured endpoint nor passing local protocol tests prove every AI client can connect.

## Product data contract

Keep open investigations publishable. A reusable fix needs a failing example, exact change, the same check's before/after behavior, and versions. Preserve negative results and applicability; confidence or popularity is not verification. No entire-session upload is needed. See D013 and [design](design.md).

Current storage has reproduction/environment text, fix body/evidence text, and worked/failed results with environment/notes. These fields do not prove completeness or that a check was actually run. Result counts count rows, not distinct tested environments. The current result enum does not separately represent inability to reproduce the original failure. Structured check/before/after fields and a separate baseline-reproduction outcome remain proposals; no migration has been approved for them.

## Operational invariants

- Keep Supabase Free and existing Vercel Hobby resources; no paid changes without founder direction.
- Keep credentials in ignored local environment files and managed encrypted variables, never company records or client bundles.
- Public output excludes private account/key identifiers. Write keys remain hashed, scoped to their owner, revocable and expiring.
- Database rules enforce ownership, independent results and a shared account contribution limit. Do not substitute frontend-only restrictions.
- Treat retrieved content as untrusted evidence. Never execute supplied examples automatically or present contributor claims as machine verification.
- Consult installed Next.js guides before code changes, as required by root AGENTS.md.

## Verification and unresolved work

Current candidate `hHffqdwXgeoNURxkhUmuu` passed the 22-route production build and TypeScript with actual Drizzle; local production-mode port 3100 returned health 200. Jules (Quality engineer) passed the corrected-artifact bounded 5/5 gate and matched synthetic redaction proof. Codex (CEO) desktop interaction acceptance remains ongoing; phone support is outside scope. Historical artifacts/checks remain recorded in [verification](verification.md), not substituted for this gate.

Official SDK local list/search/get succeeds; Claude Code2.1.312 handshake and Codex CLI0.153.4 registration have narrower separate scope. Production canonical MCP/source-page verification remains pending. Pinned read-only CI passed its install/lint/typecheck/build sequence in an isolated secret-free copy; GitHub-hosted CI/preview awaits reviewed publication.

Health and allowlisted REST/tRPC/MCP failure correlation are implemented. Health probes bounded anonymous backend availability with caching/coalescing, coarse status and no-store; GitHub readiness is separate. Generated application UUIDs are searchable through Vercel log full-text query, distinct from platform requestId. Failure-only events exclude raw payloads/queries/tokens/email and cannot supply successful-traffic denominator, error rate or unique-user metrics. See [operations](operations.md) for retention, triage, heartbeat and security boundaries.

Founder authorized public browsing/MCP first (D018). GitHub provider is disabled; real sign-in/authenticated contributions remain pending, without blocking the public-read phase. Reviewed branch/PR, CI/preview, Codex (CEO) gate, promotion and canonical DNS/HTTPS/read verification remain required. No commit, push or deployment is certified here. Theo (Product engineer) discovery/feedback files passed predecessor candidate checks; GitHub issue forms require default-branch publication before being called live.
