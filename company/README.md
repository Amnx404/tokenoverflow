# Token Overflow — company record

The short, inspectable record of what we are building, why, what we have learned, and what still needs a decision. This repository is public. Do not put credentials, private conversations, customer data, account details, or raw agent sessions here.

- [Brief](brief.md): the problem, audience, and current product boundary.
- [Design brief](design.md): current visual direction, interaction principles, references, and selection status.
- [Engineering map](engineering.md): current architecture, boundaries, verified behavior, and unresolved engineering choices.
- [Decision log](decision-log.md): choices and reasons; append revisions rather than erase history.
- [Discussions](discussions.md): material user direction and open questions, summarized accurately.
- [Progress](progress.md): shipped work, verification, limitations, and next actions.
- [Operations](operations.md): configured heartbeat, free log triage, incident boundaries and genuine operator evidence.
- [People](people/README.md): current named owner handoffs and CEO staffing registry.
- [Team](team.md): responsibilities, delegation, and reasoning guidance.
- [Onboarding](onboarding.md): mandatory learnings, acknowledgements and continuation before new leases.
- [Accountability](accountability.md): Alex (Accountability evaluator) audits all roles, including Codex (CEO).
- [Roles](roles/README.md): required CEO, engineering and research operating behavior, blockers, throughput and handoffs.
- [Workboard](workboard.md): current owners, status, and next evidence.
- [Delivery plan](plan.md): substantial core-MVP packages, peer review, dependencies and independent Test user acceptance.
- [Incentives](incentives.md): the contribution model and what we will test.
- [Research](research/): dated evidence and competitor notes with source links.

Current governance: Priya (Product manager) owns plan/workboard; Alex (Accountability evaluator) independently evaluates every role including Codex (CEO). Morgan (Former product manager)'s actual retrospective was reviewed by Alex (Accountability evaluator) and read/acknowledged/applied by Priya (Product manager); preserve historical authorship and shared CEO/process responsibility. No Pip (Product operations intern) reassignment is implied.

The coordinator owns this record. Researchers supply evidence; implementation agents deliver bounded changes. Important product choices come back to the founder as concrete options. Routine reversible implementation choices are delegated.

## How the record is used

Start each task with this index, the role definition, the workboard, the relevant brief/map, and the owner's handoff note. Check linked decisions before implementing. The founder's latest explicit direction supersedes earlier plans.

Every new hire and role replacement must read the relevant lessons/current maps and acknowledge the concrete applied learning in their own note before the first lease. Parents verify actual reasoning and the supported official `Name (Role) · Seniority` title; Alex (Accountability evaluator) audits breaches. Current staff apply the same learning at the next substantive handoff before a new lease, without interrupting active work. A finite task is not company completion: if approved independent work remains, continue a substantial next step or request Priya (Product manager)/Rafael (Engineering lead) scope within two minutes; report a true blocker with owner/decision instead of busywork. See [required learnings](onboarding.md#required-learnings) and [accountability](accountability.md); first watchdog execution and other staff acknowledgements are not presumed.

Use one canonical home for each kind of information:

- Current requirements: brief, design, and engineering map. Link to decision IDs instead of copying their history.
- Why a choice was made: decision log. Include date, status, reason, owner, consequences, and evidence where material; append a superseding decision when direction changes.
- Material founder feedback: discussions. Summarize accurately; link it to the resulting decision.
- External evidence and experiments: dated research memos with sources and stated uncertainty.
- What actually works: verification. Progress and workboard summarize it and link back.
- Handoffs: named owner notes with files changed, checks, limitations, and the next action.

At a meaningful change or handoff, the owner updates their note and evidence; the CEO reconciles current requirements, workboard, and decisions. Before a release, verify that current behavior and these records agree. Record consequential work rather than every command or raw conversation. Rejected ideas remain historical and must not be silently revived.

Current state: first-visit UI and telemetry are deployed at [tokenoverflow.app](https://tokenoverflow.app), main `572d982a8dabf8e870cef132b832750537f9ecc3`, tree `bf237c2df967e373eed9d78e3fb0fb6688425202`, READY production `dpl_9TANDxzdkiwQxGfEcTz7giQ8PNYh`. Public signup/sign-in UI, neutral public names, accepted Classic/TypeSafe styling, lean reads and agent first-read hierarchy remain included; the earlier [first-visit UI evidence](research/2026-10-30-first-visit-release.md)/[signup capture](research/ux-review/live-signup-classic.jpg) stays bound to 1f29. The [bounded telemetry acceptance](research/2026-10-30-posthog-observability.md) closes synthetic server readback and six stored-unclassified but known Codex (CEO) QA browser events;13 extra internal reads are unattributed, never people/adoption or a root/build-cause claim. Completed A storage/privacy and compatible rollback floor remain; no old C/3c48 SELECT-star rollback/raw-ID regrant. Aman-approved GitHub OAuth application registration is complete, with no client secret generated; Supabase provider activation remains pending, and actual signup/mail/session/ordinary finding and full MVP/adoption remain unverified; [auth setup limits](research/2026-10-30-public-signup-mail.md) remain separate. Marketing is paused. Leon (Platform and data engineer) owns exact-manifest Git publication; [plan](plan.md), [progress](progress.md), [operations](operations.md) and current owner records hold scope. Dated memos and owner notes retain as-of evidence; this current production summary supersedes earlier capture-off/pending references. Release pointers identify the verified application/telemetry cohort; later records-only Git heads and automatic deployments may advance with unchanged runtime source.

Historical public replay publication: records-only main `8b0b406fe2d976d98ea535a2524627c34bbaa412`, tree `27d167b6bfadfdb7ad01c4bfc8b401728b2f0147`, contains the exact five reviewed reader/provenance files; Leon (Platform and data engineer) verified raw public bytes. Runtime source remains the application release `1f29a28055925955e2f0d1f6019e6af7962ec816`; the records-only automatic deployment `dpl_EiFEqRJybgRD5gqm6rKbGP49eNoM` is READY on the canonical alias, with runtime bytes unchanged. Reviewed selected company records are prepared for Leon (Platform and data engineer)'s exact CI/publication; no new founder/content-selection gate is implied.
