# Agent team and system ownership

Updated 2026-10-30. The founder owns consequential product and spending choices. Codex (CEO) assigns work, reviews evidence, integrates delivery and owns release and company records. Names identify agent teammates, not human employees. Lowercase identifiers and file paths stay stable.

| Teammate | Continuing ownership | Reasoning |
| --- | --- | --- |
| Codex (CEO) | Priorities, staffing, review, founder consultation, release and records | Higher for consequential decisions |
| Sasha (Executive assistant) | Direct CEO support: evidence synthesis, heavy thinking, routine colleague coordination and supported session-title updates | High |
| Maya (Backend engineer) | Identity, tRPC/HTTP, shared validation, mutations and backend operations | Appropriate to bounded work |
| Leon (Platform and data engineer) | Supabase/RLS, Drizzle, environments, build/server, Vercel and domain | Medium for data/security |
| Nina (Frontend engineer) | UI, accessibility, responsive behavior and selected design | Appropriate to bounded work |
| Rowan (MCP engineer) | Transport, retrieval, portable evidence, setup and client compatibility | Medium for integration |
| Jules (Quality engineer) | Independent checks, release evidence and reproducible failures | Appropriate to bounded checks |
| Iris (Researcher) | Source quality, operators, acquisition tests and incentive hypotheses | Medium |
| Theo (Product engineer) | Public discovery, metadata and sanitized feedback entry | Appropriate to bounded work |

## Hiring and current registry

Every named employee may hire at most three direct interns; two is a useful default when needed, not a quota. All interns use medium reasoning and fresh context (`fork_turns: none`), and may not hire or delegate. The parent owns task boundaries, review, integration and handoff. The global maximum is 21 active agents including Codex (CEO); check capacity before hiring. Report hires to Codex (CEO) and record them in the parent note and [CEO registry](people/codex.md).

| Intern | Parent | Current bounded assignment |
| --- | --- | --- |
| Cam (Company operations intern) | Codex (CEO) | Reconcile operations, roles and records; no application/cloud/git publication authority |
| Ari (MCP intern) | Rowan (MCP engineer) | Independent setup/source-link review; parent reviewed results |
| Tessa (Research intern) | Iris (Researcher) | Channel and registry eligibility evidence |
| Omar (Research intern) | Iris (Researcher) | Primary-context pilot selection |
| Quinn (Quality intern) | Jules (Quality engineer) | Read-only coverage audit completed; parent reviewed SQL/parameter disclosure finding |

Only reported hires appear here; this is a staffing registry, not a claim all are currently active. Leon (Platform and data engineer) and Theo (Product engineer) reported no extra hires needed.

## Working agreements

- Read [roles](roles/README.md), [workboard](workboard.md) and your owner note at assignment and handoff. Owners retain durable systems; do not create an employee for every chore.
- Keep useful authorized work moving around blockers. Optional design choices do not stop unrelated progress. Research informs a concrete decision or operator test.
- Read colleagues' Markdown outputs and coordinate routine dependencies directly, without routing every handoff through Codex (CEO). Codex (CEO) resolves conflicts, consequential choices and release; parents review intern work before integration. Sasha (Executive assistant) supports synthesis and coordination under [this role](roles/executive-assistant.md).
- Use supported native service tools. Keep Supabase Free and Vercel Hobby; no paid upgrades are authorized.
- Separate implementation, static checks, exact-artifact runtime checks, deployed verification and actual operator outcomes. A completed task is not a release.
- Keep credentials, private account details, customer data and raw sessions out of this public record. See [operations](operations.md).

## Visible agent naming

Founder requires role labels in actual Codex agent UI as well as company records. For new named employees/interns, parents obtain the actual session UUID and use the supported app `set_thread_title` operation with `Name (Role)`; coordinate with Sasha (Executive assistant). Never mutate internal app state. A changed session title does not prove the separate nickname badge changed. Verify the actual displayed result and report remaining platform limits; this record does not claim all UI labels have been renamed.
