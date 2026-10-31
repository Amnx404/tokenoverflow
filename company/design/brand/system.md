# Token Overflow — archived rejected brand system

Owner: Felix (Frontend engineer), paired with Nina (Frontend engineer). Updated 2026-10-30. Reviewable implementation: `/brand-guide`, source `app/brand-guide/`. Artwork, independent prompts, reference inputs and exports: [brand package](README.md), owned by Nina (Frontend engineer).

## Status and purpose

**Rejected archive:** the founder rejected the entire round-one guide language and all three marks: Relay, Proof Tab and Open Loop. The conventions and artwork below are historical, superseded proposals, not current brand guidance or candidates awaiting selection. The production application remains Quiet Desktop until a separately reviewed release; this archive does not select any round-one mark.

The founder subsequently selected **round-two classic option 1 for implementation with a TypeSafe-inspired modern refinement (D035)**; see the separate [round-two record](round-2/README.md). This supersedes its previous none-selected status, while retaining round-one rejection. The selected refinement uses a cool reading canvas, silver controls, navy actions, restrained teal context and the installed Geist wordmark; it does not approve literal OS window controls, a Start menu, clocks or a taskbar. Source implementation and runtime/visual verification remain separate. Original round-one language, source links and exports remain below for provenance only.

## Identity and asset rules

Nina (Frontend engineer) owns three original Image Gen explorations and exact asset/provenance inventory in README. All three were rejected. Do not infer a selected mark from gallery order, the superseded recommendation or export filename. Existing production wordmark stays intact. The archive preserves all three with rejected status and links to full-resolution originals.

Current raster exports are intended for light surfaces; no reversed/one-color production master is delivered. Subtle raster/alpha variation remains in generated artwork. For eventual selected identity: retain at least one mark-stroke of clear space; preserve aspect ratio; keep mark and wordmark separable. Use one-color ink on paper, indigo on surface, or a reversed paper mark on the title-strip color. A logo is identity, not a checkmark certifying an evidence outcome. Avoid imitating competitor symbol geometry, brands or Microsoft's OS assets. No unearned trademark-registration claim or legal-clearance claim.

Application export contract: 16/32px favicon; 180px touch/app icon; 512px high-resolution square; 1200×630 social/share card. Inspect tiny exports directly for recognizable silhouette, transparent-edge halos and lost internal detail. Independent PNG generation is exploration, not automatically an editable vector master; any vector redraw requires fidelity/small-size review. Preserve raw generated originals, prompts and source references; do not resave the sole master destructively. No selected-logo production metadata change is authorized by this guide alone.

## Historical color roles

| Role / local token | Value | Application |
| --- | --- | --- |
| Paper / `--paper` | `#efeee9` | Page canvas; existing global `--bg` |
| Surface / `--surface` | `#faf9f6` | Inputs, evidence and raised content |
| Ink / `--ink` | `#17181c` | Primary text; existing `--text` |
| Muted / `--muted` | `#5d5e66` | Supporting prose and utility text |
| Rule / `--rule` | `#b3b2ad` | Decorative separators, never sole control boundary |
| Indigo / `--indigo` | `#303f7d` | Primary action and focus; existing `--accent` |
| Selection / `--selection` | `#dfe2f3` | Expanded/selected background; existing `--accent-dim` |
| Worked / `--positive` | `#246144` | Existing scoped positive-result text |
| Failed / `--negative` | `#9e2f42` | Existing scoped negative-result text |
| Control boundary | `#797a7d` | Input and neutral button boundary |
| Title strip | `#24252c` | Existing desktop identity strip |

Calculated sRGB relative-luminance contrast, not a full accessibility certification: Ink/Paper **15.27:1**, Muted/Paper **5.55:1**, Indigo/Surface **9.35:1**, white/Indigo **9.85:1**, Worked/Surface **6.95:1**, Failed/Surface **6.79:1**, Indigo/Selection **7.65:1**, Control boundary/Surface **4.08:1**. Decorative Rule/Paper is **1.83:1**: do not use that color alone for focus, input boundaries or necessary nontext indicators. Values assume opaque flat colors; inherited opacity, imagery and actual rendering require separate review.

Color always has a text counterpart. Worked and Failed remain environmental observations. Indigo means an action or selected context, not evidence quality. The white-on-Indigo primary button is a guide-only proposal; the live product currently uses a pale-indigo primary treatment. This guide does not claim those controls have already been migrated. Disabled opacity is permitted only for actually disabled controls, accompanied by an explanatory state when the capability is unavailable.

## Historical typography

Use existing Geist Sans and Geist Mono; no new font service/dependency. Sans carries titles, task names and human explanations. Mono carries exact versions, commands, identifiers and short utility labels. Wordmark: current heavy sans, tight tracking; no generated raster text substituted for accessible product text.

| Role | Desktop size / line-height | Weight and purpose |
| --- | --- | --- |
| Display | 48–64px / 1.05 | 700–750, one dominant page introduction or identity |
| Page/finding title | 28–36px / 1.2 | 600, readable wrapping for long titles |
| Section | 16–20px / 1.4 | 500–600, task/evidence organization |
| Body | 14–15px / 1.6 | 400, 60–80 character reading measure |
| Evidence/code | 12–13px / 1.8 | Mono 400, preserve whitespace and wrap long content |
| Utility | 12–13px / 1.6 | Short labels, versions and dates |

The guide deliberately uses a larger editorial introduction. It is not a request to enlarge all production text. Exact evidence must remain selectable text, never clipped to make a card look tidy; do not truncate commands, versions or negative results behind decorative ellipses. Any truncated summary needs a real detail link.

## Historical rhythm, geometry and density

Proposed 4px base scale: **4, 8, 12, 16, 24, 32, 48, 64**. Use 8–12px inside related controls, 16–24px inside evidence groups and 32–48px between tasks. Desktop canvas retains current maximum 1600px and 5% gutters. Keep explanatory prose at 60–80 characters; evidence can span the available workspace. Use two evidence columns only where both remain readable; simple flow fallback is a guard against overflow, not a phone acceptance claim.

Square surfaces, 1px rules and a restrained bevel on neutral tactile controls. No heavy shadows, floating card stacks or pill-shaped everything. A general control in the guide is at least 42px tall; production search retains its broader existing size. These values are a reusable proposal, not a wholesale spacing migration. Preserve the existing search/detail hierarchy and defer optional visual changes to Nina (Frontend engineer)'s reviewed batch.

## Historical icons and interaction semantics

Use installed Lucide, consistent 2px stroke: 16px utilities, 20–24px main search. Meanings: magnifier search, arrow continuation, copy clipboard, terminal agent access, external-link external source, circle-alert problem. Pair with visible labels; icon-only controls require an accessible name. Decorative icons are hidden from assistive technology. Avoid global-check/award icons beside findings. Missing outcome data is not failure or success.

Links navigate; buttons act; native details/summary disclose; real labels name inputs. Focus: 2px Indigo outline with 4px offset on controls; retain the global skip link. Current-state filter links use current-state attributes; specimen state toggles use `aria-pressed`. Do not create a fake tab interface without its keyboard model. Copy feedback must communicate failure and scope success to the correct content. Motion may support a pending state but never be its only signal; this guide uses static loading icon plus text.

## Historical component and state contract

| Situation | Visible treatment | Required behavior |
| --- | --- | --- |
| Primary action | Indigo fill, white text | One primary action per task region; real action name |
| Secondary action | Paper/surface, dark boundary, restrained bevel | Real alternate action; preserve task context |
| Focus | Visible indigo outline | Keyboard-visible on links, fields, buttons, disclosures |
| Pending submission | Disabled submit and progress wording | Prevent duplicates, retain entered values, live outcome message |
| Input error | Named field, dark red boundary + linked message | State the actionable correction; associate with `aria-describedby` |
| True empty search | No matching findings + useful recovery | Preserve query/filter distinction; do not imply server failure |
| Empty requested page | Positive total + no items on this page | First-page recovery preserving search/filter/corpus context |
| Loading | Loading text, polite live region | Do not show a false zero-results conclusion |
| Read error | Plain failure + retry | Preserve query; never mask as no findings |
| Auth unavailable | Setup-pending text | Public reads remain usable; do not offer a fake active login |
| Copy failed | Select/copy fallback guidance | No false Copied success |
| No evidence | Not recorded / unknown / no established change | Do not fabricate check commands, versions or before/after results |

`specimens.tsx` demonstrates state selection and local search feedback without calling an API or publishing data. Retry switches the demonstration to Loading; it does not claim recovery. All demonstration content is explicitly labeled. The guide's existing root layout retains the application's auth read; no extra service reads or mutations were introduced by the guide.

## Historical evidence presentation and voice

Order: **versions/environment → minimal failing example → observed behavior → proposed change → recorded check/evidence → environment-scoped independent results**. Preserve mixed successful/failed rows together. Counts count result submissions, not unique environments or independent external adoption. Raw prose is not structured before/after output. Inability to reproduce the baseline is different from a failed proposed fix; no third outcome exists in the current schema.

Say “Worked in this environment,” “No independent results recorded,” “Exact version not recorded,” and “Sign-in is being set up.” Avoid “verified fix,” “accepted solution,” “trusted by developers,” fabricated popularity or a successful-outcome claim supplied by the visual template. Share cards carry identity, finding title and honest content type, not invented endorsements, contributor details or sensitive content. Use short labels and direct recovery copy; keep explanations out of the primary search path.

## Historical verification and integration boundary

Felix (Frontend engineer) read installed Next.js pages/components/CSS guidance before authoring. Guide uses a local CSS module, existing fonts/icons, no dependencies or global styles, no production header/logo/favicon/OG changes. Page is noindex/nofollow and absent from production navigation. Preview artwork may be public if the route is deployed; review metadata is not access control.

Source checks: focused ESLint and whole-tree TypeScript `--noEmit --incremental false` passed before final artwork wiring; repeat focused checks on final files at handoff. Existing dev3000 `/brand-guide` HTTP200/noindex/three candidate panels and honest demo/evidence content were verified. Browser creation explicitly failed with `Browser is not available: iab`; no rendered-page screenshot or interaction claim is made by Felix (Frontend engineer). Nina (Frontend engineer) source-reviewed the system and requested the guide-only primary-button clarification, now incorporated. Final gallery was peer-reviewed by Nina (Frontend engineer) as recorded in README; final artwork wiring passed focused lint, TypeScript and HTTP asset reads. Actual rendered-page visual review remains a separate gate. Tests/visual review substantiate this guide only, not provider readiness, launch, production deployment, phone behavior or the substantive correctness of the illustrative evidence.


## Historical independent artwork review — Felix (Frontend engineer)

Viewed all three actual light-background lockup review PNGs and each direct 16px/32px icon file. Relay and Proof Tab use compact grotesk letterforms close to the current identity; Open Loop deliberately uses a squarer, more mechanical wordmark. All displayed lockups spell `tokenoverflow`. Their symbols remain distinct: linked open frames, file-tab/channel and open frame with detached accent. This is a visual differentiation review, not trademark clearance.

**Superseded recommendation — all three marks subsequently rejected:** Open Loop has the clearest 16px silhouette; its open corner and isolated accent survive reduction most legibly. Relay is strongest for continuity with the existing large typographic header and the evidence-handoff idea, but its wide paired symbol becomes less legible at 16px. Proof Tab carries the most literal desktop/file association, with a dense inner channel that is harder to distinguish at tiny size. If choosing primarily for favicon recognition, prefer Open Loop; if choosing primarily for the current wordmark relationship, compare Relay at normal header size. The subsequent founder rejection supersedes this recommendation; none remains awaiting selection.

All supplied 16px marks have little painted area against transparent space, so actual browser-tab placement deserves direct inspection rather than inferring legibility from a large board. No generated wordmark has been installed as production text or presented as an editable font/vector master. Exact source prompts and four attached reference paths per direction live in the artwork JSON files under this directory.

Artwork README, three archived exact prompt JSONs, manifest and reference tokens read at final paired handoff. The guide includes direct downloads for all three 180px icon/1200×630 identity-share candidates and `/brand/tokens.css`. No reversed/one-color variant, editable vector or legal-clearance claim is implied.
