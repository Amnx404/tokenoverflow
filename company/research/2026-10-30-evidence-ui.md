# A frontend independent review — 2026-10-30

Owner: Felix (Frontend engineer), `/root/sasha/felix_high`. Primary implementation: Nina (Frontend engineer), `/root/sasha/nina_high`. Status: actual source review and focused component server-render checks passed; Nina (Frontend engineer) independently read the actual harness and accepted its coverage/limits without repeating tests. Source/component pair review closed; stored and browser acceptance remain pending. Local implementation authority does not include production DDL, bundle forwarding or publication.

Read the final [evidence contract](2026-10-30-evidence-contract.md), existing/changed forms, focused fields/record/CSS, detail page, Maya (Backend engineer)'s actual action serializer and types. Installed Next.js server/client and forms guides were read before work. Exact test command: `node scripts/qa/evidence-ui.mjs`; focused ESLint passed. Tested renderer SHA-256: `15b98a816c6521ac5e60613bf79c924f042913cd421cb78529f4c696eb0369ab`.

## Resolved review findings

1. The report editor originally labeled its baseline as “Before the change,” although reports contain no fixing rerun. Nina (Frontend engineer) changed it to “Baseline observation.” Updated source read confirms the fix.
2. A legitimate empty-output observation originally displayed “No output recorded,” which could imply missing evidence. Nina (Frontend engineer) changed it to “Recorded output is empty.” Actual rendering confirms that distinction and retains exit code 0 without declaring success.

No material unresolved issue was found in this bounded source/component review. Field names match the landed serializer. Opt-out omits the bundle; report after-result is null; fix after-result follows the explicit rerun switch; verification supplies both observations; unknown version maps to null; blank exit input is omitted and `0` becomes numeric zero. Legacy prose requirements remain separate. Each actual detail result retains outcome, environment and notes plus its own evidence component. Both worked/failed arrays are rendered; no positive filter or global accepted-answer state was added.

## Focused exact-source rendering

The harness loads the actual evidence component through the installed TypeScript compiler and renders it with React DOM. It stubs CSS imports only. All examples are isolated in memory; no records were stored or made public.

| Case | Observed result |
| --- | --- |
| Absent/null legacy bundle | States that structured check is missing, points to original notes, invents no observations or versions. |
| Report baseline | Labels an open investigation and baseline; no fixing after-result, rerun warning or same-check pair is manufactured. |
| Proposed fix, null after-result | Explicitly states rerun not recorded and change still proposed; supplied unknown version remains unknown. |
| Whitespace, empty output, exit 0 | Preserves exact whitespace in the rendered preformatted text; distinguishes whitespace-only and intentionally empty observations; renders both zero exit codes without a pass claim. |
| Conflicting scoped results | Both supplied comparisons retain their exact commands, baseline/after output and version conditions; the negative `NaN` observation remains present beside success. The fixture wrapper supplies the outcome/environment headings; actual detail-page wiring was reviewed separately. |
| Untrusted text/private extra field | Check/output/version markup is escaped as text, without links or active tags; an unexpected private sentinel property is not projected by this component. This does not certify the broader API privacy boundary. |

## Casey (Test user) challenge and remaining acceptance

Casey (Test user) directly challenged this review: no identifiable expected-versus-observed baseline/check, confusion between an exact proposed change and a performed rerun, or missing conditions on an applicable Failed observation prevents a justified next-action explanation. Counts cannot replace those conditions. A complete typed bundle is unnecessary for a narrower evidence-collection step, provided explicit unknowns remain and the collection names the uncertainty and decision it could change. Her actual old example justified collecting a sanitized failing request plus model/SDK/voice/language settings; it supplied no runnable check or causal rejection. This informed the resolved labels and acceptance cases; it is not a new executed user test or demonstrated usefulness.

Component rendering and source inspection do not prove CSS layout, hydrated opt-in/version/rerun controls, keyboard behavior, clipboard, a real authenticated submission, stored roundtrip, full route rendering, REST/MCP parity, production behavior or genuine debugging reuse. No server, network, database, account, cloud, deployment or contributed-code execution occurred. Rafael (Engineering lead) must supply the exact fixture-bound artifact and approved isolated populated record for full-chain acceptance; Codex (CEO)'s desktop surface and Casey (Test user)'s changed-artifact task remain separate gates. No repeated C/brand checks were performed. Latest founder rejection of all three old logo directions remains in force; no mark was applied.
