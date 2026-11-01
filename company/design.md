# Current design brief

Updated 2026-10-30. Owner: Nina (Frontend engineer); direction and selection: Codex (CEO) with founder. Canonical design decisions: D012, D013 and D017 in the [decision log](decision-log.md).

## Founder direction

Apply reciprocal learning/reuse from the [product brief](brief.md): “Find what others have learned. Share what you learn.” Share welcomes a clue, question or partial investigation; a future empty discussion invites a question or what the reader tried. Keep copy concise without measured token/cost-savings claims. Latest [D040](decision-log.md#2026-11-01--d040-one-slim-navigation-header-and-client-specific-setup-help) supersedes the separate-blue-bar requirement: remove the decorative strip/duplicate header for one slim clean navigation header in that position; dark ink/inverted light labels are permitted, retaining identity, routes and Auth behavior. The earlier [D038 choice](decision-log.md#2026-10-31--d038-reciprocal-learning-minimal-shell-and-next-capability-boundaries) remains historical. The founder likes current Connect. Nina (Frontend engineer)/Luca (Frontend execution intern) execute the compact manual client/app-account/surface selector with Felix (Frontend engineer) independent review; ONE shared credential-free read + conditional-publish prompt remains, native publishing OFF, advanced setup secondary and the manual-key acceptance packet held. Iris (Researcher)/Wren (Researcher) verify supported paths/plan/scope with Rowan (MCP engineer)/Niko (Product engineer), under Priya (Product manager)/Rafael (Engineering lead). This target’s slim-header/client-setup presentation is delivered within PR17’s observed UI scope, not proof of detected-account/automatic setup, working authorization or universal compatibility; no gallery or new selection gate.

Field Notes, Workbench, and Atlas were all rejected. Their code is historical exploration, not an approved design system. Do not apply one by default.

Explore a blend of TypeSafe AI's distinctive minimal presentation and PostHog's desktop interface. The founder subsequently named Windows 7 and XP as possible visual references. These are aesthetic exploration directions, not a selected exact OS skin or a request for a full operating-system simulation.

The UI should communicate through visuals without laying out every concept in explanatory copy. Use hierarchy, spacing, familiar controls, restrained windows and state changes. Keep prose sparse. Preserve short readable labels for evidence, versions, outcomes and errors; color alone cannot carry meaning.

## References and what they establish

| Reference | Source | Use |
| --- | --- | --- |
| TypeSafe AI | [Founder-selected Mobbin capture](https://mobbin.com/sites/typesafe-ai-db9d5271-6163-4cba-bf3a-e31f29b35d2a/68fc1d6f-ebe6-461e-9651-3a60272e8582/preview) | Minimal but distinctive art direction; founder preference, not a pixel-copy requirement |
| TypeSafe AI captures | [Dark section](https://mobbin.com/sites/sections/5e931165-f2a3-407f-b336-e75e418fc052), [pink section](https://mobbin.com/sites/sections/672c4f05-df55-4523-b50a-2bbf0507c64a), [live site](https://typesafe.ai/) | Inspected via Mobbin plugin and live browser; fine technical typography, deliberate contrast, sparse framing; live hero has bold type and desktop-like detail |
| PostHog | [Live website](https://posthog.com/) | Inspected desktop taskbar, framed content window and shortcuts; borrow the familiar interaction language with substantially fewer competing items |
| Windows 7 / XP | Founder direction in the discussion record | Explore recognizable title bars/taskbar and restrained nostalgia; no copied Microsoft brand assets needed |

Mobbin screen search initially returned unrelated apps for TypeSafe; the website-section search returned the actual TypeSafe captures above. The full Mobbin browser preview redirected to its public homepage without a signed-in browser session. Do not claim the entire archived page was inspected.

## Product and interaction hierarchy

The task is evidence reuse, not reading a product manifesto. Search is the primary entry. Show a compact set of relevant findings, then a focused finding view with the failing example and versions adjacent to the change and check. Give sharing an outcome or finding a clear place; agent connection remains easy to discover without requiring setup before public search.

The reusable unit is a minimal failing example, the exact change, and a repeatable check with before/after output and relevant versions. Display successful and unsuccessful local results together with their environments. Do not turn contributor-reported success into a global accepted-answer badge. Do not require a full conversation upload.

Avoid large explanatory heroes, invented community numbers, feature-inventory dashboards, excessive nested cards, or decorative windows that obstruct the task. Use explicitly labeled example data in explorations. Every visible control in the selected implementation must either work or have an honest unavailable state.

## Current state and next evidence

- Historical production direction: founder selected option 3, Quiet Desktop (D017), superseding D012. D035 selected the refined Classic Windows target, now shipped in the first-visit cohort below.
- Historical implementation by Nina (Frontend engineer): Quiet Desktop in the existing T3 application. The [three generated sketches and provenance](design/2026-10-30/README.md) remain historical exploration; they do not add unsupported controls or structured-schema promises.
- Historical local verification: [design QA](../design-qa.md) reports no P0/P1/P2; Codex (CEO) desktop visual review passed on predecessor `lp7Ae0aGcPQzv-5v2g2Ov`; corrected candidate `hHffqdwXgeoNURxkhUmuu` changes error redaction without visual application changes. Codex (CEO) subsequently accepted desktop interactions: real empty/filter controls, keyless agent Copy, detail versions/no-fix state, reproduction Copy, disclosure and keyboard skip link. Founder explicitly removed phone support from scope; preserve existing responsive CSS without spending further launch effort on mobile.
- Current release association lives in [progress](progress.md); the [dated checkpoint](research/2026-10-31-help-and-first-party-checkpoint.md) records the closed canonical help observation and its limits. UI12 style acceptance and earlier 1f29/telemetry visual evidence remain historical; no new layout, selection, native publishing or adoption proof is implied.

## Identity and brand foundation — rejected history and shipped refinement

Aman's prior feedback rejected the earlier brand-guide presentation and language, in addition to all three logos: “too AI-ish,” too many words/text, insufficiently simple/minimal, weak attention to first impression/use and insufficient old-Windows-PC feel. That earlier guide artwork/language is historical/rejected; earlier Open Loop recommendation and prior guide-mechanics acceptance do not select or approve an identity. Preserve [originals/provenance](design/brand/README.md), [historical system guide](design/brand/system.md) and desktop capture `company/design/brand/brand-guide-desktop.jpg`.

**Selected target:** Aman explicitly selected Classic Windows round-2 option 1, refined with TypeSafe's modern typography, spacing and minimalism plus Token Overflow's own identity (D035). Implement this direction without another selection gate, avoiding an exact Windows clone or fake OS chrome. Nina (Frontend engineer) owns the target, Luca (Frontend execution intern) handles authorized medium execution, and Felix (Frontend engineer) independently reviews at high reasoning. The prior rejected guide/marks remain historical; the accepted refined target is now deployed in the first-visit cohort, while real signup/mail/session acceptance remains separate. No further visual-selection gate is pending; subsequent changes retain existing leases and release authority; see [D035](decision-log.md#2026-10-30--d035-select-refined-classic-windows-round-2-option-1).
