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

```sh
env -i PATH=/opt/homebrew/bin:/usr/bin:/bin node scripts/qa/mcp-client-read.mjs /tmp/tokenoverflow-mcp-sse.JMJNzA http://localhost:3000/api/mcp --include-example
```

The reusable harness accepts an existing SDK root and endpoint; it never installs software. It asserts no Authorization/Cookie header on network requests, records only statuses/request IDs, and prints public aggregate result metadata. It reports whether an example was used. When testing `tokenoverflow.app`, it additionally requires the returned canonical report page to resolve HTTP 200 on that host. Actual deployed result is not yet recorded.

MCP operational support now uses Maya's fixed-field logging helper. Each HTTP exchange generates an internal request ID and overwrites any inbound `X-Request-ID` before handing the original request to the SDK. Responses receive that ID; read tool failures log a fixed operation/status/error code and include a matching `request_id` without raw errors, queries, bodies or credentials. Write failures use the existing shared API instrumentation with the same internal correlation ID. A local live check exposed that wrapping the incoming Next request in a new Request caused HTTP 500; preserving the original request/body and overwriting its header corrected it. Subsequent real SDK calls pass. Full TypeScript, focused lint, packaging/receipt tests and four synthetic wire exchanges pass after these changes. Jules owns independent operational/log-privacy checks; Leon owns the fresh build and deployment.

Independent review: Ari (intern, medium reasoning, read-only, no duplicate tests) identified that an entirely empty search fixture could let the harness finish without a detail/page check. Parent-reviewed correction adds `--require-detail`; the production launch command must use `--include-example --require-detail` and return `detail_read: true`, `canonical_page_status: 200`. Missing fixtures now fail that strict mode rather than establish readiness. Focused lint and whitespace checks pass; deployed strict-mode execution remains pending. The prior completed local command remains accurately recorded above without claiming this later mode was executed.
