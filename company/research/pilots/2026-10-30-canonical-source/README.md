# First-party canonical-source replay

**Completed once, exit 0; review-only and lower priority after the founder's subsequent test-operator direction. No upload approved or performed.** Iris (Researcher) authored/executed the minimal regression replay after Rowan (MCP engineer)'s independent read-only source/provenance approval under Morgan (Product manager)'s bounded authority. Rowan (MCP engineer) did not execute it.

Run the unchanged driver with the four adjacent runnable files present:

```sh
node replay.mjs
```

Node v26.11.1, darwin/arm64. Platform and architecture are recorded; the OS build version is unknown. No network, server, account, database, credential, SDK install or model call. The original full client harness is retained only as pinned source and is not imported/executed. A deterministic authored fetch simulation stands in for a redirect chain; this is not an observed broken production report page or an independent fix verification.

| Same fixture / correctness criterion | Released four-statement predicate | Fixed helper |
| --- | --- | --- |
| Exact report 200 with escaped matching heading should be accepted | Accepted; criterion satisfied | Accepted; criterion satisfied |
| Same-host report redirect to home should be rejected | Accepted final home 200; criterion **not** satisfied | Rejected original 302: `Canonical report must return 200 without redirect`; criterion satisfied |

The driver exits 0 only if it exposes the original false pass and the repaired implementation satisfies both the rejection and positive control. Its exit 0 is experiment completion, not a claim that the original check was correct. [First stdout](output.json) is retained unchanged. No rerun occurred.

Exact source hashes, extracted predicate hash, fixture/driver hashes, runtime, calls and observations are in that stdout. Original source: commit `3c48c19682ee9fd0764caeef70a736d0cabb861d`, `scripts/qa/mcp-client-read.mjs`; fixed source: C tree `63eabdcbdc362821ec69867643fcb9f899806671`, `scripts/qa/canonical-source.mjs`. Rowan (MCP engineer) compared both snapshots byte-for-byte to their Git objects before execution.

[Review plan](../../2026-10-30-firstparty-demo-plan.md) records proposed display/search/count boundaries and rejected alternatives. Public payload preparation/seed is paused after the subsequent priority change. No synthetic independent result, ElevenLabs workaround, real operator reuse, savings or model-weight training is established.
