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
- [Roles](roles/README.md): required CEO, engineering and research operating behavior, blockers, throughput and handoffs.
- [Workboard](workboard.md): current owners, status, and next evidence.
- [Delivery plan](plan.md): substantial core-MVP packages, peer review, dependencies and independent Test user acceptance.
- [Incentives](incentives.md): the contribution model and what we will test.
- [Research](research/): dated evidence and competitor notes with source links.

The coordinator owns this record. Researchers supply evidence; implementation agents deliver bounded changes. Important product choices come back to the founder as concrete options. Routine reversible implementation choices are delegated.

## How the record is used

Start each task with this index, the role definition, the workboard, the relevant brief/map, and the owner's handoff note. Check linked decisions before implementing. The founder's latest explicit direction supersedes earlier plans.

Use one canonical home for each kind of information:

- Current requirements: brief, design, and engineering map. Link to decision IDs instead of copying their history.
- Why a choice was made: decision log. Include date, status, reason, owner, consequences, and evidence where material; append a superseding decision when direction changes.
- Material founder feedback: discussions. Summarize accurately; link it to the resulting decision.
- External evidence and experiments: dated research memos with sources and stated uncertainty.
- What actually works: verification. Progress and workboard summarize it and link back.
- Handoffs: named owner notes with files changed, checks, limitations, and the next action.

At a meaningful change or handoff, the owner updates their note and evidence; the CEO reconciles current requirements, workboard, and decisions. Before a release, verify that current behavior and these records agree. Record consequential work rather than every command or raw conversation. Rejected ideas remain historical and must not be silently revived.

Current state: the first-visit cohort is LIVE at [tokenoverflow.app](https://tokenoverflow.app), application release commit `1f29a28055925955e2f0d1f6019e6af7962ec816`, tree `5bfd12aab8953fa3296f147a06d81b118d5c54bd`, READY production `dpl_DorznuD1AnpfQr6qFMjcXMoqq281`: public signup/sign-in UI, neutral public-name attribution, accepted Classic/TypeSafe styling, lean reads and agent first-read hierarchy. Codex (CEO) verified the canonical signup viewport with all three fields, CTA and mode link visible at 1280×720; see [release evidence](research/2026-10-30-first-visit-release.md) and [capture](research/ux-review/live-signup-classic.jpg). This compatible descendant retains the completed A storage/privacy floor; old C/3c48 SELECT-star rollback and raw-identifier regrant remain unsupported. Actual signup/mail/session/ordinary finding, GitHub OAuth and full MVP/adoption remain unverified; GitHub is unconfigured pending owner registration confirmation. [Auth memo](research/2026-10-30-public-signup-mail.md) preserves the narrow invalid-token redirect observation and remaining owner setup action. PostHog is excluded; marketing remains paused. Company-memory publication is requested, with exact public manifest/privacy review pending and Leon (Platform and data engineer) owning Git publication. [Plan](plan.md), [progress](progress.md), [verification](verification.md), [design](design.md) and [operations](operations.md) hold scope and limits.

Public replay publication: records-only main `8b0b406fe2d976d98ea535a2524627c34bbaa412`, tree `27d167b6bfadfdb7ad01c4bfc8b401728b2f0147`, contains the exact five reviewed reader/provenance files; Leon (Platform and data engineer) verified raw public bytes. Runtime source remains the application release `1f29a28055925955e2f0d1f6019e6af7962ec816`; the records-only automatic deployment `dpl_EiFEqRJybgRD5gqm6rKbGP49eNoM` is READY on the canonical alias, with runtime bytes unchanged. Broader company-memory publication still awaits the exact reviewed frozen manifest.
