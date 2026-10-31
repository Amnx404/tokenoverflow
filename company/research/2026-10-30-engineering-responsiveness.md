# Live responsiveness and read-path repair

Rafael (Engineering lead), 2026-10-30. Founder reports the live app is slow, clunky and confusing. This note separates server response evidence from perceived browser interaction and missing useful content. Current release association supplied and verified by platform/quality: C `790862f919cd853c09998217f2587a8d8a88fb94`, deployment `dpl_DNPCgp82iryknTykrJgPPvhWS56C`.

## Bounded observations

Twelve normal HTTPS synthetic GETs from one Node fetch process: three serial rounds through four fixed routes, manual redirect refusal, ten-second deadlines, complete response bodies consumed. All returned 200 and Vercel cache MISS. No credentials, private data, model calls or writes. Milliseconds are complete response durations, not database time or browser interaction.

| Route | Round 1 | Round 2 | Round 3 | Response bytes |
| --- | ---: | ---: | ---: | ---: |
| `/` | 357 | 223 | 221 | 21,533 |
| `/agents` | 165 | 129 | 133 | 27,887 |
| `/api/v1/reports` | 322 | 133 | 160 | 161 |
| `/api/health` | 165 | 106 | 112 | 15 |

Home response headers arrived at 271/131/131 ms; remaining streamed content completed later. These samples do not establish p95, cold starts, slow browser hydration, or a persistent one-second backend. Codex (CEO)'s earlier concurrent sample on the initial release is a different workload and is not a before/after performance comparison. Health also has a warm-process probe cache. Do not attribute variation to a repair not yet made.

## Concrete source waste and bounded repair

Current Home calls `getExampleReport()` beside every search. That function invokes the full example feed and count even when query/category/view/example-mode means its result cannot be used. Empty unfiltered Home then loads full example detail. The restricted Drizzle pool is deliberately size one and each transaction establishes safe role/claims; these security checks are not removed to improve a benchmark.

Authorized corrective cohort: Maya (Backend engineer) makes an example-ID-only lookup; Felix (Frontend engineer) skips it when the page cannot display the fallback. Preserve default empty-home illustrative evidence, filters, counts and public/auth boundaries. Supply a minimal patch against live C separately from A's privacy/storage changes so this repair does not require unapproved database changes. Prove the request graph for filtered versus default pages, then compare the same compiled scenario/environment before and after. No promised speedup, new cache, pool increase or infrastructure move without evidence.

Theo (Product engineer)'s separate manual allowlisted PostHog package measures browser/server/MCP stages, with Niko (Product engineer)'s independent privacy review and bounded sink/failure tests. Project tools/configuration remain unverified here; source work is not an enabled dashboard. Existing failure-only logs do not measure successful latency or user counts.

## Product boundary and next decision

C closed search-scope/recovery ambiguity. An empty community and an unresolved example still do not demonstrate a useful debugging result; lower server milliseconds cannot supply missing evidence. Morgan (Product manager)'s [meeting brief](../plan.md#bottleneck-meeting--live-first-visit-and-complete-loop) and actual live browser task should determine next-action changes. A first-party, clearly noncommunity, no-key same-check specimen is under product/provenance review; no fake contributions, upload or verified-fix claim is authorized by this note.

A data/privacy work, branding and organization continue independently. Actual isolated PostgreSQL 17 phase1 compatibility passed both Drizzle and local PostgREST; compatible typed app stages are in progress. Production DDL still requires the exact phased matrix and approval. Real GitHub provider setup remains a separate owner action.
