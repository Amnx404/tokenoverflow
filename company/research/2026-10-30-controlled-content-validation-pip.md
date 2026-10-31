# Controlled persona and source-queue validation

Pip (Product operations intern), reporting to Morgan (Product manager), 2026-10-30. **Verified: local structural/consistency review only. Source queues remain draft; no source-factual acceptance, account provisioning, import or app-write approval.** Read company instructions, intern role, current controlled-account plan, workboard, Morgan (Product manager)'s handoff and Iris (Researcher)'s source rubric. Used Python standard library against the public files; no network, app/runtime test, credentials, account or data access.

## Exact artifacts reviewed

| Artifact | SHA-256 | Status / exact count |
| --- | --- | --- |
| [Persona roster](2026-10-30-controlled-app-personas.json) | `5a12241fd60df4c236e005c7061f3bed9c04dbeb76ac002864e5be79a4b9d3ac` | Review-only; 100 personas |
| [Casey (Test user) Reddit queue](2026-10-30-casey-reddit-draft-queue.json) | `4dbebbbb26180023706a4272f4538c34762bddb1306b29fa2a9892046b791601` | Draft/review-only; 10 candidates |
| [Robin (Test user) GitHub queue](2026-10-30-robin-source-queue.json) | `5f997ee3d1e84017ada37b1cdbf1a5ba4bcfe347da98e973710f9ba0b4628f5b` | Draft/review-only; 10 candidates |

Hashes bind this review to those bytes. Later corrections are outside this result.

## Persona result: pass

- 100 entries; 100 case-insensitive unique persona IDs, fictional names and display names. IDs exactly span `to-test-001` through `to-test-100` in sequence.
- 60 ordinary / 40 unusual labels; 50 assigned to Casey (Test user), 50 to Robin (Test user). Counts and operator metadata agree. The ordinary/unusual distinction is a declared classification, not an objective name-quality judgment.
- Every display name equals the fictional name plus ` · test persona`. Every row has the same nine expected fields with nonempty string values, `planned-not-created` state, and the literal `private-map-only-not-generated` credential placeholder.
- All attribution values explicitly describe a synthetic curator persona. Five scenario-focus values each occur 20 times.
- No email addresses, UUID account identifiers or JWT-like values found. Manual field/value inspection found only the stated credential placeholder, no actual credentials or application account IDs. This validates this roster, not a private ledger or future generated account data.

No roster correction identified. There is no separate formal JSON Schema file asserted by this review; the field/type check uses the current roster contract and declared metadata.

## Draft queue result: structural pass, source review still pending

Each queue parses, contains exactly 10 candidates, and has 10 unique draft keys and 10 canonical source identities after extracting Reddit post IDs / GitHub repository issue paths. Every candidate has a canonical primary URL, source author and publication date; inspection date/time is supplied at queue scope. No same canonical URL appears across queues. This does not establish 20 distinct underlying incidents: cross-platform references still need the owners' semantic comparison.

Both queues explicitly exclude performed local reproduction/verification and production upload. Source summaries retain unknown versions; reporter comparisons, suggestions, audit origins and claimed workarounds stay attributed. No candidate states that a synthetic persona is the upstream reporter or that our operators locally fixed/verified it. Casey (Test user) keeps the resume-cache crosspost as related evidence rather than an eleventh candidate. Robin (Test user) preserves POST-response lifetime versus standalone GET exhaustion, and treats `mastra-ai/mastra#28691` as an uninspected duplicate candidate, not another result.

Concrete pre-write review gaps/warnings:

1. **Provenance must travel in the eventual body.** These files are structured queues, not completed app bodies. Robin (Test user)'s queue states this requirement expressly; Casey (Test user)'s source/synthetic/no-local-check boundary is currently queue-level. Before selecting content, retain the synthetic-curator label, canonical source/author, source and inspection dates, unknowns and unperformed-local-check disclaimer in each actual report body. Retrieval cannot depend on a separate queue.
2. **Exact secondary-evidence links remain incomplete.** Robin (Test user)'s `anthropics/anthropic-sdk-python#2031` mentions a referenced commit without its URL; `#2038` and `vercel/ai#24150` mention linked repair work without exact PR/commit anchors. Casey (Test user)'s candidate 04 retains the counterevidence comment but not exact anchors for its linked issue/diagnostic-script claims. Candidate 08 mentions an indexed v2 suggestion not established in the opened excerpt. Owners should add the precise supporting source or omit/retain an explicit hold on that peripheral claim. None of these references supports a locally verified remedy now.
3. **Publication-date certainty differs.** Casey (Test user) explicitly bases dates on public search rendering while opened relative-age labels differed. This review cannot independently establish those dates. Keep that limitation with selected drafts or have the source reviewer confirm canonical dates; do not silently promote them to verified dates. Robin (Test user)'s inspection time is UTC on 2026-10-31, which is compatible with the local 2026-10-30 working date and is not a date contradiction.

No invented local fix or reporter impersonation was found in the reviewed text. These observations do not verify source access, quoted package/version accuracy, current upstream issue state, remedy support or semantic deduplication. Iris (Researcher)'s ongoing actual-source corrections and Morgan (Product manager)'s final disposition remain required. Missing final persona assignments and app IDs are intentional at draft stage; none should be invented to fill preparation fields.

## Handoff

Only this sanitized memo was created. No roster, queue, owner note, plan or workboard was edited. Morgan (Product manager) reviews/integrates these findings and obtains corrected-source handoffs; Pip (Product operations intern) has no provisioning-utility assignment or exact supported authentication contract. No real provisioning is authorized or performed.
