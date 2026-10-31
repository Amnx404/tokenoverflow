# Brand foundation — Quiet Desktop

Owners: Nina (Frontend engineer), paired with Felix (Frontend engineer). Date: 2026-10-30. Reviewable guide: `/brand-guide` (source (unselected/deferred evidence omitted from this publication)); visual/state rules: [system.md](system.md); reusable [tokens.css](tokens.css), also served from `/brand/tokens.css`. This is a substantial review package, not a production identity rollout.

## Decision status

Quiet Desktop is the founder-selected **current production layout**. **Round-one decision: the entire prior brand-guide design language and all three logo directions below are rejected.** Preserve their originals and provenance as a historical round; none may be applied. Codex (CEO) confirmed the earlier guide's desktop interactions and main-chat display of the actual three artworks before this rejection. That review is not logo selection. The founder subsequently selected **classic option 1 for implementation with a TypeSafe-inspired modern refinement (D035)**, rather than an exact OS replica or any rejected mark. Nina (Frontend engineer) and Felix (Frontend engineer) reviewed the selected source package. The [round-two record](round-2/README.md) preserves actual main-chat display order, references, exact prompts/originals/corrections and the refinement boundary. A separate actual visual artifact and desktop review remain pending before deployment; source review is not visual acceptance. The live header, favicon and metadata identity remain unchanged; no trademark clearance or production rollout is implied.

The prior recommendation of Open Loop for tiny-symbol clarity was a team review opinion, superseded by the founder's rejection. Direction rationale and technical limitations below document the historical output, not the next round's brief.

| Generation order | Direction / rationale | Trade-off | Review artwork |
| --- | --- | --- | --- |
| First | Relay: offset frames joined by a violet bridge; an observation handed onward. Compact grotesk wordmark feels closest to the current header. | The wide symbol is weaker at 16px; can read as a chain/link abstraction. | [relay-review.png](relay-review.png) |
| Second | Proof Tab: distinctive tab/document silhouette with a quiet negative-space t. | Denser internal channel and generic document associations; the direction name is not a claim of proof or certification. | [proof-tab-review.png](proof-tab-review.png) |
| Third | Open Loop: open investigation, clear continuation point, precise mono wordmark. | More technical/rounded terminal voice; open-square symbol requires consistent clearspace to remain distinctive. | [open-loop-review.png](open-loop-review.png) |

Main-chat numbers must follow the CEO's actual displayed-image order, not this generation-order table. Child tool display is not proof of main-chat display.

## Artwork and reusable exports

Each candidate has transparent generated master artwork, a trimmed lockup, separable wordmark and symbol, and icon candidates at **16, 32, 64, 128, 180 and 512px**. Identity-only **1200×630** share candidates are also supplied; these carry no invented finding, verdict, users or results. They are not wired into Open Graph metadata. Future finding-specific share cards must use an actual title and honest content type after identity selection.

Public paths share prefix `/brand/directions/`:

| Candidate | Lockup | Symbol / wordmark | Icon and share filename pattern |
| --- | --- | --- | --- |
| Relay | `relay.png` | `relay-symbol.png`, `relay-wordmark.png` | `relay-icon-{size}.png`, `relay-share-1200x630.png` |
| Proof Tab | `proof-tab.png` | `proof-tab-symbol.png`, `proof-tab-wordmark.png` | `proof-tab-icon-{size}.png`, `proof-tab-share-1200x630.png` |
| Open Loop | `open-loop.png` | `open-loop-symbol.png`, `open-loop-wordmark.png` | `open-loop-icon-{size}.png`, `open-loop-share-1200x630.png` |

asset-manifest.json (unselected/deferred evidence omitted from this publication) records exact source dimensions, alpha checks, crop bounds and export paths. export-assets.cjs (unselected/deferred evidence omitted from this publication) reproduces packaging with installed Sharp: trims transparent outer padding, extracts the **existing generated** symbol/wordmark, adds clearspace, downsamples icons, composites identity-only share candidates, and copies the reference tokens. It does not draw, vectorize, trace or semantically redesign the logos. Original generated pixels remain untouched in masters/ (unselected/deferred evidence omitted from this publication). Light-background `*-review.png` copies make dark transparent artwork legible in chat. These raster candidates include slight tonal/antialiased edge variation despite the flat-art prompt; do not claim perfect flat vector paths. Supplied dark artwork is intended for light Paper/Surface backgrounds. Reversed/one-color artwork is not delivered yet and must be reviewed after selection rather than achieved by casually inverting a logo. PNG exploration is not an editable vector master; vector production art would need separate fidelity review rather than pretending a raster is SVG.

## Exact generation provenance

Three sequential independent built-in `image_gen.imagegen` calls, no concurrency/batching/CLI fallback. **Every call** received `transparent_background: true` and all four actual local input paths below. Inputs were visually opened before generation; no prompt relied on filenames alone. Each prompt requested **1600×640**; each returned master is **1983×793**, preserved unchanged.

Exact tool inputs are archived verbatim in [relay-generation.json](relay-generation.json), [proof-tab-generation.json](proof-tab-generation.json), and [open-loop-generation.json](open-loop-generation.json). JSON `\n` in quoted code text is escaped prompt data, not a hidden instruction. No shared opaque “style description” substitutes for actual attached files.

Input order and provenance:

1. `../2026-10-30/quiet-desktop-hybrid.png` — founder-selected generated Quiet Desktop screen, 2026-10-30; original [design archive](../2026-10-30/README.md).
2. `../2026-10-30/qa/home-desktop.jpg` — actual app desktop capture from CEO; runtime `lp7Ae0aGcPQzv-5v2g2Ov`, CSS viewport1487×1058, exported923×657; 2026-10-30. It shows the honest empty community and unsolved illustrative example, not users or adoption.
3. `local reference/generated-output path omitted; reference 3` — CEO browser capture on 2026-10-30. Supplied canonical reference [TypeSafe Mobbin preview](https://mobbin.com/sites/typesafe-ai-db9d5271-6163-4cba-bf3a-e31f29b35d2a/68fc1d6f-ebe6-461e-9651-3a60272e8582/preview), actual sections [one](https://mobbin.com/sites/sections/5e931165-f2a3-407f-b336-e75e418fc052), [two](https://mobbin.com/sites/sections/672c4f05-df55-4523-b50a-2bbf0507c64a). Full preview redirected logged out; actual supplied capture was available.
4. `local reference/generated-output path omitted; reference 4` — CEO browser capture of [PostHog](https://posthog.com/) on 2026-10-30.

Third-party source capture pixels are not copied into the repository or public assets. Their role is mood/context, not tracing a logo or reproducing source screenshots. All prompts explicitly prohibit copied TypeSafe, PostHog, Stack Overflow and Microsoft identities.

Generated original local paths:

- Relay: `local reference/generated-output path omitted; reference 5`.
- Proof Tab: `local reference/generated-output path omitted; reference 6`.
- Open Loop: `local reference/generated-output path omitted; reference 7`.

## Cohesive system recommendation

Use the existing warm paper/surface and near-black typography as the foundation. Keep violet a restrained identity/selection accent; indigo identifies action/focus. Preserve meaningful scoped Worked/Failed labels rather than global verification symbols. Geist Sans remains accessible product text; Geist Mono carries exact evidence. Generated logo lettering is artwork, not a new font dependency and not a replacement for selectable evidence text. Use an accessible text label with an eventual logo image.

[system.md](system.md) defines typography, palette/contrast, spacing/density, square surfaces, icon conventions, control/focus/error/pending states, empty/out-of-range/error recovery and evidence/outcome voice. `/brand-guide` provides actual local demo controls and transparent artwork/size specimens; it makes no API writes or live status claims. Strong white-on-indigo buttons are a **proposed guide treatment**; existing pale-indigo product buttons are not silently changed. Reference tokens are downloadable but not globally imported.

## Review and adoption boundary

- Nina (Frontend engineer) viewed all three generated artworks and their light exports. Alpha manifest confirms transparent pixels; none has a solid fake checkerboard background. Exact readable `tokenoverflow` lettering preserved.
- Felix (Frontend engineer) independently viewed the actual three artworks and tiny16/32px exports. He agrees Open Loop is the strongest small symbol; Relay's width and Proof Tab's dense channel are concrete trade-offs.
- Nina reviewed actual system/guide source: explicit candidate status, noindex metadata, familiar controls, scoped evidence/missing states, no production-logo mutation. Guide source lint/typecheck and focused local HTTP asset/read checks are separately recorded by Felix.
- Browser visual/keyboard guide verification still belongs to CEO's available browser; child browser surface is unavailable. Do not claim the guide has passed visual QA solely because HTTP200 or typecheck passed.
- No paid dependencies/services, phone-support work, server ownership, schema/auth changes or deployment by designers.

Next action: review actual desktop before/after captures from the separate selected-refinement artifact, then resolve the release gate with Codex (CEO) before deployment. Preserve the historical production/source distinction and rejected originals. Core A/B/C engineering continues independently; no further reference capture or selection gate is pending for this implementation.

Public provenance note: local machine/reference/output paths in this publication copy are omitted or portable. This is a path-redacted, non-runnable provenance export, not unmodified raw tool arguments; prompt text, results, numbers and recorded artifact hashes are preserved. Third-party reference pixels and unselected original/intermediate outputs are not included merely because they are described.
