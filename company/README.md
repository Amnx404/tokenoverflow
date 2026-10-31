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

Current state: founder selected Quiet Desktop (option 3); Nina (Frontend engineer) implemented it. Candidate `hHffqdwXgeoNURxkhUmuu` built 22 routes with TypeScript passing on actual Drizzle; local health 200. Prior desktop/design QA passed; Codex (CEO) desktop interaction acceptance remains ongoing. Corrected artifact passed Jules (Quality engineer) bounded 5/5 postpatch gate; phone support is outside scope. Public browsing/MCP first is authorized while GitHub sign-in remains setup-pending. The ACTIVE 20-minute upkeep heartbeat is configured, with local computer/app requirements. Branch/PR/CI/preview and canonical production verification remain pending; no launch claim. See [progress](progress.md), [verification](verification.md) and [operations](operations.md).
