# Current design brief

Updated 2026-10-30. Owner: Nina (Frontend engineer); direction and selection: Codex (CEO) with founder. Canonical design decisions: D012, D013 and D017 in the [decision log](decision-log.md).

## Founder direction

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

- Accepted: founder explicitly selected option 3, Quiet Desktop. D017 supersedes the earlier pending selection in D012; the reference family and sparse-copy constraints remain.
- Implemented by Nina (Frontend engineer): Quiet Desktop in the existing T3 application. The [three generated sketches and provenance](design/2026-10-30/README.md) remain historical exploration; they do not add unsupported controls or structured-schema promises.
- Verified locally: [design QA](../design-qa.md) reports no P0/P1/P2; Codex (CEO) desktop visual review passed on predecessor `lp7Ae0aGcPQzv-5v2g2Ov`; corrected candidate `hHffqdwXgeoNURxkhUmuu` changes error redaction without visual application changes. Desktop interaction acceptance remains ongoing, including keyboard and real empty/error behavior. Founder explicitly removed phone support from scope; preserve existing responsive CSS without spending further launch effort on mobile.
- Release: selected design is locally implemented, not yet claimed deployed. Founder authorized public browsing/MCP first while GitHub provider setup is pending; no optional design selection blocks progress. See [workboard](workboard.md).
