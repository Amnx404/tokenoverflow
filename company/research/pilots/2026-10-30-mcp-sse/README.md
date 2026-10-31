# MCP SSE request lifetime — isolated diagnostic

Iris · 2026-10-30 · Local baseline reproduced; **no fix validated**. This is an in-process mock transport observation, not a network/server benchmark or public app contribution.

## Exact scope and provenance

- Source behavior: [upstream SDK issue #2739](https://github.com/modelcontextprotocol/typescript-sdk/issues/2739). The harness is independently authored; no issue snippet or repository test was copied.
- Package: official npm registry `@modelcontextprotocol/sdk@1.29.0`, installed in a fresh temporary directory using `--ignore-scripts`, no lockfile, no audit/fund, explicit `https://registry.npmjs.org`, empty user/global npm config and cleared environment. Only this pinned direct package was requested; transitive versions resolved on the observation date and are not frozen by this artifact.
- Registry tarball SHA-1: `79786d8b525e269de850ac82b1f1f757f3915f44`; integrity: `sha512-zo37mZA9hJWpULgkRpowewez1y6ML5GsXJPY8FI0tBBCd77HEvza4jDqRKOXgHNn867PVGCyTdzqpz0izu5ZjQ==`. Registry metadata and installed package declare MIT; no package code is redistributed here.
- Node `v26.11.1`, npm `11.20.0`, macOS/darwin arm64. SDK engine declares Node ≥18, but this runtime differs from the upstream reporter's Node 24 and separate Node 22 observation.
- Every case captured initialization requested and returned protocol `2025-11-25`. The mock server identity is recorded separately.
- No credentials/model APIs, listening server, arbitrary repository scripts, application writes, schema changes or cloud mutations. Package install/metadata retrieval was the only external service access.

## Check and results

[harness.mjs](harness.mjs) uses the actual installed SDK client and Streamable HTTP transport with injected mock fetch. Each fresh case initializes identically, then sends `ping`. JSON control returns a matching ID/result; EOF and error cases send no SSE frames and end the response before any result. There is no prior request cancellation or DELETE. SDK deadline is 300 or 1200 ms; a separate deadline+1000 ms watchdog is labeled independently. Two repetitions per mode/deadline. A failing JSON control stops subsequent cases.

Final captured output: [observations.json](observations.json).

| Mode | SDK deadline | Repetitions | Request settlement elapsed |
| --- | --- | --- | --- |
| Matching JSON control | 300 ms | 2 | Resolved, 0.35 / 0.35 ms |
| Matching JSON control | 1200 ms | 2 | Resolved, 0.12 / 0.32 ms |
| SSE clean EOF | 300 ms | 2 | SDK timeout, 301.06 / 301.90 ms |
| SSE clean EOF | 1200 ms | 2 | SDK timeout, 1201.63 / 1201.57 ms |
| SSE body error | 300 ms | 2 | SDK timeout, 307.96 / 300.63 ms |
| SSE body error | 1200 ms | 2 | SDK timeout, 1201.57 / 1202.10 ms |

All eight SSE requests rejected with SDK code `-32001`, `Request timed out`; no watchdog expired and no setup failed. EOF occurred at 1.33–1.91 ms and produced no error callback. Body errors occurred at 0.51–1.52 ms; error callbacks arrived at 0.73–1.99 ms, while request promises remained pending until their SDK deadline. Scheduling variation is visible; these are observations, not universal latency thresholds.

This supports the narrow upstream symptom in this exact local mock environment: stream loss is observed well before the pending request settles, and increasing the deadline increases the delay. It does not establish a production network impact, all-version scope, a root-cause proof, or Token Overflow transport failure. A successful JSON control is not a fix for missing SSE lifecycle settlement. No fixed release was established by primary evidence, so none was installed or compared.

## Review and next use

Jules independently reviewed the harness and initial observations without duplicating execution. He requested actual initialization protocol capture and separation of server identity from protocol metadata. The harness was corrected and run once again; the final output above includes that correction. Both runs showed the same four JSON successes/eight SSE timeouts; only the final run is the retained artifact. Initial npm configuration failed before installation because user/global config both referenced `/dev/null`; separate empty config files resolved it. Neither setup issue is counted as a diagnostic result.

Jules subsequently reviewed the final metadata/output: all twelve cases complete, actual requested/returned protocol captured, four control resolutions and eight SDK deadline rejections, with no setup/watchdog outcome. His review supports the bounded local-mock baseline interpretation; it is not another independent reproduction.

To repeat later, install the exact package in an isolated temporary root with lifecycle scripts disabled, then run `node harness.mjs <install-root>` with a cleared environment. Inspect the harness before executing. No repeat or additional dependency is required to interpret the retained observations.

Use this as one **failure reproduced locally** pilot artifact, not a worked/failed fix verification. Next meaningful comparison requires a primary-source-established fixed artifact or an explicitly scoped candidate patch. Do not publish it to the app without separate authorization and provenance review.
