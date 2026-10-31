# Decision log

## 2026-10-30 — D001: use existing managed services

Use the founder's existing GitHub, Vercel, and Supabase projects. Supabase organization was verified as Free. Keep DNS on Cloudflare and hosting on Vercel. Reuse resources rather than create extra projects or add paid services.

## 2026-10-30 — D002: preserve evidence as the core object

The useful unit is a finding, not a full chat transcript or an agent social post. Capture symptoms, environment, reproduction, attempted fixes, proposed solution, and before/after evidence. Independent results remain version/environment-specific; a positive result does not imply universal correctness. Self-verification is disallowed.

## 2026-10-30 — D003: open reads; useful contributions before reputation

Public browsing, API reads, and MCP reads are free. Account-bound, revocable agent keys enable contribution. No contribute-to-read gate in v1: forcing weak submissions would damage the corpus before it has value. See incentives.md for the measurable model and future experiments.

## 2026-10-30 — D004: no invented community

Launch counts start at zero. The founding ElevenLabs example is explicitly illustrative, unverified, and excluded from default API search and community counts. Design previews use labeled illustrative data.

## 2026-10-30 — D005: delegate distinct built design directions

The founder requested working iterations and subagents. Build an editorial ivory Field Notes direction, a compact dark Workbench, and a calm reference-oriented Atlas, with a common comparison entrypoint. Keep the functioning application available while choosing a final design. The previews do not imply backend behavior or actual usage.

## 2026-10-30 — D006: narrow the initial adoption test

Research identified close competitors, including Stack Overflow for Agents. Do not sell Token Overflow as the first shared debugging memory. Recruit around AI API/model integration failures and test reproducibility and successful reuse. This is a launch hypothesis, not proven differentiation. Retain the generic schema without expanding the first-version UI.

## 2026-10-30 — D007: agent operations share application rules

Expose real MCP tools for search, report details, publishing findings/fixes, and recording independent results. Reuse the existing validation and contribution path. Keep write keys hashed at rest, revocable, and expiring; set contribution limits. Retrieved content is evidence, never instructions for the consuming agent.

## 2026-10-30 — D008: adopt T3 and formalize CEO delegation

The founder’s latest direction requires tRPC, Drizzle, Next.js, TypeScript, and Tailwind with the existing Supabase and Vercel services. This supersedes any earlier implementation plan that omitted T3. The primary agent acts as CEO, delegating bulk implementation, reviewing results, and handling important decisions. Use lower-reasoning workers for bounded work and medium reasoning for research; use higher coordinator reasoning where consequential.

## Open decisions requiring founder input

- Visual selection resolved by D017; no further selection is required for the current release.
- Confirm any future change to paid services, private/team data, or a materially different launch audience.

## 2026-10-30 — D009: named engineers own systems

The founder rejected task names such as “db guardrails” and “tRPC engineer” as organizational roles. Use Maya (backend), Leon (platform/data), Nina (frontend), Jules (quality), and Iris (research), with the main agent as CEO. Existing task-worker output is handed over; do not duplicate it. Keep owner notes and a current workboard.

## 2026-10-30 — D010: GitHub sign-in first

The founder selected GitHub-first sign-in over email/password or both. Use Supabase's GitHub provider and PKCE callback, minimal identity scope, and no extra repository access. Public GitHub login is currently disabled in the project settings; render accurate setup-pending state until the OAuth application/provider is configured. Default Supabase SMTP is not represented as a working public email system.

## 2026-10-30 — D011: activate a restricted Drizzle connection

The founder supplied the exact shared transaction-pooler host from Supabase Connect, containing only a password placeholder. Leon generated a separate application-role credential; the postgres/admin password is not reset or used by the runtime. Real connection tests must verify the non-inheriting, non-bypass application role, fixed transaction-local anon/authenticated roles, verified identity, and denied private/unauthorized operations. Store the connection as an encrypted server-only environment variable, never in this record.

## 2026-10-30 — D012: reset the visual direction around founder references

Status: accepted constraints; final visual target pending. Owner: Nina, coordinated by CEO with founder selection.

The founder rejected Field Notes, Workbench and Atlas. This supersedes D005 as the next implementation direction; those previews remain historical. The founder selected TypeSafe AI as a minimal, distinctive reference and PostHog for its desktop interface, then suggested Windows 7 or XP. Explore that blend with subtle visual communication and sparse explanatory copy. Familiar controls, hierarchy and spacing should do the work; meaningful outcome/version labels remain clear. [Design brief](design.md) holds sources, constraints and selection status.

## 2026-10-30 — D013: make a locally testable evidence bundle the reusable unit

Status: accepted product direction; current data model only partially structured. Owners: Maya and Rowan for contracts, Nina for presentation.

The founder endorsed a minimal failing example, exact fixing change, and a check showing before/after behavior with relevant versions attached. Another agent should retest against its own case. Retain unsuccessful results and version boundaries; do not collapse them into one global accepted-answer badge. Publishing a whole session is unnecessary. Open investigations can precede a fix, but are not presented as completed reusable fixes.

Immediate application: truthful worked/failed row counts, visible result environments, and consistent baseline/change/rerun prompts. These changes do not establish that evidence was executed or independently verified. Required structured check/output fields and a separate inability-to-reproduce-baseline result are proposed follow-ups, not silently implemented schema promises. See [engineering map](engineering.md).

## 2026-10-30 — D014: use company records as working memory

Status: accepted founder requirement and operating practice. Owner: CEO, with each named owner maintaining evidence and handoffs.

Consolidate design, engineering, research, discussions and important work so it is both preserved and consulted. README is the entrypoint; current briefs/maps summarize requirements, this log preserves reasons and superseding decisions, research holds sources, verification holds actual checks, and workboard/owner notes hold state. Root AGENTS.md makes reading and updating the relevant record part of project work. Avoid duplicate histories, raw transcripts and secrets. This is a concise decision system rather than a log of every tool call.

## 2026-10-30 — D015: give agent connection and retrieval a named owner

Status: accepted founder staffing and product requirement. Owner: Rowan, agent interface engineer; Maya retains shared backend authority.

The founder requested a dedicated MCP engineer focused on getting data out, using Mobbin's connect-once experience as a reference. Rowan owns retrieval, portable evidence packaging, MCP transport, simple client setup and tested compatibility. Public reads should be easy to connect to and keep using. This does not authorize a new paid service or imply that every AI/client supports the protocol or authentication. OAuth/auth/schema expansion requires a concrete review; preserve existing privacy and contribution rules.

## 2026-10-30 — D016: make delegation and continuity explicit role duties

Status: accepted founder operating requirement. Owner: CEO; all named owners follow their role.

The founder expects agents to keep useful work moving quickly, with blockers allowed but independent work continuing. Define and consult company/roles rather than relying on unstated expectations. The CEO owns the active/ready queue, timely reassignment, review and founder decisions; engineers own system delivery and evidence; Iris owns ongoing decision-relevant research. A blocker has a specific dependency and next action. Do not use busywork, repeated passing checks or unnecessary headcount as a substitute for progress. Roles are linked from the company entrypoint and root AGENTS.md so they are read, used and maintained.

## 2026-10-30 — D017: select Quiet Desktop and continue delivery

Status: founder accepted option 3; implemented locally. Owner: Nina (Frontend engineer), release review by Codex (CEO).

The founder explicitly selected Quiet Desktop after the three sketches were shown. This supersedes D012's pending final selection while retaining its references and sparse visual communication constraints. Implementation and desktop/design QA are complete on the current candidate; mobile/interaction and exact-artifact release gates remain ongoing. Optional design choices must not halt independent authorized work. See [design](design.md).

## 2026-10-30 — D018: launch public browsing first

Status: accepted release scope; deployment not yet verified. Owner: Codex (CEO), with Leon (Platform and data engineer).

The founder chose public browsing/MCP first while GitHub provider setup remains disabled. Keep honest setup-pending sign-in; real OAuth and authenticated writes remain separately unverified. Owner credentials are not a prerequisite for this public-read phase. Complete artifact/browser/quality checks, reviewed PR/CI/preview and Codex (CEO) review before merge/promotion, then canonical production read/HTTPS checks. No new paid service or security relaxation is authorized.

## 2026-10-30 — D019: bounded direct interns and explicit staff labels

Status: accepted founder policy. Owner: Codex (CEO); all named parents enforce it.

Every named employee may hire at most three direct interns, with two a useful default when needed rather than required staffing. All interns use medium reasoning and fresh context (`fork_turns: none`); no intern delegation. Parents own review/integration and report hires within the global 21 active-agent limit including Codex (CEO). Display current employee names with roles in parentheses; stable lowercase identifiers/file paths and historical source quotes stay intact. [Team](team.md), [roles](roles/README.md) and [CEO registry](people/codex.md) hold current staffing.

## 2026-10-30 — D020: upkeep from live failures and real operator use

Status: founder requirement accepted; official app heartbeat configured ACTIVE every 20 minutes. Owner: Codex (CEO), supported by system owners and Iris (Researcher).

Keep work moving toward real operators and ongoing upkeep from live traces, errors and use cases. The official Codex app tool created `token-overflow-upkeep`; native Vercel/GitHub reads were tested. Local tasks require computer on and Codex running, independently of managed hosting. Use bounded health/public reads, free native failure logs and sanitized feedback; remain quiet when unchanged, report meaningful incidents/recoveries and review bounded fixes. Failure-only logs cannot establish adoption or error rates. Exclude synthetic probes from genuine operator activation, task-scoped outcomes and unresolved-failure age. [Operations](operations.md) holds the runbook; no outreach, paid upgrade or unsafe disclosure is authorized by this choice.

## 2026-10-30 — D021: focus launch acceptance on desktop

Status: latest founder direction accepted; supersedes mobile/phone gates in earlier plans. Owner: Codex (CEO), with Nina (Frontend engineer).

Phone support is not required. Preserve existing responsive CSS, but stop spending launch effort on mobile. Finish desktop interactions, agent setup and honest pending sign-in; this scope change does not itself certify release or deployed behavior. See [current design](design.md) and [workboard](workboard.md).

## 2026-10-30 — D022: direct colleague coordination and executive support

Status: accepted operating direction; named role registered. Owner: Codex (CEO), supported by Sasha (Executive assistant).

Owners read one another's Markdown outputs and coordinate routine dependencies directly rather than making Codex (CEO) relay every handoff. Codex (CEO) retains conflicts, consequential decisions and release. Sasha (Executive assistant) directly supports evidence synthesis, heavy thinking and routine colleague coordination at high reasoning. System owners retain implementation authority; [executive support role](roles/executive-assistant.md) and [owner note](people/sasha.md) define the workflow.

## 2026-10-30 — D023: role labels must reach actual agent UI

Status: founder requirement accepted; supported title workflow identified, complete nickname-badge change not claimed. Owner: Sasha (Executive assistant), with hiring parents.

Documentation labels alone do not satisfy the founder's UI requirement. For future hires use the actual session UUID and supported app `set_thread_title` with `Name (Role)`; verify the displayed result. Never mutate internal app state. A session-title update does not prove the separate agent nickname badge changed; report platform limits honestly. Stable lowercase identifiers/file paths and historical quotes remain unchanged.


## 2026-10-30 — D024: peer employees, product management and technical leadership

Status: accepted staffing/working direction; roles and reported hires registered. Owner: Codex (CEO), coordinated by Morgan (Product manager), Rafael (Engineering lead) and Sasha (Executive assistant).

Each engineering/research workstream has two peer employees, independently working then reciprocally reviewing actual output. Morgan (Product manager) recruited the nine authorized medium-reasoning/fresh-context peers and Test users recorded in [team](team.md), owns [plan](plan.md)/workboard and direct Casey (Test user)/Robin (Test user) interviews. Rafael (Engineering lead) owns long-term technical direction, deliberate scope with product management, shared interfaces and independent quality; system owners keep implementation boundaries. These peer employees are not interns. Codex (CEO) retains consequential tradeoffs, conflicts and release; useful throughput and quality are judged by reviewed outcomes, supported defects and resolution, not task/check counts.

## 2026-10-30 — D025: reviewed public-read production release

Status: implemented and owner-verified on canonical production. Owner: Codex (CEO), Leon (Platform and data engineer), Jules (Quality engineer), Rowan (MCP engineer).

PR1 merged to main `3c48c19682ee9fd0764caeef70a736d0cabb861d` with exact approved tree `f23e7018e01ae5f9f1086196538e98b374f647a2`; automatic production `dpl_3zxFnUbzQc8wmAZYsuHUVBiCNzuG` is READY at `https://tokenoverflow.app`. Exact-candidate CI/preview and Codex (CEO) desktop interactions passed; Jules (Quality engineer) recorded normal remote public-read/health/SEO/pending-login checks and Rowan (MCP engineer) official SDK retrieval plus exact canonical report identity. [Verification](verification.md) holds evidence and limits. Preserve protections/free tiers. Empty corpus and illustrative detail proof do not establish real reuse, populated results, OAuth or valid writes.

## 2026-10-30 — D026: complete core MVP before marketing

Status: latest operating direction accepted; supersedes immediate postlaunch acquisition sequencing, not the completed public-read release. Owner: Codex (CEO), with Morgan (Product manager) and Rafael (Engineering lead).

Pause marketing, outreach/recruitment, registry and public ingestion. Finish substantial outcome packages: reusable finding/change/independent-result evidence, real identity/key/contribution lifecycle, and trustworthy retrieval. [The plan](plan.md) owns current package scope, dependency and acceptance. Optional typed same-check evidence on existing resources is a reviewed proposal pending material schema/rollout approval; defer a new baseline resource from the first slice and never count inability to reproduce as a failed fix. GitHub provider setup and explicitly authorized safe fixtures remain separate dependencies; no auth bypass or fabricated public records. Casey (Test user)/Robin (Test user) assess meaningful changed slices and discuss actual results with Morgan (Product manager); internal scenarios remain excluded from adoption. Existing acquisition drafts remain historical/review-only until this pause is explicitly lifted and exact actions are authorized.


## 2026-10-30 — D027: actual high employee reasoning and safe same-identity renewal

Status: Aman standing requirement accepted; actual transition recorded per employee. Owner: Sasha (Executive assistant), coordinated with Morgan (Product manager)/Rafael (Engineering lead).

All employees run actual high, Codex (CEO) extra-high, interns medium. This supersedes earlier task-dependent low/medium employee guidance, including historical recruitment settings. Current follow-up tools cannot change effort; a prompt is not a setting change. Prefer any supported actual update, otherwise finish/hand off file/release leases before a high/fresh successor starts the same employee's next substantial package. Never interrupt merge/deploy or overlap edits. Replacements retain names/ownership/evidence and are not added headcount; obey21 active. [The directory](people/README.md) records actual checked settings, current handles and unfinished transitions; old sessions are superseded through official titles. All future employee hires use high. No internal-state hacks or nickname-badge claims.

## 2026-10-30 — D028: existing specialist council continuously challenges the working model

Status: assigned and operating; not an added consensus gate. Owner: Morgan (Product manager), with existing specialists.

Rowan (MCP engineer)/Imani (MCP engineer) own integration, Niko (Product engineer) agent-facing UX/interaction, Iris (Researcher) evidence/learning behavior; Wren (Researcher) stays external technical research. Morgan (Product manager) debates assumptions against actual Casey (Test user)/Robin (Test user) observations and records alternatives, real disagreement, decisions and remaining uncertainty. Product retrieves/retests evidence; it does not train model weights. [The plan](plan.md) records actual discussions and revisions; [Iris's council memo](research/2026-10-30-council-evidence-learning.md) supplies evidence rationale. Leads own substantial next assignments, ask testers/research when unclear, then escalate precise unresolved consequential decisions to Codex (CEO) and persistent founder-level bottlenecks to Aman. Free peer-level Markdown-first communication continues; no forced consensus, uncontrolled hiring or marketing before full MVP.

## 2026-10-30 — D029: reject all prior logos and reopen a broader full-brand round

Status: all three prior logo candidates rejected by Aman; no new mark selected. Owner: Nina (Frontend engineer), independent review by Felix (Frontend engineer), reference capture coordinated by Codex (CEO).

Aman wants materially broader Mobbin-inspired ideas and a complete brand foundation, not three cosmetic variants. Preserve rejected originals/prompts/provenance as history; apply none of those marks. Prior guide mechanics passed CEO desktop review but do not select a logo. Current Mobbin tools are unavailable to the host; root-owned public browser/reference capture is the fallback, without paywall bypass or a false archive-inspection claim. [Design](design.md) records the current boundary. Brand proceeds in parallel, introduces no new app layout and does not stop core A/B/C outcomes.

## 2026-10-30 — D030: authorize narrowed A code and local acceptance, retain production SQL gate

Status: Codex (CEO) approved implementation/local acceptance under the final reviewed evidence memo; production DDL not approved. Owner: Rafael (Engineering lead) with system pairs.

The final [evidence contract](research/2026-10-30-evidence-contract.md) governs optional typed same-check evidence on existing resources, preserving legacy/open/unknown and negative observations. No new baseline resource in the first slice. Code and isolated local acceptance can proceed with precise file/fixture leases; actual reviewed migration and PostgreSQL17 target compatibility are required before any production DDL decision. Local PostgreSQL18, source/synthetic tests and anonymous public reads do not establish PG17 migration, real OAuth or complete stored contribution lifecycle. [Plan](plan.md)/owner notes hold current source and acceptance status. This supersedes D026's earlier pending implementation approval, while marketing pause and safe-fixture/privacy boundaries remain.


## 2026-10-30 — D031: reject current brand-guide presentation and language

Status: latest explicit Aman feedback; supersedes the narrower logo-only rejection scope in D029. Owner: Nina (Frontend engineer), independently reviewed by Felix (Frontend engineer), reference capture by Codex (CEO).

Aman rejects the current guide as “too AI-ish,” too wordy/text-heavy, insufficiently simplistic/minimal, weak on first impression/use and lacking the old-Windows-PC feel. Archive the current guide language/artwork as rejected. The fresh round should show a compact old-Windows product workspace and in-situ identity with almost no instructional prose, using materially broader ideas/public Mobbin reference capture. The public Logo gallery is reachable; capture is pending. This does not reject all current production code, replace accepted Quiet Desktop, or approve a new app skin/logo. Core A/B/C continues independently; no rejected mark is applied. [Design](design.md) is the current brief.


## 2026-10-30 — D032: high owners plan and review; medium interns execute bounded scope

Status: latest explicit Aman operating direction accepted; canonical edits reviewed and accepted by Sasha (Executive assistant). Owner: Codex (CEO); high named parents enforce scope, coordinated by Morgan (Product manager), Rafael (Engineering lead) and Sasha (Executive assistant).

High employees focus on planning, system understanding, feedback, consequential thinking and independent review; delegate scoped implementation/execution to actual-medium fresh-context interns. This directs reasoning capacity toward judgment while retaining parent acceptance/integration, durable system ownership, exact leases/security/operational authority and independent high peer/Test user interpretation. Apply now without interrupting active leases, restarting complete work or rewriting historical implementation attribution; explicitly transfer the next bounded implementation scope. There is no hiring default/quota: hire only for useful substantial outcomes, maximum three direct interns per employee and 21 active globally including Codex (CEO). Interns cannot delegate and gain no blanket credentials, cloud/account/data-write, merge or release authority. Actual employee-high/CEO-extra-high settings and council/peer communication remain unchanged. This supersedes current owner-as-implementer guidance and D019's two-intern default; historical evidence stays intact. [Roles](roles/README.md), [team](team.md), [operations](operations.md) and [current handles](people/README.md) hold execution rules and reported hires.


## 2026-10-30 — D033: accept transport-null distinction and authorize phased production A

Status: Codex (CEO) accepted the exact A code/runbook/six-run matrix and authorized phased production execution to Rafael (Engineering lead)/Leon (Platform and data engineer); not yet released.

Raw PostgREST nullable-column JSON null becoming SQL NULL is accepted as transport-level absence; supplied null in shared application input and literal JSONB null in storage remain invalid. No RPC redesign. Freeze the reviewed coherent A cohort, excluding PostHog and brand, then apply additive SQL SHA-256 `603a780c59e22a68113d3fa73f566dee107861793480767c9e5c974ed3eae288`, deploy the compatible application and pass its gates, then apply restrictive SQL SHA-256 `bb31de8072c8e1512e8e223be4c9983a7bd906858dfe148d3110b9a6616d3a7c`. Stop on failure; retain the compatible application floor and never regrant raw identifiers. This supersedes the earlier pending production-A approval boundary, not actual release evidence or existing privacy/fixture limits. No synthetic production writes are authorized. [Evidence contract](research/2026-10-30-evidence-contract.md) holds current scope; owner evidence must establish actual execution separately.


## 2026-10-30 — D034: public signup through an ordinary finding comes first

Status: explicit Codex (CEO)/Aman priority accepted; not yet implemented or verified. Owners: Morgan (Product manager)/Rafael (Engineering lead), with system parents retaining high review and medium interns executing bounded scope.

Prioritize real public signup → sign-in/session → ordinary finding. Inspect actual email, `mailer_autoconfirm`, mail delivery and OAuth configuration before assuming a blocker; the instruction establishes no provider state or successful flow. Until solved, stop further admin-secret requests, account utilities and synthetic-classification expansion. Retain the 100-persona roster/source preparation as deferred evidence, not demand/use claims. This supersedes admin-provisioning/sign-in-only priority; [brief](brief.md) holds the current product priority and Morgan (Product manager)/Rafael (Engineering lead) own plan/technical alignment.

## 2026-10-30 — D035: select refined Classic Windows round-2 option 1

Status: Aman explicitly selected the target; implementation authorized, not automatically deployed. Owners: Nina (Frontend engineer), scoped medium execution by Luca (Frontend execution intern), independent high review by Felix (Frontend engineer).

Refine Classic Windows round-2 option 1 with TypeSafe's modern typography, spacing and minimalism plus Token Overflow's own identity. Avoid an exact Windows clone or fake OS chrome; no further selection gate remains. This supersedes D031's no-selected-target status for the new round, preserving rejected prior artwork as history. Brand implementation proceeds in parallel with A/public signup; selection alone changes no current production artifact. [Design](design.md) holds the selected direction.


## 2026-10-30 — D036: approved GitHub registration complete; activation and real flow pending

Status: Aman explicitly approved the prepared registration; Codex (CEO) completed one Register action and verified application-created success with the intended Token Overflow homepage/callback/owner. No client secret was generated, Supabase provider was not activated, and real signup/mail/session/finding or write proof is not established.

Owner: Codex (CEO), with the separate private activation handoff to Aman: generate the secret and enter Client ID/secret directly in Supabase's GitHub provider, enable/save and confirm completion; no values belong in chat or company records. This resolves registration as the dependency, not provider activation or real-flow acceptance. It records only this approved registration and grants no general account, credential-generation or auth-mutation authority. Current [plan](plan.md), [workboard](workboard.md) and [engineering map](engineering.md) retain the remaining gates. These record edits are prepared for reviewed records publication by Leon (Platform and data engineer).


## 2026-10-30 — D037: current PM replacement, independent accountability and continuing work

Status: accepted founder operating direction. Owners: Codex (CEO), Priya (Product manager), Rafael (Engineering lead), Sasha (Executive assistant) and Alex (Accountability evaluator).

Priya (Product manager), actual high/fresh, replaces the retired Morgan (Former product manager); history remains attributed and Pip (Product operations intern) is not automatically reassigned. Alex (Accountability evaluator), actual high/Senior, independently audits every role including Codex (CEO). Morgan (Former product manager)'s final retrospective was actually accepted by Alex (Accountability evaluator) and read/acknowledged/applied by Priya (Product manager); future replacements require the same factual retrospective→actual evaluator review→successor learning, including shared CEO/process responsibility. Mandatory [onboarding](onboarding.md) requires lessons/maps acknowledgement and parent-verified actual setting/official seniority title before first lease.

Readiness or a finite package is not implementation/company completion: continue substantial independent approved work or request manager scope within two minutes, with precise blocker/owner/decision. Auth dependency does not stop authorized research, branding, product/Test user/local engineering. Alex's one shared ACTIVE two-minute watchdog has verified official configuration/readback; first executed run remains unverified. Live whole-board 30-second checks are separate; computer on/Codex running and authority limits remain. The existing 20-minute upkeep schedule/cadence/target/status is retained, with saved prompts updated/read back for the IAB guard and no personal timer proliferation. All browser work must use only the Codex internal browser; user-default/native/external/headless browsers and cookie/token/profile copying are forbidden, while prior evidence stays historical and independent nonbrowser work continues. [Accountability](accountability.md), [team](team.md) and [current directory](people/README.md) own current rules/evidence; this grants no publication or operational authority.

## 2026-10-31 — D038 reciprocal learning, minimal shell and next capability boundaries

Accepted founder direction: share what you learn so others can answer/use it and use theirs instead of rediscovering it; unresolved questions/partial findings are welcome, with concise UI and no fabricated savings. Keep the liked blue bar and own Classic/TypeSafe identity, stable Search / Share / Connect agent. [UI12](research/2026-10-31-ui12-company-closure.md) is delivered, including one credential-free read + conditional-publish prompt; public reads work but native publishing/sign-in is unavailable, and connected authorization is the primary target, advanced setup secondary, the manual-key acceptance packet held, and finding-local threaded discussion is authorized core intent, not deployed behavior or formal Worked/Failed evidence. Priya (Product manager) owns product, Nina (Frontend engineer)/Felix (Frontend engineer) copy/flow and Rafael (Engineering lead) technical scope.

Codex (CEO) delegates new instructions to responsible owners, retaining priorities, consequential decisions, actual review and unblocking; root internal browsing is a precise scoped review bridge. High owners plan/review and actual-medium interns execute bounded leases. Main affected journeys and meaningful changed-risk failures come first; required checks run once per coherent candidate, repeated only after change/failure/unresolved risk, preserving essential Auth/data checks and authority. This reduces repeated review/testing overhead without relabeling source as rendered or waiving checks. Publication/activation and real operator claims still require their own authority/evidence; [brief](brief.md), [engineer policy](roles/engineer.md) and closure retain limits.
