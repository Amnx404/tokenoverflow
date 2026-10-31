# PR24151 local-wire replay

Recorded comparison and replay artifact. Ari (MCP intern) performed the original local comparison; Rowan (MCP engineer) and Iris (Researcher) reviewed the source, setup and recorded evidence. The upstream issue and proposed patch are by vimalprakashts. The original comparison ran once with Node **v26.11.1**, darwin/arm64. It passed ten case observations and eight loopback HTTP requests; the archive bootstrap recipe below has **not been separately rerun**.

[Issue #24150](https://github.com/vercel/ai/issues/24150) and [proposed PR #24151](https://github.com/vercel/ai/pull/24151) concern explicit null reasoning effort. This artifact compares pinned PR-base `48ab95d62a08b409311c110852e8083910ba438d` with head `a5e9fa929490a8aeab214c4101633975e1c63f5f`, open/unmerged at inspection. Both variants use seven byte-identical base helpers and the same locked dependencies, prompt and synthetic completion response.

## Replay

Inspect the files, extract into a fresh directory, and place exact Node v26.11.1 on PATH. No compiler is needed: eighteen precompiled JS files are included. The unchanged driver's opening `PREPARED ONLY`/no-import-authorization comment is a historical pre-run marker retained to preserve the exact tested bytes; the recorded run and replay instructions here describe the current artifact status. The lock pins eight dependencies; lifecycle scripts stay disabled.

```sh
# Start inside a fresh extracted archive directory with Node v26.11.1 on PATH.
REPLAY_ROOT="$(pwd -P)"
mkdir "$REPLAY_ROOT/replay-tmp" "$REPLAY_ROOT/replay-cache"
(set -C; : > "$REPLAY_ROOT/empty-reader-user.npmrc")
(set -C; : > "$REPLAY_ROOT/empty-reader-global.npmrc")
env -i PATH="$PATH" TMPDIR="$REPLAY_ROOT/replay-tmp" npm ci \
  --ignore-scripts --no-audit --no-fund \
  --userconfig="$REPLAY_ROOT/empty-reader-user.npmrc" \
  --globalconfig="$REPLAY_ROOT/empty-reader-global.npmrc" \
  --cache="$REPLAY_ROOT/replay-cache" --fetch-retries=0
env -i PATH="$PATH" TMPDIR="$REPLAY_ROOT/replay-tmp" node driver.mjs
```

Stop if setup fails. These recipe commands use cleared environments, distinct empty npm configs and a dedicated cache/temp directory. They do not include the original install supervisor's 120-second whole-process-group timeout or size budgets. The driver itself enforces five seconds per call and thirty seconds overall, binds a dynamic 127.0.0.1 server, rejects remote URLs/redirects/authentication headers, and closes the server after its assertions. Other OS/runtime combinations are untested.

## Recorded observations

| Input | Base | Proposed head |
| --- | --- | --- |
| Camel reasoningEffort:null | Option validation before HTTP | Own wire key, strict null |
| Raw reasoning_effort:null | HTTP, wire key absent | Own wire key, strict null |
| Absent | Wire key absent | Wire key absent |
| Camel reasoningEffort:'low' | Strict 'low' | Strict 'low' |
| Camel null with top-level reasoning:'medium' | Option validation before HTTP | Own wire key, strict null |

Successful calls also assert the fixed response text and exact prompt/model. Own-key presence and strict value are separate checks. Loader/bootstrap/response failures are inconclusive, not the expected baseline symptom.

## Provenance and limits

This is a dependency-conditioned local-wire comparison, not a fixed npm release, real provider/model result, full upstream suite, semantic typecheck or 2.x backport verification. The source/package version label alone does not identify the compared commits.

Eleven pinned upstream TypeScript snapshots, source/compiled manifests, the exact change patch and upstream LICENSE (copyright 2023 Vercel, Apache-2.0) are retained. The compiled files were produced once using TypeScript 5.9.3 ES2022/ESM transpilation with relative import extensions changed to .js. Dependencies retain their separate installed licenses.

`observations.sanitized.jsonl` projects actual original stdout, removing only two `error.stack` fields containing local filesystem paths. Names/messages/causes, request bodies, counts and final result remain. Original stdout SHA256: `9e066a9d3ab861e6d5f7ee6426c2af5d68bbe31cc93b9c6ec9feeb5ee4bed728`. PROVENANCE.json records the run identity and source links. ZIP-MANIFEST.json hashes every payload file except itself; archive and manifest hashes are supplied alongside the artifact.
