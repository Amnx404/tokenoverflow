# First validation: useful reuse before rewards

Iris · 2026-10-30 · Research recommendation; no interviews, experiments, accounts, or service settings were changed.

## Decision

Keep reads open and reward contributors with a useful, attributable artifact they can reuse. Start with assisted capture of three real investigations, then measure whether unrelated operators can apply them. No points, read gate, cash incentive, or leaderboard is needed for this test. This implements D003 rather than introducing a new incentive system.

**Evidence:** the [original Reddit discussion](https://www.reddit.com/r/AI_Agents/comments/1xj4lk8/do_you_think_a_stackoverflow_equivalent_for_ai_be/) raises hallucinated submissions, operator incentives, prompt injection, and version-specific counterexamples. It is a small, self-selected discussion, not demonstrated demand. The founder's ElevenLabs story still lacks a reusable reproduction.

**Inference:** a contribution that preserves an investigation and receives a useful result back can benefit its human operator. **Hypothesis:** assisted drafting makes that benefit worth the review effort. Neither is validated yet.

## First recruitment and test

Recruit six developers who debugged an AI API/model integration in the last month: three investigation owners and three different reusers. Ask the founder to recruit from existing contacts and communities where participation is allowed; no outreach has been sent. Avoid leading with “would you use this?” Ask:

1. Show the last failure that took more than thirty minutes. What did you search, and what did it miss?
2. Which exact failed attempt would you want the next developer to avoid?
3. Can someone outside your company reproduce this from a sanitized input? What cannot leave your workspace?
4. Where would you preserve this today? Why would a public record help more than that option?
5. Review this draft: what must be corrected or removed before you would publish it? Measure the actual review time.
6. After trying another person's finding, what made it applicable or inapplicable? Would you record that outcome now? Observe completion, not stated enthusiasm.

Obtain three consented investigations with exact environment, a failing check, and an inspectable attempted remedy. Select genuinely observed tasks; do not fabricate bugs to populate the app. Include one deterministic SDK/integration failure where possible, one stochastic provider behavior only if repeated trials are affordable, and one real version mismatch where rejecting the proposed fix is correct. If these cannot be collected, record that recruitment/coverage failure before expanding scope.

For each task run two fresh baseline attempts and two fresh attempts with Token Overflow access, twelve runs total. Keep ordinary docs/web search available in both arms. Freeze task input, starting repository, model identifier, tools, permissions, and completion check; randomize run order and isolate sessions. The treatment adds the real search/detail workflow, not a handpicked answer pasted into the prompt. A second person assesses the same predefined completion check without knowing the arm where feasible. This is a small diagnostic pilot, not a statistically reliable savings estimate.

Record per run: correct completion, applicable finding retrieved, inappropriate advice followed or rejected, time, billed usage if available, and abandoned attempts. Record setup, drafting, sanitization, and human review effort separately; uninstrumented cost is unknown, not zero. Do not initiate paid model/provider replay without the operator's explicit bounded authorization. Prior's [own experiment](https://prior.cg3.io/blog/ai-agents-shared-debugging-history) acknowledges stochastic variation, one run per arm, missing second-cold controls, and vendor bias; the extra baseline here addresses a known weakness, not all uncertainty.

Report all twelve rows, including failures. Proposed next-step gate: at least two findings pass their fixed check with a different operator; the mismatch is correctly rejected; at least two owners approve an accurate sanitized record within five minutes of hands-on review. These are chosen learning thresholds, not established market benchmarks. If reuse works but capture fails, improve capture; if capture works but relevant reuse fails, revisit coverage before adding rewards. Run the next real task before making savings claims.

## Quality rubric and provenance

Use this as a reviewer checklist, not a public score or an implementation expansion for v1:

| Criterion | Sufficient for a reusable report | If missing |
| --- | --- | --- |
| Observation | Expected/actual behavior, timestamp, exact versions/model or explicit unknowns | Keep as a lead needing reproduction |
| Procedure | Sanitized minimal input and a repeatable pass/fail check | Do not imply reproducibility |
| Remedy | Exact change, before/after evidence, failed attempts and their conditions | Label fix proposed, with uncertainty |
| Provenance | Actual operator/account, origin link where applicable, artifact/source attribution and permission to publish | Do not import unattributed sessions or third-party text |
| Counterexample | Same check, tested environment, result and deviations; contradictory outcomes preserved | Do not merge unlike environments into one global verdict |

An author cannot independently confirm their own work. A second account is only another account: disclose shared operators or organizations when known, and never claim Sybil resistance. For stochastic behavior record trial count and failures in each condition; one successful replay is weak evidence. Retain reports of failure, partial success, and unknown outcomes. An unsupported root-cause theory remains a theory even when the workaround helps.

## Founder auth choice

Recommend **GitHub OAuth first** for this developer cohort. Supabase's [current setup guide](https://supabase.com/docs/guides/auth/social-sign-in/auth-github) requires an OAuth App and provider credentials. It avoids depending on email delivery in the normal provider-confirmed flow, but excludes email-only contributors; that is a product tradeoff, not proof the current deployment works. Test a fresh external GitHub account, callback, persistent session, signout, and authorized contribution before declaring public auth ready.

Choose **Resend Free** if email-only recruitment is material: current quotas are 100/day, 3,000/month, and three verified domains. It adds domain verification, sender configuration and delivery checks. Supabase default SMTP is team-address-only with a current two-per-hour limit; it is not a public email-signup solution. These are current documented limits, not inspected project settings. [Resend quotas](https://resend.com/docs/knowledge-base/account-quotas-and-limits), [Supabase SMTP policy](https://supabase.com/docs/guides/auth/auth-smtp). Existing launch memos contain the setup details; no provisioning is recommended by this memo alone.

## Incentives and intuitive adoption — founder-direction follow-up

The founder wants broad participation by tool-capable AI and a simple human flow. `company/incentives.md` already aligns on operator ownership, open reads and evidence. Its gap is an explicit immediate reward: **publish once, retain an attributed reusable finding, then learn where it helped or failed**. This is a product recommendation; feedback delivery and retention benefit have not been validated or implemented by research.

| Mechanism | Benefit to the operator | Recommendation / hypothesis |
| --- | --- | --- |
| Free public reads | Try a finding before setup or disclosure | Keep as the baseline; free is compatible with protective rate limits, not unlimited infrastructure |
| Attribution and reuse feedback | A shareable record of work and new applicability information | First incentive to test: link every outcome to the finding, operator and tested environment; negative results also earn acknowledgment |
| Earned capacity | More useful work when a real limit is binding | Later experiment: a bounded, revocable increase after reviewed useful contributions; never require writing to unlock ordinary reads |
| Community reputation | A legible history that may support professional recognition | Show attributable evidence and maintenance history before introducing any scalar score; no volume leaderboard |

**Primary-source evidence, not proof of effectiveness here:** [Stack Overflow](https://stackoverflow.com/help/whats-reputation) links community reputation to privileges while making basic participation available at minimum reputation. Its [voting correction policy](https://stackoverflow.com/help/serial-voting-reversed) documents removal of coordinated or person-targeted votes; recognition needs correction mechanisms. [GitHub stars](https://docs.github.com/en/get-started/exploring-projects-on-github/saving-repositories-with-stars) serve retrieval and appreciation, illustrating why appreciation must not be displayed as a successful reproduction. GitHub's [API limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) distinguish unauthenticated public access and authenticated capacity; that is evidence that openness can coexist with quotas, not evidence that contribution-based quotas improve quality.

**Recommended human flow:** search the symptom → inspect environment, failed attempts and exact proposed change → record an observed result or share a sanitized new finding. Place optional connection instructions after a person sees that value. A result form should ask what happened and where, not require a theory or a celebratory endorsement. Start a new finding with symptom and environment, then reveal reproduction/evidence prompts; keep the evidence requirements without presenting every field before the user begins. Test this flow with actual participants; references alone do not validate intuitiveness.

**Recommended agent flow:** support documented HTTP tools and MCP for compatible hosts; let the operator authorize reads and separately authorize public writes. Search before a relevant debugging loop; apply only if conditions match; offer a small sanitized contribution draft at completion. No model should be assumed to desire points or to install tools independently. The [current MCP tools specification](https://modelcontextprotocol.io/specification/2026-07-28/server/tools) makes tool selection host/model dependent and leaves interaction design to implementations, so “every AI automatically participates” is not a capability claim we can make. Compatibility should name tested clients/protocol versions.

**Next experiment:** in the six-developer pilot above, explicitly offer an attributed portable finding and a later linked reproduction result. Observe approval effort, willingness to publish after seeing the exact public content, and whether operators return to inspect or add the outcome. Record refusals and reasons. Compare that experience with their current way of preserving an investigation; do not add points simply because nobody contributed to an empty feed. Only test earned capacity after real legitimate usage hits the existing limit, with a global budget ceiling and reviewed quality. Reward useful counterexamples and maintenance as well as successful remedies; otherwise the incentive suppresses uncertainty. No numerical reputation formula or higher quota is authorized by this recommendation.

## What the owner-to-agent loop can honestly ship

Read-only source audit, 2026-10-30; this is not a new runtime or deployed-client test. Current company memory and Rowan's [connection memo](2026-10-30-agent-connections.md) were consulted. The TypeSafe/PostHog/XP exploration changes presentation, not these product facts.

| Loop step | Present in source | Limit or absent piece |
| --- | --- | --- |
| Owner connects public retrieval | URL-only MCP example, no read key, HTTP fallback; search/detail tools | No tested production client connection or universal-agent compatibility claim |
| Agent searches and checks applicability | Concise MCP search, canonical report URL, full evidence/versions and both outcomes | No automatic reproduction or quality verification |
| Owner approves a sanitized contribution | Suggested agent instructions ask permission; owner-bound expiring/revocable key authorizes writes | No server-side draft/review queue or per-post consent enforcement; key possession enables direct publication |
| Owner retains portable attribution | Public report URL, names, timestamps and JSON; MCP text and structured evidence | Display names are not verified professional identities; no dedicated download/export or contributor profile/history |
| Another operator reports reuse/counterevidence | Worked/failed observations attached to fix with environment/notes; self-results rejected | No notification, subscription, relevance feedback or measured time saving; a report view is not evidence of reuse |
| Existing observation is corrected | Conflicting observations from other accounts/environments stay visible | No edit, withdrawal or supersession path found; unique account/fix/environment prevents the same operator appending a corrected result in identical environment |

Source: [agent setup](../../app/agents/page.tsx), [MCP tools](../../app/api/mcp/route.ts), [portable output](../../lib/mcp-evidence.ts), [public payload and write receipt](../../lib/api.ts), [report UI](../../app/reports/[id]/page.tsx), [schema](../../supabase/schema.sql). Follow-up source check: MCP now adds a best-effort parent-report `source_url` to successful report/fix/result receipts; a failed post-save link lookup retains success. REST fixes/results still return IDs/kind. Neither is a precise observation permalink. Public payloads intentionally omit private account IDs; attribution is a displayed name, not a verified GitHub identity.

**Current primary client evidence:** [Claude Code](https://code.claude.com/docs/en/mcp) documents persistent user-scope HTTP registration, connection status and client tool permissions. [Cursor](https://cursor.com/docs/mcp) documents global/project URL configurations, environment-based headers, and explicit installation/enablement; distribution alone does not install a server for everyone. Thus connect-once retrieval is a supported pattern to test, not evidence that a connected tool will be chosen on every task. No marketplace listing or one-click installer exists here. Manual write keys still expire; persistent setup does not mean perpetual write authorization.

**Three CEO decisions:**

1. **Ship retrieval first in onboarding.** Show URL-only connection and one search, then optional contribution setup. This reduces setup friction; it does not itself solve corpus scarcity. Keep independent HTTP instructions for hosts without compatible MCP. Test the actual clients before calling them supported.
2. **Use instructed owner review for the pilot, with accurate copy.** The agent shows its sanitized draft and asks before using its key. This can ship with current tools, but arbitrary third-party clients can skip that step. A guaranteed approval queue would require a distinct engineering scope; do not imply one exists.
3. **Promise linked outcome evidence, defer automatic feedback/reputation.** A report link and raw JSON already make work reusable. Before rewarding maintenance or inviting ongoing corrections, choose an explicit way to correct an observation without bypassing the duplicate rule. Keep this a bounded future decision, not a schema change authorized by research. Until then, recruit fresh independent retests and disclose the correction limitation.

**Hypothesis to test:** a persistent read connection plus an accurate reusable artifact and observed third-party outcome is enough benefit for some operators to contribute voluntarily. Preserve the option to read privately or decline to publish. Never require a quota of submissions, label incomplete evidence as verified, or treat an invented environment as an acceptable way around the correction limit.

## Real public candidates for the evidence-unit pilot

Checked 2026-10-30. These are upstream reports/release evidence, not our reproductions, app contributions, or verified fixes. All three concern real MCP integration failures; they do not establish coverage of stochastic model/provider problems. The founding ElevenLabs case remains separate and unverified. No packages were installed, examples executed, or paid APIs called during selection.

**1. Preferred first local task: SSE response ends before the JSON-RPC result.** [Upstream issue #2739](https://github.com/modelcontextprotocol/typescript-sdk/issues/2739) reports `@modelcontextprotocol/sdk` **1.26.0 and 1.29.0**, Node **24.18.0**. A separate commenter reports **1.29.0 and 1.30.0**, Node **22.18.0**, with JSON control succeeding. Smallest check outline: independently write a mock fetch that handles legacy initialization and returns an SSE body for `ping`; end it without a matching response, then repeat with a body error. With a 300 ms request timeout, record request rejection time, error callback and reason. Control: return a matching JSON response and confirm prompt resolution. Reported failure is waiting for the outer timeout after SSE termination; body error and clean EOF differ. Suggested patches exist in discussion, but **no fixed release was established**. This is especially suitable for failure/negative-result capture without inventing a successful fix. Pin runtime/package and record timing rather than claiming an exact universal millisecond threshold.

**2. Known merged change: published declaration files fail consumer typecheck.** [Merged PR #2394](https://github.com/modelcontextprotocol/typescript-sdk/pull/2394), merge **801111ea152c1ba08f6dda0b27d712759aeb46bf**, describes dangling `URIComponent` references causing TS2304 with `skipLibCheck: false`. The [client changelog](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/packages/client/CHANGELOG.md) places this fix under **2.0.0-alpha.4**. Exact affected published version was **not established**; do not label alpha.3 broken by inference. Check outline: isolated fresh consumer, minimal client/server imports, pinned TypeScript/runtime, `skipLibCheck:false`, and identical typecheck before/after the merge or an evidenced bad package. PR reports the patched consumer exits zero. For TypeScript ≥6, supply Node types so missing `Buffer` declarations are not confused with this bug. Good fixed-change candidate after identifying the precise failing artifact; not ready for a claimed two-version benchmark yet.

**3. Applicability counterexample: notification with `Connection: close`.** [Issue #2730](https://github.com/modelcontextprotocol/typescript-sdk/issues/2730) reports Node **24.18.1**, SDK **1.30.0**, and separately server/node **2.0.0**. Check outline: initialize a local Node transport using the legacy protocol, then submit `notifications/initialized` with and without the literal `Connection: close` header. Record HTTP status/body and transport settings; claimed outcome is bare 400 only with that header, versus empty 202 otherwise. Reporter describes clearing the header at a configurable proxy as a workaround, **not an SDK fix**. No fixed release or independent reproduction was established. Scope it to the reported Node transport; do not extend the claim to Token Overflow's different handler stack without evidence.

**Provenance before any reuse:** retain issue/PR URL, author attribution, date, package/runtime pins, and our own actual output in the eventual evidence record. No source code is copied here. Prefer an independently written minimal fixture from the behavioral description; issue snippets and external reproduction repositories require their own permission/license check before copying. The SDK's [current license file](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/LICENSE) describes an MIT-to-Apache-2.0 transition with some earlier contributions retaining MIT; inspect the exact pinned revision/file and preserve applicable notices if adapting repository tests. Do not assume a repository's current license grants blanket rights to every issue comment or linked artifact.

**Next useful independent work:** after a separately authorized local retest, retain a bounded fixture and raw before/control outputs for candidate 1. For candidate 2, first locate the exact failing published tarball or use documented commit-bound comparison. Until those checks occur, source claims stay labeled and nothing is imported into the public app. This shortlist supplies pilot inputs; it does not replace recruitment evidence or prove demand.

## Next decisions: truthful outcomes for candidate #2739

Synthesis of Maya's [proposed evidence contract](2026-10-30-evidence-contract.md), Rowan's [actual client evidence](2026-10-30-agent-connections.md), and current source. No new execution or public observation. Three consequential choices remain:

1. **Separate baseline applicability from fix outcome.** Recommend Maya's separate baseline resource if/when approved; keep the present `worked|failed` fix contract stable. Minimum human labels: **Failure reproduced**, **Failure not reproduced**, **Check inconclusive**, then **Change worked here** or **Change failed here** only after a valid baseline/change/rerun. In #2739, initialization failure or a fixture that never reaches the intended SSE termination is inconclusive. A valid run that does not exhibit the reported delayed rejection is baseline not reproduced. Neither is a failed fix. Current code has no baseline/inconclusive result resource; retain these in pilot notes rather than force them into public fix counts. The proposed resource covers reproduced/not-reproduced but still must keep a blocked or invalid check out of both outcomes.
2. **Define success by the same failure-specific check, not generic improvement.** For #2739 record package/runtime/protocol, configured deadline, SSE termination time, error callback time, request-settlement time and reason; compare the identical EOF and body-error checks before/after one explicit change. Successful JSON control shows the fixture can complete a request; it does not demonstrate an SSE-lifecycle repair. Lowering the timeout is not that repair either. A candidate succeeds only under a declared criterion of prompt terminal settlement after unexpected stream loss, preserving valid responses and intended cancellation. Timing thresholds must be set before retest and tolerate scheduling variation; no universal millisecond cutoff is established. A longer-deadline repeat can distinguish timeout-driven settlement from stream-driven settlement. Maya's output text can retain these measurements initially; new telemetry fields are not required for the pilot.
3. **Separate retryable retrieval failures from uncertain publication.** Current MCP marks reads idempotent and writes non-idempotent; there is no write idempotency token. A missing write response can mean the contribution was saved, so blind republishing risks duplicates. Recommend bounded retries for explicitly read-only transient connection failures, with a declared attempt/deadline budget; inspect a returned contribution ID or reconcile before any uncertain write retry. No retry policy is implemented or validated by this memo. A timeout encountered while testing #2739 is the measured symptom, not automatic proof that Token Overflow's transport or a proposed fix failed. Client setup, handshake, tool call, and successful task outcome stay separate evidence levels; Rowan has real Claude handshake evidence, not model-directed retrieval yet.

Current public claim remains **contributor-reported outcomes in supplied environments**. Automatic feedback, saved time, stable verified identity and a contribution economy remain future hypotheses. At this synthesis handoff, the next dependency was CEO authorization of an isolated local fixture/retest; the authorized outcome is recorded below.

## Authorized #2739 local diagnostic outcome

CEO authorized the isolated mock-only retest. [Small harness, exact provenance and retained output](pilots/2026-10-30-mcp-sse/README.md): official SDK **1.29.0**, Node **26.11.1**, darwin arm64, requested/returned protocol **2025-11-25**. Four matching JSON controls resolved; all eight SSE EOF/body-error cases rejected with SDK timeout near the chosen 300/1200 ms deadline despite stream termination near 1 ms. No setup failures or watchdog expiries in the diagnostic cases. The longer deadline increased the pending delay. This is **baseline reproduced locally**, not baseline-not-reproduced, inconclusive, or failed fix. Node differs from upstream; no real server/network/model call was used. Jules reviewed the harness/initial interpretation and requested corrected protocol metadata; one rerun captured the corrected final artifact. **No fix was tested or validated, and nothing was uploaded to the app.** Next comparison depends on a primary-source-established fixed artifact or separately scoped patch; more reproduction-only runs would add little now.

## First-user acquisition kit — review only

2026-10-30. Founder selected design 3; implementation/deployment are owned elsewhere. No distribution, listing, issue creation, recruiting or app ingestion is authorized by this kit. No visitors, probes, reviewers or test agents are counted as acquired users.

### Founding research case, ready for identity/provenance review

[ingestion-draft.json](pilots/2026-10-30-mcp-sse/ingestion-draft.json) contains one current-schema report inside a review envelope: tested versions, failing check, observed timeout outcome and original-source attribution. It is an **open investigation with locally reproduced failure**, with no fix or fix verification attached. The display label is a research label, not a verified person/account. Confirm publisher identity, approve exact public content and attach the tested harness/output at a stable public revision before ingestion. This record is distinct from the unverified ElevenLabs illustration. Its successful JSON controls are neither fixes nor community confirmations.

Value proposition to test: **A free debugging evidence library for developers and their agents: inspect the failing check, exact versions and failed attempts before repeating the investigation. Preserve your own sanitized finding when it is useful to share.** Do not promise coverage, savings or automatic participation by every AI.

### Three concrete distribution options and current rules

| Channel | Primary rules checked | Proposed use and limits |
| --- | --- | --- |
| r/AI_Agents weekly Project Display | [Community rules](https://www.reddit.com/r/AI_Agents/about/) direct project links to the weekly display thread, prohibit spam/low-effort posts and suggest one promotional item per ten posts/comments. [Currently highlighted project thread](https://www.reddit.com/r/AI_Agents/comments/1xbr4a7/weekly_thread_project_display/) explicitly invites AI/LLM projects. | First choice: one founder-disclosed comment in the then-current project thread. Existing [founder discussion](https://www.reddit.com/r/AI_Agents/comments/1xj4lk8/do_you_think_a_stackoverflow_equivalent_for_ai_be/) supplies context and objections, not a recruited cohort. Recheck active thread/rules/account eligibility at posting; do not manufacture participation to meet the ratio or send unsolicited DMs. |
| Show HN | [Show HN rules](https://news.ycombinator.com/showhn.html) require something people can try, preferably without signup; no landing-page-only submissions or vote solicitation. [General guidelines](https://news.ycombinator.com/newsguidelines.html) prohibit generated/AI-edited text and automated posting. | Conditional second choice after a useful working read flow exists. Founder must independently write and submit their own text and be available to discuss it; **the draft below is not for HN**. An empty database plus a polished landing page is weak hands-on value; publish the research case/artifacts first if approved. |
| Official MCP Registry | [Remote-server rules](https://modelcontextprotocol.io/registry/remote-servers) require a publicly accessible endpoint and support `remotes` with Streamable HTTP; [authentication rules](https://modelcontextprotocol.io/registry/authentication) require namespace ownership/authentication. Registry is in preview. | Discovery channel after real deployed search/detail pass. Prepare remote-only metadata for `https://tokenoverflow.app/api/mcp`; ordinary reads must not require a contribution key. Select owner namespace at approval; do not claim listing, endorsement, directory propagation or installation by every client. No npm wrapper is necessary solely to describe the documented remote endpoint. |

### Reviewable Reddit Project Display draft

Use only after CEO authorizes distribution and confirms the deployed read flow and linked repository artifacts are publicly usable. Founder should review every first-person statement. No post has been sent.

> I’m building Token Overflow, a small public library of debugging findings for developers and their agents. I raised the idea here earlier; the useful criticism was that confident answers aren’t evidence, versions matter, and contributing has to help the person running the agent.
>
> One starting research case is an MCP SDK 1.29.0 failure: with Node 26.11.1 and a mocked SSE response, the stream ends near 1 ms but the request stays pending until its 300/1200 ms timeout. All four matching JSON controls passed. We have a small harness and raw output; we have not validated a fix. This is a local diagnostic, not a production reliability claim.
>
> You can read and search without an account. Optional MCP connection gives an agent the same evidence. This first launch is for public reads; GitHub sign-in and contributions are still being set up. There are no contribution credits required to read.
>
> Try it: https://tokenoverflow.app — agent setup: https://tokenoverflow.app/agents — source and research artifacts: https://github.com/Amnx404/tokenoverflow
>
> If you recently debugged an AI integration, try searching the actual symptom. What relevant detail was missing, or what made you reject a match? A negative result is useful feedback too. Please keep private code, credentials and customer data out of public replies. I’m the builder; this is an early test, not a proven savings claim.

### Link flow and feedback intake

Recommended first task: project comment → public search → finding/source evidence → optional agent setup → optional sanitized contribution. Once the approved research case has an actual public ID, add its real detail URL to the comment; never invent an ID or imply it is already ingested. Keep the GitHub source/artifact path reachable even if no applicable fix exists. Before owner auth is verified, do not make contribution the required next step. Link [GitHub Issues](https://github.com/Amnx404/tokenoverflow/issues) for feedback; the public issue page and New issue entry were observed, not a successful issue-submission test.

Ask in a public issue or voluntary pilot note:

- What real task were you attempting, and through website/HTTP/MCP with which client/version?
- Did you find a relevant record? Link it and state matching/mismatching versions; use a sanitized symptom rather than a private prompt/session.
- Could you reproduce the baseline? If tested, what exact check/output and changed behavior did you observe? Separate not reproduced, inconclusive and failed fix.
- Where did the flow stop: setup, search, interpretation, local check, sign-in or publication? Include UTC time and request ID if the UI/client exposes one, never a key.
- What did this change about your next action, and how long did review/sanitization take? Self-reported benefit stays labeled; it is not measured savings.

### First three metrics and upkeep

Source check during this pass: health/trace files landed in [health route](../../app/api/health/route.ts), [backend check](../../server/services/health.ts) and [observability helper](../../lib/observability.ts), with use across API/MCP/tRPC. These are **implementation facts, not deployed verification**. Failure logs carry operation/route/status/error code/duration/request ID and deliberately exclude payloads/URLs. Successful requests are not logged by this helper; health probes test a small anonymous database read with caching, not OAuth, writes or user value.

| First metric | Definition and available collection | Limits |
| --- | --- | --- |
| Activated real operators | Weekly count of distinct voluntary external operators who report completing a real search and inspecting evidence; record website/client and task in an opt-in GitHub pilot issue/note. | Manual, incomplete sample. Visits, IPs, keys, health checks and internal test calls are not operators; no automatic activation funnel exists. |
| Useful evidence outcomes | For those observed real tasks, report counts of relevant/applicable record, no match, baseline not reproduced, inconclusive, and conclusive local fix outcome. Preserve denominator of reported task attempts and reasons. | Issue-based research coding; current app only stores worked/failed fix results. Do not derive usefulness from HTTP 200, clicks or a search hit; no automated reuse-feedback feature exists. |
| Unresolved operational failures | Group observed failure logs by operation/error code, deduplicate by request ID, and link sanitized defects to GitHub issues; track unresolved age and whether the same failure recurs after a tested repair. Keep health failures separate. | Failure logs alone cannot yield error rate, traffic denominator or unique-user count. Successful-request metrics, production access/retention, deployed verification and automatic issue creation remain unestablished. |

Recommended upkeep when live evidence exists: CEO routes reproducible failures to the system owner; Iris summarizes actual user tasks, missed applicability and refusals; Jules verifies repairs against the triggering case. Review unresolved issues and new failure signatures daily during the initial cohort, without posting unchanged status or creating unsupported claims. This is an operating recommendation, not a scheduled automation. No trace payloads, credentials or private user identities belong in the public company record. Next distribution decision is the concrete Reddit comment/channel above after live-read and provenance gates pass; HN and registry remain separate later choices.

### Reviewed intern checks: eligibility and first operator selection

Iris reviewed Tessa's channel/registry check and Omar's pilot shortlist; both are direct named medium-reasoning interns, without delegation, contact or publication authority.

**Material registry constraint:** the [official FAQ](https://modelcontextprotocol.io/registry/faq) currently says deletion/unpublishing is unavailable and published version metadata is immutable; an update needs a new unique version. CEO/founder approval must therefore cover the exact namespace, metadata and version before listing. Remote-only metadata needs no npm wrapper. GitHub namespace must match the authenticated publisher; domain namespace `app.tokenoverflow/tokenoverflow` would require separately authorized domain proof and signing-key custody. No listing is approved.

Tessa confirmed the community feed still highlights Project Display **1xbr4a7** despite its “8d ago” age. Call it currently highlighted rather than assume it is a new weekly thread. The public rules establish no minimum age/karma; this does not establish account eligibility or moderation acceptance. Before an approved post, inspect the intended account's actual composer and promotion history, current highlighted thread, and every destination link. The stated one-in-ten ratio is guidance, not guaranteed permission.

**Pilot priority after voluntary opt-in:**

1. A developer with the actual [#2739 POST-response EOF/error workflow](https://github.com/modelcontextprotocol/typescript-sdk/issues/2739): inspect our approved record and answer applicable/different mechanism/unknown with one environment-based reason. Learn whether it changes the next debugging step; no execution or install is required for this first task.
2. A developer seeing the adjacent [#2098 standalone GET-SSE reconnect-exhaustion workflow](https://github.com/modelcontextprotocol/typescript-sdk/issues/2098): determine why #2739 does **not** establish the same diagnosis or fix. This is a useful rejection task. The public report is bot-authored, so a responsible human operator is not established. Do not infer a recruit or contact identity from that account.
3. Founder rehearsal using the original ElevenLabs discussion: identify missing model/settings/input/check details and approve a sanitized outline. This is internal capture research, not an external acquired user or verified failure.

Selection rule: voluntary external operator, real recent task, safe symptom/environment disclosure and roughly ten minutes for read/source inspection/applicability feedback. Refusal, no match and uncertainty remain outcomes. Public issue participation expresses debugging pain, not consent or demand for Token Overflow. Next useful evidence is one genuinely opted-in operator's applicability decision after the approved public launch route; no further local baseline runs or generic competitor scan is needed now.

**Peer-reviewed refinement:** Wren (Researcher) identified that showing a handpicked #2739 record first tests comprehension but bypasses discovery and may add nothing beyond upstream. Iris agrees: for the first opted-in real task, record the sanitized symptom and intended next action, let the operator search normally without a supplied result, then inspect any found record and its upstream source separately. Retain no match, inapplicability, uncertainty and upstream-alone/no-added-information as explicit outcomes. This sequential qualitative session cannot establish causal savings or eliminate order bias. First launch remains public reads, so no installation, sign-in, execution or contribution is required; voluntary sanitized feedback can use GitHub Issues. See [Wren's reviewed proposal](../people/wren.md). Operator/adoption/incentive ownership remains Iris; ongoing actionable external research belongs to Wren. No contact, ingestion or release change is authorized by this refinement.
