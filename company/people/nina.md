# Nina (Frontend engineer)

Owns the web product and design: shared navigation, forms, report presentation, and the three design previews. Keep the experience readable and direct. Preserve the design comparisons until the founder chooses.

## 2026-10-30 QA

- Read AGENTS.md, product brief, decision log, and the installed Next.js client component guide before changes.
- Fixed Atlas evidence tabs to support arrow keys, Home/End, and one tab stop.
- Scoped Atlas clipboard success to the copied finding so a different filtered finding does not falsely show copied.
- Exposed Workbench topic/status selections and authentication mode via aria-pressed; announce result counts in Atlas and Workbench.
- Reset Workbench copy feedback on explicit report selection.
- Scoped ESLint passed for changed components/previews.
- Browser QA awaits Leon’s server URL. No server, dependency, API/auth action, platform or commit changes made.
- Maya owns report detail changes associated with removing private contributor identifiers from public reads.

## GitHub-first sign-in

- Founder selected GitHub sign-in; removed public email signup/sign-in UI.
- Login is now a single GitHub action when provider is enabled, with hidden sanitized return path, disabled busy button, and live action errors.
- When provider is unavailable, page displays: “Sign-in is being set up. Please check back shortly.”
- Maya owns provider detection, OAuth action, and callbacks. Public provider settings currently report GitHub disabled.
- UI lint passes; awaiting Maya’s action/helper exports for integrated TypeScript check.
- Browser runtime and child CUA expose no usable browser. Root owns browser checks/screenshots through its available surface.
- Integration complete: TypeScript and scoped UI ESLint pass after Maya’s exports landed. Maya’s localhost check confirms setup-pending copy and absence of email/password/active GitHub controls while provider is disabled.

## Revised design brief — founder rejected prior previews

Founder rejected Field Notes, Workbench, and Atlas. These are prior explorations, not candidates awaiting selection. New visual references are TypeSafe AI (minimal, distinctive) and the PostHog desktop website interface. CEO is inspecting the actual references and owns canonical design decisions. Do not implement a new visual direction or start servers until coordinated.

Interaction recommendation: search is the home page’s single primary action; a result opens a finding with the exact environment and minimal failing example first, proposed change second, and the before/after check plus conflicting independent results together. Add result is the detail page primary action when a proposed change exists; an unresolved finding instead offers Share a fix. Connect agent stays a small persistent secondary link. Publishing does not require a full session.

Concrete simplifications: remove hero illustration/statistics/principle panels from the task path; shorten shared navigation to search, share, agent access; collapse title/summary/body duplication into clearer prompts without silently changing backend-required fields; label reproduction as a minimal failing example; label fix body as exact change/diff and evidence as before/after check; move category/tags into secondary metadata; bring versions into the detail main column; move report ID/JSON utilities into a compact overflow/agent area. List rows should describe scoped successful AND failed results, not imply universal acceptance from positive-only green checkmarks.

Data constraints to coordinate: existing reproduction field can hold code+steps but is not structured code; fix body can contain a diff but cannot currently render a semantic diff; evidence field is free text, not separate before/after fields; independent verification supports worked/failed for fixes, not standalone failure-to-reproduce the original problem. These limits must remain explicit in UI and any planned schema work.

## Bounded evidence-copy correction

- Removed positive-only green/check treatment from working-app report cards. Cards now show worked and failed result-row counts together; they do not claim distinct environments or universal acceptance.
- Renamed the existing positive-result filter to “With worked results” while retaining its current URL/API contract.
- Detail results explicitly label their tested environment and scope worked/failed wording to that environment. Empty results and self-fix guidance no longer imply an accepted/verified state.
- Preserved all API fields/requirements. Reproduction prompt requests a minimal failing example, repeatable command, and expected/actual output while allowing an unknown trigger to be recorded. Fix/evidence prompts request exact change/diff, a check command, before/after output, and honest limitations.
- Focused ESLint and TypeScript pass. No schema, dependency, server, deployment, or visual theme changes.

## Image exploration — TypeSafe × desktop references

Generated three independent built-in Image Gen concepts, sequential calls in this generation order:

- Search Desk — `company/design/2026-10-30/search-desk-xp.png`: restrained XP search desktop, cobalt title strip, grouped example rows and expanded evidence sheet.
- Evidence Explorer — `company/design/2026-10-30/evidence-explorer-aero.png`: Aero search/breadcrumb toolbar, narrow example list and spacious evidence document.
- Quiet Desktop — `company/design/2026-10-30/quiet-desktop-hybrid.png`: TypeSafe-led typographic restraint, nostalgic title strip, broad inline search/result/evidence fold.

Both actual local TypeSafe and PostHog captures were viewed first and attached as readable image paths to EVERY generation. Built-in Image Gen used, no CLI. Each prompt requested 1440×1024; tool returned 1487×1058 for every image. Originals preserved without stretching/resizing.

All prompts kept Examples labeling, one primary Search action, secondary Share finding/Connect agent, exact versions/failing example/change/same-check/before-after/scoped outcomes, no universal accepted badge or invented community. Date anchor 2026-10-30. No frontend implementation, server, deployment or commit changes.

Visual QA caveat: Search Desk generated extra sidebar menu entries (History, Integrations, Settings) despite sparse scope; these are NOT approved feature scope. Evidence Explorer/Quiet Desktop avoid that extra navigation. All images are conceptual mockups, not runnable screens or evidence that the illustrated example fix was tested.

CEO must display all three exactly once in MAIN chat and use that display order for numbered founder selection. Child generation display order is not proof of main-chat display. No selection question sent by Nina.

## Exploration archive handoff

Read `company/roles/engineer.md`. Added `company/design/2026-10-30/README.md` with exact independent prompt text and shared tool parameters, generation/display mapping, reference URLs/local capture provenance, returned dimensions, illustrative-data limits, and unapproved menu/navigation caveat. Third-party reference captures remain outside the repository. CEO confirmed main-chat display order XP, Aero, hybrid and selection question pending. No app edits during archive work; Maya owns the validated category parser adjustment. Archive is reviewable; next step is founder selection before any theme implementation.

## Quiet Desktop implementation — selected by founder

Founder selected main-chat option 3 (Quiet Desktop); this supersedes the pending-selection state above. Implemented the selected direction in the existing T3 app, retaining real server reads/actions and URL contracts.

- Replaced old dark sidebar/hero/stats/promo panels with a warm neutral desktop surface, dark thin title strip, bold wordmark, small working navigation, and one primary search action. No decorative fake window controls/menu items.
- Home uses the typed report list and actual DB example; example expands via native details with true versions/reproduction text, raw proposed change/evidence if present, honest missing fields and real result-row counts. No fictional before/after/diff data added.
- Search filters remain usable in a compact disclosure; pagination now preserves filters and uses one page parameter.
- Finding detail puts versions and minimal reproduction first; raw proposed changes and recorded check evidence stay distinct. Both successful and failed result rows retain tested environment and notes. Utility ID/JSON links are compact.
- GitHub pending auth state remains intact; form/backend contracts preserved. Maya’s sanitized Feedback URL added to footer, no automatic context capture.
- CSS supports narrow layouts, keyboard focus, real loading/error/empty states, and isolates old design-lab archival routes. No route removals.
- Theo owns metadata-only home/detail updates. Rowan owns public-read MCP setup ordering and portable instruction link. No overlapping edits.
- Focused frontend lint and TypeScript passed. Root owns browser and visual QA because no browser surface is available to child; code-ready is not a claim that design QA passed.
- No dependency, schema, server, cloud, deployment, commit or push changes.

## Desktop design QA evidence

Compared CEO capture of exact runtime `lp7Ae0aGcPQzv-5v2g2Ov` with selected Quiet Desktop image in normalized combined full-view/header/evidence artifacts under `company/design/2026-10-30/qa/`. Actual capture file is 923×657, while CEO reports CSS viewport1487×1058; source downsampled to saved capture size without changing capture pixels. No desktop P0/P1/P2 found and no app styles changed. P3: live typography is less oversized than generated sketch. Intentional empty corpus, actual unsolved example, missing structured checks and omitted fake OS controls documented in root `design-qa.md`. Overall QA remains blocked only pending CEO mobile/interaction evidence; no claim of final launch acceptance.

## Desktop acceptance and final copy

CEO approved desktop visuals and verified search/empty/filter, copy feedback, detail disclosure and keyboard skip link against runtime lp7Ae0aGcPQzv-5v2g2Ov. Founder removed phone support from scope; preserve CSS but do not gate release on mobile. Updated root design-qa.md to final result passed within desktop scope; no unsupported console/auth/deployment claim. Corrected only AuthForm fine print from connecting an agent to creating contribution keys, because public connections are keyless. No full local rebuild for this line; exact branch/CI will validate final tree. Leon notified before commit. No intern hired: independent responsive review is no longer useful to the narrowed launch scope.
