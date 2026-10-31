# Launch checks — MCP and email authentication

Research date: 2026-10-30. Primary documentation and a read-only source review. No application, account, SMTP, DNS, package, or backend settings changed. The Supabase skill was consulted and its changelog index reviewed. This note does **not** establish that signup or an MCP client connection has passed end to end.

## Immediate decisions for the coordinator

1. Decide and document the MCP versions actually supported. Current official MCP is **2026-07-28**, which differs materially from the familiar initialization-based protocol. A small legacy **2025-11-25** endpoint is a defensible explicit first release, provided its intended clients are tested and the documentation names that limitation. Prefer an official SDK supporting both eras when adding current-version support; do not improvise a partial hybrid.
2. Public email signup is blocked **if this project still uses hosted defaults**. Default SMTP sends only to organization team email addresses, currently with a two-message hourly project limit. Inspect existing Auth settings before changing anything or promising public signup.
3. Test a real confirmation link and an authenticated agent write before calling contribution ready. Passing a build or an anonymous search does not establish either.

## MCP version boundary

The official [2026-07-28 versioning specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning) distinguishes modern requests from legacy initialization sessions. Modern requests negotiate independently; servers must implement `server/discover`. A dual-era server can serve both on one endpoint. A dual-era client can fall back to legacy after a non-modern error; a legacy client cannot automatically upgrade to modern.

**Implication:** if shipping legacy-only, make `initialize` negotiate only supported legacy revisions and reject a modern discovery probe as an ordinary unsupported-method/legacy HTTP error. Do not emit a recognizable modern version-negotiation error while lacking the modern implementation, because a dual-era client may continue trying modern requests.

### Minimal legacy 2025-11-25 contract

From the official [lifecycle](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle): accept `initialize` with client version/capabilities/info; return `protocolVersion`, `capabilities: { tools: {} }`, and `serverInfo`. Echo the requested version if supported; otherwise return a supported legacy version. Accept the subsequent `notifications/initialized` notification. Do not advertise logging, subscriptions, sampling, tasks, or tool-list changes unless implemented. Supporting `ping` avoids a needless liveness incompatibility.

From the official [legacy HTTP transport](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports):

- One endpoint accepts single JSON-RPC messages through POST. Clients advertise JSON and SSE; a JSON-only response is permitted.
- Accepted notifications return **202 with an empty body**, never a JSON-RPC result. Normal requests return a JSON-RPC response with their original ID.
- GET can return **405** when no standalone SSE stream is offered. No dummy open stream is necessary.
- Session IDs are optional. A serverless endpoint can omit them; do not mint a session that cannot survive another worker instance.
- Validate present Origin values; reject invalid ones with **403**. CLI requests without Origin are common.
- Subsequent protocol headers must be checked. Unsupported/invalid versions receive **400**; absent version headers default to `2025-03-26` when no negotiated context is available.

The default-version point deserves a conscious compatibility choice: either actually support the small `2025-03-26` subset needed here or require supported headers and clearly document the narrower behavior. Do not claim versions merely because their date is older.

### What current 2026-07-28 adds

The official [modern HTTP transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http) removes protocol sessions and GET streams. Requests still use POST and may receive a JSON result. Each request needs matching `MCP-Protocol-Version` and body version metadata, plus `Mcp-Method`; `tools/call` also needs `Mcp-Name`. Header/body mismatches return 400 with the specified error. Unsupported modern methods use HTTP 404 and JSON-RPC `-32601`. Modern GET/DELETE can return 405. There is no need to implement subscriptions for this application’s initial fixed tool list.

The official [base protocol](https://modelcontextprotocol.io/specification/2026-07-28/basic/index) requires `params._meta` containing `io.modelcontextprotocol/protocolVersion` and `io.modelcontextprotocol/clientCapabilities` on every request. Client info is recommended. Missing required metadata is HTTP 400 / JSON-RPC `-32602`. Modern success results require `resultType: "complete"`. Connection identity and client-reported implementation information cannot stand in for authorization.

[Discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover) returns supported versions and actual capabilities, with server identity in result metadata. Discovery does not require a prior initialize call. The [official TypeScript SDK protocol-version guide](https://ts.sdk.modelcontextprotocol.io/v2/protocol-versions) describes its support for both eras; check the actual package version before choosing imports or examples.

## Tools and authorization

The official [tool specification](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) defines `tools/list` with a `tools` array, each tool having a name and valid object `inputSchema`; use meaningful descriptions and bounded arguments. `tools/call` takes `name` and `arguments`. Return a `content` array of text blocks; optionally include `structuredContent`, with serialized JSON text for older clients. A failed execution should ordinarily be a tool result with `isError: true`; malformed protocol messages/unknown methods remain JSON-RPC errors. A fixed short list needs no cursor or list-change claim.

Recommended initial tools: search findings, get finding details, publish finding, propose fix, record result. Mark search/details read-only. Give public writes an explicit description that publication is public, and preserve the website’s independent-result rules. Put retrieved reports inside result data and retain the untrusted-content notice. Annotations describe behavior; they do not enforce permission.

The [MCP authorization specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization) makes authorization optional, but HTTP implementations should follow its OAuth flow when supported. That flow includes protected-resource metadata and discovery, not merely an `Authorization: Bearer` parser. A static Token Overflow key is a custom auth strategy, usable by clients that support manual headers. Document that setup explicitly; do not promise OAuth sign-in or universal connector compatibility. Keep reads/discovery available without a key and validate the key on **every write**. Never send keys in URL parameters, return them in evidence, or proxy arbitrary credentials.

Source-review observation: `lib/api.ts` already validates contributions through the shared schemas and the `agent_contribute` database function. Reuse that path rather than giving MCP a second authorization or write-validation implementation. Its existing helper consumes a REST body; an MCP wrapper must pass validated tool arguments, preserve Bearer auth, and translate errors into MCP results deliberately. Bound the whole MCP envelope as well as contribution arguments. This review did not audit the database function or test its deployed state. No `/api/mcp` implementation existed at the time of this inspection.

Suggested smoke checks: initialize → initialized → tools/list → search; discovery and a current-version tool call if modern support is claimed; invalid/missing key write; valid write; revoked key write; malformed JSON; unknown tool; invalid arguments; unsupported version; invalid Origin; GET405; notification202; empty search results; backend error without credentials or raw database messages leaking. Use the actual supported agent client as well as raw HTTP.

## Supabase signup: documented defaults versus actual configuration

The official [password-auth guide](https://supabase.com/docs/guides/auth/passwords) says email auth is enabled and email verification is required by default on hosted projects. SSR uses PKCE. The official [SMTP guide](https://supabase.com/docs/guides/auth/auth-smtp) states the hosted default sender is for trials, restricts delivery to team-member addresses, currently allows two messages per hour, and gives no delivery SLA. These restrictions are not resolved merely by remaining on Free or upgrading a database plan. The [hosted-flow testing guide](https://supabase.com/docs/guides/auth/testing-auth-flows) identifies `email_address_not_authorized` and `over_email_send_rate_limit` as expected failure codes under these restrictions.

Practical action: inspect whether an existing custom SMTP sender or Send Email hook is already configured. If neither exists, public signup requires a deliberate delivery setup and a real external-address test. Adding the public’s addresses as organization members is not an onboarding solution. No provider purchase or service change was authorized by this research.

The official [redirect guide](https://supabase.com/docs/guides/auth/redirect-urls) says Site URL defaults to `http://localhost:3000` and is the fallback when no redirect is supplied. Production should use `https://tokenoverflow.app`; explicit redirects must appear in the allowlist. Use exact production callback paths rather than a blanket production wildcard.

Source-review observation: `app/actions.ts` calls signup without `emailRedirectTo`, so its successful confirmation destination currently depends on the project’s configured Site URL/template. Existing `app/auth/confirm/route.ts` expects `token_hash` and `type=signup`; existing `app/auth/callback/route.ts` handles a PKCE `code`. Those handlers alone do not prove the configured email link chooses either path correctly.

The official [email-template guide](https://supabase.com/docs/guides/auth/auth-email-templates) distinguishes `.ConfirmationURL` (Supabase’s verification URL), `.TokenHash` (for constructing an app verification link), `.SiteURL`, and `.RedirectTo`. Match the selected flow end to end. For the existing token-hash handler, a customized signup link must actually send its expected hash/type parameters to `/auth/confirm`; otherwise test the PKCE code callback route with the corresponding redirect configuration. Do not assume the default template matches a custom handler.

**Not verified in this pass:** project `site_url`, redirect allowlist, confirmation toggle, SMTP/hook configuration, configured email template, inbox delivery, confirmation/session establishment, or password-reset delivery. The project’s Free organization status is recorded in the product brief from the coordinator’s earlier verification; this research did not re-query billing. The connected Supabase tool list does not expose an Auth-configuration read endpoint, so this note does not infer those settings from project metadata.

The [Supabase changelog](https://supabase.com/changelog.md) was reviewed. Its recent breaking-change notice concerning older TLS cipher removal on November 10 is not evidence of an email-signup configuration change; no newer notice found in this review overrides the Auth documentation above.
