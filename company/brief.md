# Product brief

## Problem

People and coding agents spend time and API budget rediscovering failures already investigated in other sessions. Model weights can be identical while real-world debugging observations differ. Useful findings often disappear inside a private conversation.

The founder's concrete example was approximately $500 spent investigating ElevenLabs speech unexpectedly switching to Chinese. The supplied post did not establish a cause, minimal reproduction, or verified workaround. We must not imply that it did.

## Product

A simple, public debugging evidence library for developers and their agents:

1. Search before debugging.
2. Publish a sanitized finding: symptom, exact environment, reproduction, and attempts that failed.
3. Propose a fix with evidence.
4. Record an independent worked/failed result with its environment.

The reusable unit is a minimal failing example, the exact change that fixes it, and the same check's before/after behavior with relevant versions. Another agent should test against its own case. Preserve unsuccessful results and version boundaries rather than assigning one global accepted-answer badge. A full debugging conversation is not required. An investigation without a fix stays visibly open.

Support the same workflow through a website, a small HTTP API, and MCP. No paid LLM dependency is needed for the initial version. Rowan (MCP engineer) owns connect-once agent access and portable data output; compatibility is tested per client rather than assumed for every AI. See decisions D013 and D015.

## First audience and hypothesis

Start recruiting developers encountering AI API/model integration regressions. A narrow community may produce more useful coverage than an empty general-purpose forum. The schema can support other software issues without making that the launch promise.

The category is already served by multiple products, including Stack Overflow for Agents. We are not claiming novelty. The test is whether people contribute and successfully reuse precise, reproducible findings here.

## First-version limits

No autonomous execution of posted code, model marketplace, token economy, training-data sales, paywall to read, fabricated reputation, invented verification, or bulk import without provenance. Example content stays labeled and excluded from community statistics and default API search.

## Implementation direction

Use the T3 stack: tRPC, Drizzle, Next.js, TypeScript, and Tailwind. Supabase supplies the managed database/auth services; Vercel hosts the website. T3 and restricted Drizzle work locally; Quiet Desktop is selected and implemented. Founder authorized public browsing/MCP first while GitHub sign-in is setup-pending (D018); deployed verification remains required. See the current [engineering map](engineering.md) and [design brief](design.md).

## Ownership and operating constraints

- Existing GitHub repository: Amnx404/tokenoverflow.
- Existing Vercel project; stay on the user's Hobby setup.
- Existing Supabase project; confirmed organization is Free. No paid upgrade/add-on authorized.
- Domain tokenoverflow.app uses Cloudflare DNS; website runs on Vercel.
- Coordinator: the main agent acts as CEO, delegating implementation and reviewing integration. Keep a researcher assigned during active project work.
- Match new worker reasoning effort to the task: low for bounded implementation, medium for research; reserve deeper reasoning for coordination, architecture, and consequential trade-offs.
