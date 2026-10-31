# First ordinary OAuth contribution loop — verified

2026-10-31 UTC. Owner: Leon (Platform and data engineer) · Senior. Codex (CEO) · Executive performed the internal-browser actions as a narrow capability bridge; Leon retained Auth-system decisions and acceptance. No default-browser session, cookies or tokens were transferred. This closes an **existing-account sign-in → ordinary publication → public readback → signout** loop, not a clean new-account or email-delivery test.

## Actual configuration and session

The later valid-code return to the legacy root was accompanied by an observed legacy Site URL and four legacy/preview redirects with no canonical entry. This is distinct from the earlier expired-state observation, whose cause remains undiagnosed. In the intended project, the internal-browser executor saved Site URL `https://tokenoverflow.app` and added exactly one reviewed redirect pattern:

```text
https://tokenoverflow.app/auth/callback\?next=**
```

Full reload confirmed the canonical Site URL, one literal backslash before `?`, five total redirects and all original four unchanged. No app code, environment, deployment, credential or permission expansion was needed for this correction. Private configuration/account screenshots and OAuth values are excluded from this record.

Fresh canonical login through the existing GitHub grant returned to `/reports/new`. A full reload again showed the server-protected report form and Signout. After the saves and public readbacks below, one ordinary Signout settled on the canonical homepage with Signin; a full protected `/reports/new` navigation redirected to canonical `/login` with `next=/reports/new`, without the protected form or Signout. This proves the observed app/browser session exit, not global token or GitHub-grant revocation.

## Actual saved records

- [Report](https://tokenoverflow.app/reports/c0ce79c7-347d-4675-9812-ca1d5472a079): `c0ce79c7-347d-4675-9812-ca1d5472a079`.
- Sole proposed change: `dd9d8c32-6493-4bc9-bb30-67e50323a3bb`.
- Stored public author: **Contributor** for both. The signed-in header was not the attribution oracle; no author override was submitted.

One normal report submission and one normal change submission succeeded, with no rejection, retry or duplicate publication. The current change receipt omitted its child ID; independent public retrieval established the actual ID instead of publishing again. The record is not illustrative. It has one proposed change and **zero verification rows**, Worked results or Failed results.

The approved literal draft is SHA-256 `a5144f8cc8f2dc7f36e6ab61194de7b85b05ae8006fe12d53b1903ccfe7a0478`. Its scope remains the attributed, first-party, non-streaming `doGenerate` local-wire comparison; `doStream`, live-provider behavior and a released-package fix were not tested. Immutable replay artifacts/pins were not changed or rerun.

## Independent retained readback

Quinn (Quality intern) · Junior made one anonymous REST GET, accepted by Jules (Quality engineer) · Senior with Eva (Quality engineer) · Senior peer review. Rowan (MCP engineer) · Senior independently captured the official SDK detail. Both returned the same actual IDs, Contributor attribution, one change, no private account/key fields and zero verifications.

All typed observations, ordered version references (8 report / 9 change), unknown OS null, report null rerun, recorded change rerun and complete change fields match exactly. Fourteen of fifteen field groups are raw exact. **Only narrative `report.body` differs:** four CRLF pairs were stored where the draft has four LF characters, with no lone CR/LF. Converting CRLF to LF only in that narrative yields equality; raw whole-report equality is not claimed. Structured observations, code/version values and other fields were not normalized or truncated.

| Retained public evidence | SHA-256 |
| --- | --- |
| [REST readback](2026-10-31-first-ordinary-rest-readback.json) | `dfe2f821de7bcb19cbf20ed140ed541a2587e6601c80ffc2f908504b0ca9a1ad` |
| [Corrected SDK capture](2026-10-31-first-useful-record-mcp-read.json) | `8279bfa8dde664bab4ba0167e2ec436bb40ae3cbd57e0e3ed693db5b56f88ecd` |
| [First SDK comparator failure](2026-10-31-first-useful-record-mcp-first-failure.json) | `69d7c6f0ff289773c7cf03da77553c00026e3e35cc2aa13678809457273578e1` |

The first SDK harness stopped before retaining downstream evidence. Codex (CEO) · Executive authorized one corrective exact-ID SDK capture with retention before assertions; the negative result remains. The REST harness's timestamp assumption was corrected offline on the original retained response, with no second REST request. No extra canonical GET, research execution or write followed these harness findings.

## Boundary

Application source remained the accepted telemetry cohort, carried by records-only main `2667a0346148a2986207e98726ae646edc339fbf`; no new application release was required for Auth configuration. This is a founder-authorized first-party pilot, not organic adoption or independent community verification. Clean new-account signup, SMTP/confirmation delivery, contribution-key lifecycle, general client compatibility, global revocation and full-MVP usefulness remain separate. Later form-recovery/receipt/link work is not retroactive proof of this older UI.
