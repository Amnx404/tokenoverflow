<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Company memory and ownership

Before project work, read `company/README.md`, `company/roles/README.md`, your role definition, `company/workboard.md`, and your named owner note in `company/people/`. Read `company/brief.md` for product changes, `company/design.md` for UI work, and `company/engineering.md` for architecture/integration work. Follow linked accepted decisions rather than reconstructing direction from old previews or chat fragments.

The founder's latest explicit direction takes precedence. The primary agent coordinates as CEO; named engineers own systems and Iris owns research. See `company/team.md` before assigning work.

Preserve material founder feedback, design and engineering decisions, reasons, source links, verification, limitations, and next actions in the canonical company files. Mark proposals, accepted choices, superseded decisions, implemented work, and verified behavior distinctly. Update the relevant owner note at handoff; the CEO reconciles current state and the decision log. Do not duplicate entire logs across files.

Keep this public record concise and usable. Never record credentials, private account details, raw sessions, customer data, or sensitive tool output. Read the relevant record at the next task; documentation is an input to work, not just an archive.

## Current staffing and intern policy

Display employee names with their role in parentheses in current company records and user-facing staffing updates; preserve stable lowercase identifiers/file paths and historical source quotes. Every named employee may hire at most three direct interns (two by default when useful, never required). All interns use medium reasoning and fresh context (`fork_turns: none`); interns may not hire or delegate. Parents review and integrate work, report hires to Codex (CEO), and respect the global 21-active-agent limit including Codex (CEO). Consult [team](company/team.md), [roles](company/roles/README.md) and [operations](company/operations.md). Keep independent authorized work moving toward real operators and upkeep; optional design selection does not stop unrelated work.

Owners read colleagues' Markdown outputs and coordinate routine dependencies directly; Codex (CEO) handles conflicts, consequential decisions and release. Sasha (Executive assistant) supports high-reasoning synthesis and coordination. On future hires, parents use the actual session UUID and supported app `set_thread_title` with `Name (Role)` for visible session titles; do not mutate internal state or claim a title change proves the separate nickname badge changed. See [executive support](company/roles/executive-assistant.md).
