# Public email signup and sign-in — implementation handoff

Implemented locally by Toby (Backend implementation intern), direct report of Maya (Backend engineer). Maya (Backend engineer) retains acceptance; Arjun (Backend engineer) independently reviews backend and Felix (Frontend engineer) reviews UI. This package supersedes the earlier existing-signin-only implementation idea. No release, provider-configuration change or real signup is claimed.

## Implemented scope

- `/signup` provides public email registration and a sign-in link; `/login` provides existing email/password sign-in and a signup link. Both preserve sanitized `next`. GitHub appears first only when enabled; when disabled, its setup status and public-reading prose are omitted so the available email form appears directly. Signup has explicit noindex/nofollow metadata. Existing style classes are reused. The email form has an accessible form label and the page retains the only heading. Signup has optional “Public display name” (80-character bound), with “Shown with your public findings.” The only existing shared-form change remains the authorized one-line GitHub-specific setup wording.
- Additive `signUpWithEmail` / `signInWithEmail` server actions use the existing SSR `serverClient`. Email is string-only, trimmed and Zod-email validated. Password must be a nonempty string and is never trimmed, normalized, logged or echoed; no speculative provider password policy is added. File values are rejected. Action state carries only fixed error/notice text, never provider details or credentials. Signup forwards only `options.data:{display_name}` plus its existing email redirect: missing/blank names become `Contributor`, trimmed nonblank names up to 80 characters are accepted, and File/oversize names get fixed helpful guidance.
- Signup without a returned session shows: “If this address can be registered, check your email for a confirmation link.” It does not assert account existence, delivery or sign-in. Immediate-session signup and password sign-in require fresh `getUser` before success. Success revalidates layout and redirects outside the catch to an absolute approved-origin URL. Exact recognized provider error codes `user_already_exists` and `email_exists` return that same neutral confirmation object without fresh-user, revalidation or redirect calls. Exact `weak_password` errors get fixed stronger-password guidance; exact `over_email_send_rate_limit` and `over_request_rate_limit` errors get fixed wait guidance. All other provider failures retain fixed generic failure copy; raw message text is never used as a classifier.
- PKCE callback and email/signup token-hash confirmation require successful SDK session results, fail safely on thrown/reported provider errors, use canonical configured origin, preserve sanitized next on retry, and return no-store redirects. Confirmation accepts only `email` and `signup`, not recovery/invite/magiclink. Raw query error text is never rendered, including when GitHub is disabled.

- Identity-derived public contribution attribution now uses trimmed explicit string display metadata capped at the existing 80-character bound, or `Contributor` for missing/blank/nonstring metadata. It never derives a name from email. Caller author spoofing remains overridden; identity guards, byte limits, SQL writers/RLS boundaries and key ownership are unchanged.

## Actual checks

`node scripts/qa/email-auth.mjs` passed 53 exact-source action cases, 27 route cases, three installed-SSR action cookie cases, five installed-SSR callback/confirm cookie cases, and controlled form/page renders. Coverage includes invalid/File inputs, provider/redacted errors, password whitespace preservation, email trim, missing user/session, failed fresh getUser, neutral no-session/fake-existing-user signup, exact existing-account error-code state equality and unknown lookalike-code rejection, canonical safe-next redirect and revalidation order, invalid/missing code/token/type, no-store retries, GitHub-first enabled composition, disabled-provider text absence, one-heading pages, accessible form labels, optional public names, exact helpful error codes, and autocomplete/pending/error/notice semantics.

`node scripts/qa/auth-attribution.mjs` passed 48 focused synthetic attribution cases across both adapters and all three contribution types: missing/blank/nonstring/explicit/capped display metadata, payload author spoof override, no email localpart, and normalized stored attribution. Two integrated A whole-byte boundary checks passed without running the A lifecycle; the C standalone has no A byte contract and skips those optional checks.

The installed `@supabase/ssr` and auth SDK run with controlled fake fetch and an in-memory cookie jar through actual `lib/supabase/server.ts`; they issue synthetic signup/password/PKCE/OTP requests, write cookies, and recover the synthetic session on a subsequent client. The synthetic token marker is inert cookie-format/controlled-fetch proof, **not real JWT verification, provider session acceptance or protected-route acceptance**. It never contacts a real Auth endpoint or sends mail.

Focused ESLint on all changed source and QA passed after correcting two QA-only local variable names. Whole-tree TypeScript `--noEmit --incremental false` and scoped whitespace checks passed. The metadata-only addition passed its focused noindex/nofollow assertion and signup lint. Arjun (Backend engineer) subsequently found a source-supported conditional enumeration risk in the original known-existing-account provider-error branch; the exact-code neutralization above resolves it. Focused changed-source/QA lint and TypeScript passed after the final changes, and the changed-risk auth and attribution QA passed. No live account enumeration is claimed.

`standalone-C.patch` contains only this coherent public-auth package against live C `790862f919cd853c09998217f2587a8d8a88fb94`, without A evidence/schema dependencies. After the final optional-name/attribution/error-copy/provider-visibility corrections, dry-run/application to temporary exact C source and both focused QA scripts passed with installed dependencies. Integrated A contribution/actions/forms and completed lean-read artifacts were preserved. No git index/history changed.

## Official inputs and limitations

Read installed Next authentication/server-action guides and existing auth-config/serverClient/proxy/callback/confirm, plus current official [signup](https://supabase.com/docs/reference/javascript/auth-signup), [password sign-in](https://supabase.com/docs/reference/javascript/auth-signinwithpassword), [OTP verification](https://supabase.com/docs/reference/javascript/auth-verifyotp), [SSR clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs), and [email-template](https://supabase.com/docs/guides/auth/auth-email-templates) guidance. The [changelog index](https://supabase.com/changelog.md) and relevant [TLS deprecation](https://supabase.com/changelog/cbc-tls-ciphers-deprecated) were checked; no SDK flow change was required for the existing server client configuration.

Parent-supplied public settings report signup enabled, email enabled, confirmation required and GitHub disabled; this intern did not repeat a hosted settings read. SMTP, template/redirect delivery, a real signup/confirmation, live cookies/session/protected getUser, browser interaction, signout and normal authorized finding writes still require the later approved operator pilot. No real users, credentials, auth settings, database/cloud writes, servers, builds, dependency installation or publication were used. Parent integrates this handoff into canonical owner records because existing documentation is outside the intern lease.

## Exact SHA-256 artifacts

The machine-readable [hash manifest](hashes.json) distinguishes integrated working-tree sources from exact standalone C patched sources.

- `app/actions.ts`: `0c7b01f6509e120e6d02f73ea7585b3deda2ddd724051f990354a1d2439a48cc`
- `app/login/page.tsx`: `0e326e69fe80254af09d7c202581401c66b9d422171400663f1159571f0ad90b`
- `app/auth/callback/route.ts`: `eb6e0085ce1fcd91952837554abbb2a5a4e26c867e86c3bcb5442b8ad3c3f7f9`
- `app/auth/confirm/route.ts`: `385cd7d022411a99d2252253942ac4d4b6c6e15a0ec46c9dd28a419ab565790f`
- `components/forms.tsx`: `cb28c92f13cd1b9b289cd821a65a01f44a517dd99e7cf3bd76df110f58b05ce6`
- `server/services/contributions.ts`: `365f0f12e5aa3e2cbf833837f8979db8f4c094305d5ee9ece85270b331eb35be`
- `components/email-auth-form.tsx`: `675779c6e98ce7f7fd9031c450cb577fe90a861095c029059b19ef9bb2e00d2f`
- `app/signup/page.tsx`: `105d6e27a1fe97a2f32b35ba8d74785fea2a11e13ca8c07ac7e23417a919d42b`
- `scripts/qa/email-auth.mjs`: `7d2905c7b8ff2f09a617ea0f359fe27075125c3920972a5808a7f79051c3dcb1`
- `scripts/qa/auth-attribution.mjs`: `3d839416cb6dd8ec489c18ab862b73947b60192f7977a36dce3421bded10973c`
- `standalone-C.patch`: `94d41627dae5a9c32f86dca073abb7871bd4952ef6e580b88c0650c46266a20e`
