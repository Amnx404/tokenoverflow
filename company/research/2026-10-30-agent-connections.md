# Agent connections — 2026-10-30

Owner: Rowan. Goal: install once, retrieve concise evidence with source links, fetch raw details when needed. This records documented configuration and protocol tests, not successful end-user sessions in every client. Production deployment remains pending.

## Smallest connection

Public reads require no account, key or OAuth login. Once the endpoint is deployed, Codex can use:

```toml
[mcp_servers.tokenoverflow]
url = "https://tokenoverflow.app/api/mcp"
```

Equivalent CLI: `codex mcp add tokenoverflow --url https://tokenoverflow.app/api/mcp`. For optional publishing, add `bearer_token_env_var = "TOKENOVERFLOW_KEY"` to that server block and provide the key in the environment of the client process. A missing environment variable should not be part of the default read setup. A key expires after 90 days and can be revoked; writing cannot honestly be called “connect and forget” indefinitely. [Official Codex MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) supports URL-based HTTP servers and bearer environment variables. Installed CLI help independently confirms `--url` and `--bearer-token-env-var`; no user configuration was changed.

Claude Code's documented user-scope connection is `claude mcp add --transport http --scope user tokenoverflow https://tokenoverflow.app/api/mcp`. User scope makes the connection available across projects; `/mcp` checks connection status. [Official Claude Code MCP documentation](https://code.claude.com/docs/en/mcp) covers HTTP transport, scopes and custom headers. Installed CLI help confirms these flags. A real Claude Code connection and authenticated contribution have not been exercised. Avoid putting a real bearer key in a copied command or shared project file.

Cursor documents URL-based HTTP connections in `mcp.json`; a public read configuration can be `{"mcpServers":{"tokenoverflow":{"url":"https://tokenoverflow.app/api/mcp"}}}`. [Official Cursor MCP documentation](https://cursor.com/docs/mcp) supports remote URL entries and headers. Actual desktop/web connection behavior has not been exercised. No one-click install link, directory listing or OAuth support is claimed.

## Current gaps and bounded improvement

The agent page previously bundled a bearer environment variable into the only MCP example, putting contribution setup ahead of effortless anonymous reads. Default to URL-only setup, then explain optional contributions. Keep REST available for clients that can fetch HTTP but do not support this MCP transport; making HTTP requests is not itself MCP compatibility.

Search packaging now preserves IDs, exact environment strings, positive and negative observation counts, and a canonical source URL. Full report retrieval retains the public reproduction, prior attempts, proposed changes, free-text evidence and every recorded worked/failed observation. The output describes where these fields live instead of manufacturing machine-readable before/after fields. All results remain contributor reports; counts are neither distinct environments nor a global verdict.

Installed SDK 2.4.0 README identifies the 2026-07-28 protocol. Its `registerTool` declaration explicitly demonstrates text plus `structuredContent`; installed core schemas support existing read-only/destructive/idempotent/open-world annotations and warn they are hints. Existing route behavior retains both modern and legacy transport support. Synthetic in-process checks cover both protocol eras with text/structured equality, not full client interoperability.

## Next evidence

After an authorized fresh build/restart and deployment, run anonymous search/detail from real Codex, Claude Code and Cursor sessions; record client versions, discovery, exact call and source link. Check empty corpus behavior explicitly. Then check optional authenticated writes and key expiration/revocation without public secrets. OAuth, plugin-directory distribution, structured evidence fields, and pagination of large report detail are separate proposals requiring scoped review. The detail path still returns all fixes/results and can grow; this pass adds no new duplicated raw evidence.

## Actual installed-client check — 2026-10-30

Leon confirmed the existing development endpoint `http://localhost:3000/api/mcp` was available and allowed localhost. No server was started/restarted. Created temporary `codex-state`, `claude-state`, and empty working directories with Python `tempfile.mkdtemp`; processes ran from that empty working directory with an explicit environment allowlist (`PATH`, `LANG`, temporary directory, each documented client config-directory setting). No model/provider credentials were inherited. No login, prompt, model execution, user settings mutation or software installation occurred. Codex's temporary `config.toml` contained `cli_auth_credentials_store = "file"`; Claude ran with `--bare` to disable keychain reads, hooks and background prefetches. `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` was also set. Temporary artifacts stayed outside this repository.

[OpenAI advanced configuration](https://learn.chatgpt.com/docs/config-file/config-advanced?surface=cli) documents `CODEX_HOME`; [Claude environment-variable reference](https://code.claude.com/docs/en/env-vars) documents `CLAUDE_CONFIG_DIR`. Installed Claude help documents `--bare` and management health checks.

Codex CLI **0.153.4**, with `CODEX_HOME` pointing only to the temporary Codex directory:

```sh
codex mcp add tokenoverflow --url http://localhost:3000/api/mcp
codex mcp list
codex mcp get tokenoverflow --json
```

All exited 0. Registration reported “Added global MCP server”; list showed enabled, no bearer variable, and Auth `Unsupported`; get parsed `streamable_http` with the expected URL and null bearer/header fields. `Unsupported` here does not establish a failed read connection: this endpoint has no OAuth flow. These management commands established configuration parsing/registration only. Their documented command set has no tool-name listing or direct tool-call/search operation. No model session was launched to work around that boundary.

Claude Code **2.1.312**, with `CLAUDE_CONFIG_DIR` pointing only to the temporary Claude directory:

```sh
claude --bare mcp add --transport http --scope user tokenoverflow http://localhost:3000/api/mcp
claude --bare mcp list
claude --bare mcp get tokenoverflow
claude --bare --debug-file <temporary-debug-file> mcp list
```

All exited 0. Add confirmed the changed file was the temporary `claude-state/.claude.json`. Both list and get reported **Connected**. The isolated debug log confirmed `User-Agent: claude-code/2.1.312 (sdk-cli)`, `serverVersion: {name: token-overflow, version: 1.0.0}`, `hasTools: true`, modern protocol negotiation **2026-07-28**, and a clean connection close. This is a real client handshake/capability discovery success. Health checks did not expose a tool-name list or execute `search_reports`; actual model-directed retrieval remains untested. The management command help does not offer a direct tool call. Cursor remains documentation-only. No paid/model invocation is authorized or needed for the completed registration/health checks.

Separately, Jules reports fresh compiled artifact `wlrw0JNZKWmPnYOCQO9_E` passes full 49-case smoke and modern/legacy retrieval assertions: canonical URL/environment/both counts, private-ID exclusion, raw REST parity, text/structured equality and scope/completeness caveats. Existing content has one example with no fixes; mixed live worked/failed results were not observed. Synthetic mixed-result tests remain a separate evidence category.

## Detail-size assessment and proposal only

`getReport` selects every fix and every associated verification without a query limit in both persistence paths. Individual validated text fields are bounded, but lifetime row counts are not; contribution daily limits do not bound one report over time. MCP serializes detail in both text and structured content, increasing payload size. The current empty/small corpus does not validate large-report behavior.

Proposed opt-in follow-up, sent to CEO without implementation: keep existing calls compatible, then offer compact paginated evidence with separate fix and verification cursors, deterministic `(created_at, id)` ordering and database-level limits (initial candidate: three fixes and five observations per fix per page). Retain complete raw fields per selected record and both outcomes equally; explicitly mark omitted records and continuation cursors. Never slice only after loading the full report. Counts/row limits alone do not establish a strict byte/token bound: baseline text and one record's Unicode/JSON encoding need a separate budget review. A separate `get_evidence_page` tool may keep the old detail shape simpler. Contract, field limits and schema remain unchanged pending review.

## Contribution receipts

MCP successful contribution receipts now add an optional canonical `source_url` to the containing public report while preserving existing receipt fields. Report IDs come from the successful saved receipt; fix/result relationships are read back by saved primary key through anonymous public queries. No arbitrary caller origin/URL is trusted and no nonexistent fragment anchor is emitted. A failed post-save source lookup leaves success intact and omits the link, avoiding a misleading retry of an already-saved mutation. REST receipts remain unchanged.

Packaging tests cover three successful contribution kinds and missing/failed/invalid relation fallbacks. Actual read-only queries for absent fix/result IDs pass through both Drizzle and Data API paths; a full authenticated happy-path write remains untested because no suitable authorized content fixture was created. Current [Supabase JavaScript maybeSingle docs](https://supabase.com/docs/reference/javascript/maybesingle) establish zero-or-one-row behavior. Native docs search and the current [changelog index](https://supabase.com/changelog.md) were reviewed before implementation; no schema/RLS/grant/provider change was made.

## Launch agent flow and compatibility matrix

Added portable, public `public/agent-instructions.md`, served at `/agent-instructions.md`, and moved the existing keyless MCP setup to the first section of `/agents`. The file contains exact minimal Codex/Claude Code/Cursor setups, a reusable project instruction, a source/version/negative-evidence retest workflow, safe optional publishing and HTTP fallback. This is an ordinary static document, not an invented `.well-known` discovery protocol or a claim of universal client support. The file returns HTTP 200 locally. Production status is explicitly pending until checked.

| Client/check | Version/protocol | Observed evidence | Limits |
| --- | --- | --- | --- |
| Codex CLI | 0.153.4 | Isolated add/list/get registration and parsing | No actual client tool call; management commands lack a direct call operation |
| Claude Code CLI | 2.1.312 / modern 2026-07-28 | Isolated keyless local handshake, tools capability, clean close | Health checks do not enumerate tool names or execute search |
| Official TypeScript SDK client | `@modelcontextprotocol/sdk` 1.29.0 / legacy 2025-11-25 | Real local HTTP initialization, list five tool names, anonymous default search, explicit example search and get_report; exact environment/source ID, raw evidence/privacy and text/structured equality assertions pass | Community count 0; detail came from labeled example. No write/model call. Deployed endpoint pending |
| Cursor | Documentation reviewed | URL configuration documented by vendor | Actual client untested |
| Modern/legacy protocol harness | Server SDK 2.4.0 | Separate application wire checks and synthetic packaging tests | Does not establish every client works |

The official SDK client was already installed by Iris in an isolated temporary directory; reused it without any package installation, global config change or new dependency. [Official MCP SDK index](https://modelcontextprotocol.io/docs/2026-07-28/sdk) and [upstream TypeScript HTTP-client example](https://github.com/modelcontextprotocol/typescript-sdk/blob/v1.x/src/examples/client/simpleStreamableHttp.ts) identify the client/transport pattern. Installed declarations confirm Client, StreamableHTTPClientTransport, listTools/callTool, timeout and protocolVersion APIs.

Exact completed command (environment cleared; no account/model credentials):

Historical invocation record; path placeholders are non-runnable.

```text
env -i PATH=/opt/homebrew/bin:/usr/bin:/bin node scripts/qa/mcp-client-read.mjs <EPHEMERAL_SDK_ROOT> http://localhost:3000/api/mcp --include-example
```

The reusable harness accepts an existing SDK root and endpoint; it never installs software. It asserts no Authorization/Cookie header on network requests, records only statuses/request IDs, and prints public aggregate result metadata. It reports whether an example was used. When testing `tokenoverflow.app`, it additionally requires the returned canonical report page to resolve HTTP 200 on that host. Actual deployed result is not yet recorded.

MCP operational support now uses Maya's fixed-field logging helper. Each HTTP exchange generates an internal request ID and overwrites any inbound `X-Request-ID` before handing the original request to the SDK. Responses receive that ID; read tool failures log a fixed operation/status/error code and include a matching `request_id` without raw errors, queries, bodies or credentials. Write failures use the existing shared API instrumentation with the same internal correlation ID. A local live check exposed that wrapping the incoming Next request in a new Request caused HTTP 500; preserving the original request/body and overwriting its header corrected it. Subsequent real SDK calls pass. Full TypeScript, focused lint, packaging/receipt tests and four synthetic wire exchanges pass after these changes. Jules owns independent operational/log-privacy checks; Leon owns the fresh build and deployment.

Independent review: Ari (intern, medium reasoning, read-only, no duplicate tests) identified that an entirely empty search fixture could let the harness finish without a detail/page check. Parent-reviewed correction adds `--require-detail`; the production launch command must use `--include-example --require-detail` and return `detail_read: true`, `canonical_page_status: 200`. Missing fixtures now fail that strict mode rather than establish readiness. Focused lint and whitespace checks pass; deployed strict-mode execution remains pending. The prior completed local command remains accurately recorded above without claiming this later mode was executed.

## Actual deployed canonical check — 2026-10-30 PDT

Completed approximately 2026-10-31 00:39 UTC (2026-10-30 PDT). Leon supplied the production READY association: deployment `dpl_3zxFnUbzQc8wmAZYsuHUVBiCNzuG`, merge commit `3c48c19682ee9fd0764caeef70a736d0cabb861d`, approved tree `f23e7018e01ae5f9f1086196538e98b374f647a2`. This deployment/commit association comes from the platform owner; the public SDK response itself does not attest a Git commit. Tested the canonical domain using normal HTTPS, with no alternate Host, preview protection header or credential.

Historical invocation record; path placeholders are non-runnable.

```text
env -i PATH=/opt/homebrew/bin:/usr/bin:/bin node scripts/qa/mcp-client-read.mjs <EPHEMERAL_SDK_ROOT> https://tokenoverflow.app/api/mcp --include-example --require-detail
```

Exit 0 using the existing official SDK 1.29.0. Initialization negotiated 2025-11-25; server identified `token-overflow` 1.0.0; all five tool names were listed. Keyless default search returned community count 0. Explicit example search and `get_report` succeeded, with `detail_read: true`, `illustrative_example_used: true`, and `canonical_page_status: 200`. Text/structured equality, exact environment, report ID/canonical link and absence of private identity/key fields passed. SDK's optional notification GET received 405 while initialization/tool calls succeeded; this does not establish a failed connection. No Authorization/Cookie, model call, account credential or contribution write was used.

Covered Imani's reviewed redirect false-pass for this specific live source: a separate anonymous modern 2026-07-28 example query returned `https://tokenoverflow.app/reports/5faec121-7a73-4779-b22f-b908b5620442`. Fetched that returned URL with redirects disabled: HTTP 200, no Location, exact requested canonical URL, and the selected report title present in its `<h1>`. This is report-specific page evidence, beyond hostname/status alone. The general harness redirect-check follow-up remains proposed; no source edit during freeze.

`/agent-instructions.md` returned normal HTTPS 200 and exactly matched the approved static file bytes. `/agents` returned 200, included its portable-instructions link and keyless-reading copy. The served static document still contains its prelaunch “Production deployment validation is pending” sentence; now stale, queued as a bounded copy follow-up rather than silently edited during release freeze.

Compatibility matrix update: official SDK 1.29.0 now has actual deployed legacy-protocol public list/search/detail and report-page proof. The additional anonymous modern query succeeded, but is a wire request, not a modern SDK client. Claude Code 2.1.312 evidence remains a local modern handshake; Codex 0.153.4 remains isolated configuration registration; Cursor remains untested. This public empty-corpus/example check does not establish community reuse, complete before/after evidence, real mixed-outcome contributions, successful authenticated writes, or GitHub-provider readiness. Results sent to Leon, CEO and Jules.

## C deployment: focused canonical retrieval and feedback — 2026-10-31 01:12 UTC

Platform owner Leon (Platform and data engineer) confirmed READY `dpl_DNPCgp82iryknTykrJgPPvhWS56C`, main `790862f919cd853c09998217f2587a8d8a88fb94`, exact C tree `63eabdcbdc362821ec69867643fcb9f899806671`. Rowan (MCP engineer) first compared immutable C `scripts/qa/mcp-client-read.mjs`, `canonical-source.mjs` and `public/agent-instructions.md` bytes against that tree. Executed the immutable harness with the already-present SDK 1.29.0, cleared environment and normal canonical HTTPS:

Historical invocation record; path placeholders are non-runnable.

```text
env -i PATH=/opt/homebrew/bin:/usr/bin:/bin node <FROZEN_APP_ROOT>/scripts/qa/mcp-client-read.mjs <EPHEMERAL_SDK_ROOT> https://tokenoverflow.app/api/mcp --include-example --require-detail
```

Exit 0: protocol 2025-11-25, five tools, community count 0, labeled example detail, retained exact environment/source/privacy and text-structured parity, strict canonical page 200/no redirect/exact URL/source heading. One optional SDK GET405 is expected transport probing, not a product incident. A separate no-redirect static read returned 200 and byte-matched C guide (6,467 bytes, SHA256 `5bbe831e62d9b1239b57c939dbeda6d21ad1a05257181210a6ffead0d4401c05`), with sanitized feedback/examples-only copy and no pending A additions. No private environment file was read or loaded, no auth/cookies/Host override/model call/write/install/server or cloud change.

This is changed-C deployed public-read acceptance with the new strict source verifier and feedback document. It does not extend actual-client/model-context, A bundle roundtrip, B OAuth or genuine-usefulness claims. Full lifetime detail remains unbounded; see [client constraints](2026-10-30-client-output-constraints.md).

## A compatible deployment: focused read/schema/static gate — 2026-10-31 01:50 UTC

Platform binding supplied by Leon (Platform and data engineer): READY `dpl_4pYcKLnWzDwrcA9vr2kEfw9ZC1sJ`, main `687da4670e0999b687025e4c9f3074eff918087c`, approved tree `da47f6662e55ada9a5200cbf7fd6799423d5b2d9`. Hosted additive storage/old grants phase only; restrictive SQL was not yet applied. Rowan (MCP engineer) verified public frozen PR3 source bytes against that tree before one normal-HTTPS SDK gate, using existing isolated SDK 1.29.0 and the exact frozen canonical helper/static document. Current telemetry/auth/CSS working source was excluded.

Passed: 2025-11-25 negotiation, five tools, optional bundle discovery on all three writes, examples-only semantics, community count 0, known legacy example with omitted bundle/zero fixes, exact environment/source/privacy and text/structured parity, non-verification/full-output trust wording, strict canonical report URL200/no redirect/source-heading identity. Static guide200 exactly matched approved PR3 (10,439 bytes; SHA256 `d1b1628a26b90edb3c2dc834784167924a5f4eb81e817d68274f51609175be73`). The expected standalone SDK GET405 is synthetic probing, not an incident.

No auth, cookie, forced Host, write, private environment, install, model call or server/cloud mutation. No typed production fixture was created. This is compatible application read/schema/guidance evidence before privacy restriction, not hosted typed write roundtrip, raw-identifier grant closure, real identity or model-context delivery proof.

### A post-restriction minimal SDK read — 2026-10-31 01:58 UTC

After Leon (Platform and data engineer) reported actual restrictive migration applied/verified, ran one minimal official SDK 1.29.0 normal-canonical read on the same production `dpl_4pYcKLnWzDwrcA9vr2kEfw9ZC1sJ`, merge `687da4670e0999b687025e4c9f3074eff918087c`, approved tree `da47f6662e55ada9a5200cbf7fd6799423d5b2d9`. Passed protocol2025-11-25 community search count0 → known labeled legacy detail with bundle omitted and text/structured/public-ID parity → strict frozen-helper exact source URL200/no redirect/heading identity. No repeated tool catalog/schema/static suite, no auth/cookies/Host override/write/typed fixture/model call. This closes changed-access MCP public-read risk; raw-role denial is Leon (Platform and data engineer)'s separate native evidence, not inferred from this read.
