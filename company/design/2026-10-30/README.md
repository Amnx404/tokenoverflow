# Desktop visual exploration — 2026-10-30

These are proposed image mockups, not approved designs or runnable application screens. Generated sequentially with the built-in `image_gen.imagegen` tool. No frontend theme was implemented. The CEO displayed all three once in the main chat in the order below; founder selection is pending.

| Display and generation order | Concept | Artifact |
| --- | --- | --- |
| First | Search Desk | [search-desk-xp.png](search-desk-xp.png) |
| Second | Evidence Explorer | [evidence-explorer-aero.png](evidence-explorer-aero.png) |
| Third | Quiet Desktop | [quiet-desktop-hybrid.png](quiet-desktop-hybrid.png) |

Every prompt requested **1440 × 1024**. Every returned image is **1487 × 1058**. Files preserve the returned pixels without resizing or stretching. Originals remain in the local generated-images archive.

## Reference provenance

Both actual reference captures were opened visually before generation and attached to **every** image-generation call using the following exact `referenced_image_paths` value:

```json
[
  "/Users/amansa/.codex/design-references/tokenoverflow-2026-10-30/typesafe-live.jpg",
  "/Users/amansa/.codex/design-references/tokenoverflow-2026-10-30/posthog-live.jpg"
]
```

Captured by the CEO through the browser on **2026-10-30**. These third-party captures are local reference material and are not copied into this repository.

- TypeSafe AI supplied canonical reference: https://mobbin.com/sites/typesafe-ai-db9d5271-6163-4cba-bf3a-e31f29b35d2a/68fc1d6f-ebe6-461e-9651-3a60272e8582/preview . CEO inspected actual sections https://mobbin.com/sites/sections/5e931165-f2a3-407f-b336-e75e418fc052 and https://mobbin.com/sites/sections/672c4f05-df55-4523-b50a-2bbf0507c64a ; full preview redirected when logged out.
- PostHog desktop website: https://posthog.com/ . Local capture `posthog-live.jpg` supplies the visible desktop reference.

The references supply inspiration, not permission to clone branding or source assets. The prompt asks for no copied logos, mascots or illustrations.

## Shared parameters and warnings

All calls used `transparent_background: false`, the identical two-element `referenced_image_paths` above, and the exact independent prompt below. `num_last_images_to_include` was omitted. There was one tool call per image, with no concurrent batching, no CLI fallback and no image editing after generation. The outer orchestration used `yield_time_ms: 120000` and `max_output_tokens: 1000`; these do not control image dimensions.

All example findings, code, changes, commands and outcomes are **illustrative design data**, not tested fixes, actual community usage, or verification. In particular, `newKey()` / `operationKey` is an abbreviated visual placeholder, not a complete executable patch. No universal acceptance claim or ElevenLabs workaround is established.

Visual QA: Search Desk generated unsolicited History, Agents, Integrations and Settings sidebar entries and a File/Edit/View/Search/Tools/Help menu. These are **not approved product scope** and should not be inferred as implementation requirements. Evidence Explorer and Quiet Desktop avoid that sidebar. The mockups remain proposals; visible controls are not functional. No mobile layout or accessibility behavior is validated by a bitmap.

## Search Desk — exact prompt

```text
Use case: ui-mockup. Create one realistic production-quality desktop web UI mock image, 1440 x 1024, for Token Overflow. Concept name Search Desk (do not print concept name or option numbers). Actual images attached are moodboard references: first TypeSafe AI for distinctive typographic restraint and retro window details, second PostHog for desktop metaphor. Inspiration only, no copied logos, mascots, website text, or illustrations. This concept is a restrained Windows XP-inspired search-first desktop, creamy gray work surface, subtle muted cobalt title strip and selected-row highlight, small crisp familiar desktop controls, abundant whitespace. Product branding text 'tokenoverflow' understated in upper left. A thin app menu bar and one dominant search field, containing 'timeout retry', with one primary button 'Search'. Small text links 'Share finding' and 'Connect agent', no other prominent calls to action. Show exactly two compact example search rows grouped with thin dividers, labeled collectively 'Examples': 'Retrying a timeout creates a duplicate record' and 'Preview build cannot read an environment variable'. First row selected. Below selected row show a calm lightweight expanded evidence sheet, not nested cards: short title, exact version line 'Node.js 24 · HTTP client 5 s timeout · Example API'. Four concise evidence sections: 'Failing example' code 'await createRecord({ timeout: 5000 })'; 'Exact change' code '- newKey()\n+ operationKey'; 'Same check' code 'npm test -- retry'; 'Before / after' text '2 records → 1 record'. A small outcome line 'Worked: 1 · Failed: 1' and a failed scoped note 'Failed · different key on each retry'. These are explicitly fictional examples, not verified community data. No universal accepted badge, green verification icon, invented users/statistics, or ElevenLabs fixes. Design communicates through hierarchy, familiar window controls, rhythm and spacing, not instructional paragraphs. At most two fonts: readable 14–16px sans UI and monospace code. Strong typography, purposefully sparse, no hero manifesto, feature inventory, metric dashboard, nested cards, excessive badges. One cohesive app surface fills viewport; no device mockup, OS security dialogs or OS/Microsoft branding, no wallpaper scene. Date anchor 2026-10-30 if dates appear. Clear hierarchy and generous whitespace; if crowded remove secondary UI. Render actual finished visual UI, not a diagram or text-only specification.
```

Original local output: `/Users/amansa/.codex/generated_images/01a18f25-da11-7922-ae26-beeedb27cf28/exec-67d313cc-b513-41bc-9aa1-e7b654498120.png`.

## Evidence Explorer — exact prompt

```text
Use case: ui-mockup. Create a single realistic production-quality desktop web app screen for Token Overflow, target 1440 x 1024. Independent concept Evidence Explorer (do not print concept name or option numbers). Both supplied images are actual moodboard references, first TypeSafe AI for spare strong typography and nostalgic tiny window UI, second PostHog for familiar desktop application composition. Do not copy their brands, logos, mascot, illustrations or product text. Windows 7/Aero-inspired evidence browser: restrained translucent icy-blue window header, a hint of glass highlight, slate blue chosen row, warm white document interior, thin separators, subtle beveled controls. A full-frame web app workspace, not a floating card on wallpaper. Small tokenoverflow wordmark upper left, simple back/forward buttons beside an address/breadcrumb control 'Findings / timeout retry'. Top search field has 'timeout retry' and one primary button 'Search'; only two quiet supporting text links 'Share finding' and 'Connect agent'. No left application sidebar or menu inventory. Main workspace split into narrow results column (about one third) and a spacious evidence reading pane (two thirds). Results column heading 'Examples' and exactly two flat rows with simple document icons: 'Retrying a timeout creates a duplicate record', selected; 'Preview cannot read an environment variable'. Reading pane short finding title and readable exact version line 'Node.js 24 · Example API · timeout 5 s'. A continuous document shows short sections with monospace snippets: 'Failing example' 'await createRecord({ timeout: 5000 })'; 'Exact change' a small legible diff '- newKey()\n+ operationKey'; 'Same check' 'npm test -- retry'; 'Before / after' '2 records → 1 record'. Then a compact plain outcome table labeled 'Example results', rows 'Worked | stable operation key' and 'Failed | key regenerated on retry'. Scoped conditions, no universal success badge/checkmark. UI communicates purpose visually; no prose explaining every feature, marketing headline, metrics or dashboard cards. No tabs or filters added for filler, no nested cards, no extra History/Integrations/Settings navigation, no OS logo or security UI. Body type 14–16 px, no more than two fonts, crisp legible evidence, intentional whitespace and understated depth. Date anchor 2026-10-30 if dates used. Fake data explicitly Examples, no invented community verification or ElevenLabs workaround. Render one beautiful finished product UI, not a collage, wireframe or text-only diagram. Preserve generous reading space; omit nonessential elements if crowded.
```

Original local output: `/Users/amansa/.codex/generated_images/01a18f25-da11-7922-ae26-beeedb27cf28/exec-b0dd5d54-7b3e-42b7-9e44-0cf8045f8c58.png`.

## Quiet Desktop — exact prompt

```text
Use case: ui-mockup. Generate ONE independent beautiful production-quality desktop web UI design for Token Overflow, 1440 x 1024 target. Concept Quiet Desktop (do not print name or option number). Attached actual reference captures: TypeSafe AI supplies strong typographic restraint, warm off-white surface, simple black retro title bars; PostHog supplies subtly familiar desktop interaction cues. Inspiration not clone; no copied logos, illustrations, mascots or reference text. This hybrid should be the most minimal, almost monochrome modern interpretation of a nostalgic XP/Windows7 desktop application. Pale warm gray base canvas, a very faint violet-blue wash only near top, tiny black document title strip, precise one-pixel controls and small beveled search button; crisp oversized-but-not-hero 40px product wordmark 'tokenoverflow' at upper left. No sidebar at all. A quiet horizontal header has only small 'Share finding' and 'Connect agent' links. The main screen is search-first: full-width field with 'timeout retry' and the ONLY primary button 'Search'. Below, a narrow line 'Examples', two plain rows separated with rules: selected 'Retrying a timeout creates a duplicate record'; second 'Preview cannot read an environment variable'. Selected row has a small inline expanded continuous evidence document, no boxes/cards around each section. Lay the evidence in two spacious balanced columns: left 'Failing example' monospace 'await createRecord({ timeout: 5000 })', below 'Exact change' diff '- newKey()\n+ operationKey'; right 'Same check' monospace 'npm test -- retry', below 'Before / after' '2 records → 1 record'. Above evidence display exact version line 'Node.js 24 · Example API · timeout 5 s'. Bottom of document two compact scoped result lines 'Worked · stable operation key' and 'Failed · key regenerated on retry', neutral text, small red mark for failure allowed. These are clearly example data, no invented real community counts, no universal acceptance badge/checkmark, no ElevenLabs workaround. Every necessary evidence/version/outcome label legible but no explainer paragraphs or manifesto, no statistics, feature inventory, nested cards, giant teaching labels or gratuitous navigation. No app menus History/Integrations/Settings, no random filters/tabs, no OS-security dialog or OS logo. No wallpaper illustration or simulated monitor. No more than 2 fonts: 14–16px sans UI and monospace code. Different hierarchy from a split-pane explorer: single broad search/results surface with an inline evidence fold. Use generous whitespace, thin separators, strong purposeful typography, restrained depth. A single contained document fold is allowed as the nostalgic reference calls for it, but do not layer cards inside it. Date anchor 2026-10-30 if any dates. UI should communicate subtly through spacing, familiar controls and typographic contrast. Render actual finished visual UI, not a written brief or diagram.
```

Original local output: `/Users/amansa/.codex/generated_images/01a18f25-da11-7922-ae26-beeedb27cf28/exec-99dd72cf-8d7d-4673-adec-0844125164f4.png`.
