# Theo (Product engineer)

Updated 2026-10-30. Named product engineer; public discovery and feedback entry. CEO owns workboard/team/decisions. Read company records and installed Next.js metadata, robots and sitemap guides before this delivery.

## Implemented, not released

- `app/robots.ts`: allows public crawling; excludes API/auth/login/new-finding and rejected design-lab routes. Robots is crawler guidance, not authorization.
- `app/sitemap.ts`: canonical public entry points only (`/`, `/how-it-works`, `/agents`). No fabricated modification timestamps, example URLs, account routes, private data, or draft enumeration. Individual findings remain discoverable through feed links; complete finding sitemap enumeration is not implemented.
- `app/page.tsx`: canonical home and truthful website OpenGraph; all query variants noindex/follow, including examples and filtered searches.
- `app/reports/[id]/page.tsx`: request-cached shared finding loader for page/metadata, real title/summary, canonical URL and article OpenGraph. Examples use an explicit Example title and noindex/follow. Invalid/missing IDs retain not-found behavior. No invented ratings or verification claims.
- Narrow noindex/nofollow layouts for login, new finding and design-lab. No new service, dependency, schema, deployment or image generation.
- `.github/ISSUE_TEMPLATE/bug_report.yml` and `use_case.yml`: minimal public feedback forms with sanitation warnings. Bug form asks versions, reproduction, expected/actual and optional Token Overflow request ID; neither asks full sessions/logs, credentials, or customer data.

`README.md` adds the public feedback target, distinction from library findings, and local-form publication limit.

Nina coordinated page ownership and owns footer integration. Maya owns shared feedback URL; Rowan owns install documentation and was asked to include the feedback chooser link. No issues were posted and no people were contacted. Forms are local source until repository release; chooser/form availability is not yet claimed live.

## Verification and limits

Focused ESLint across discovery routes/layouts and affected pages passed; `tsc --noEmit` passed on 2026-10-30. No runtime or production indexing claim. Leon and Jules were asked to include these files in the next current artifact and check robots/sitemap/canonicals plus example/query/login noindex behavior. Canonical origin is the established `https://tokenoverflow.app`; previews are not separately indexed by these files.

Next: Jules verifies current built artifact; release must publish issue forms before calling the chooser forms live. Coordinate CEO on user feedback evidence and adoption rather than inventing community demand.

## Current candidate check

Artifact `lp7Ae0aGcPQzv-5v2g2Ov` at local production-mode port 3100: robots exclusions and exact three-entry canonical sitemap returned correctly. Googlebot HTML checks passed for root index/canonical/website OpenGraph, example-query noindex/follow, login and design-lab noindex/nofollow, and the home-linked example detail's noindex, Example title and canonical. Actual community feed returned zero entries, so no fabricated record was inserted to claim a community-detail runtime check. Both GitHub forms parse as YAML with unique field IDs using the existing `js-yaml` dependency. Production deployment and GitHub default-branch form activation still need separate confirmation.
