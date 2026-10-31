# Discussion record

## 2026-10-30 — founder direction

- The idea is shared empirical debugging knowledge, not agents exchanging general training knowledge. An expensive investigation should save later people and agents from paying to repeat it.
- The founder wants a simple working app, managed end-to-end, using existing GitHub/Vercel/Supabase resources. Supabase must remain on its free tier.
- The domain is tokenoverflow.app and DNS is held at Cloudflare. Connecting it to Vercel is authorized; no domain purchase or transfer is requested.
- Build a few distinct working design iterations with subagents. Keep one researcher assigned during active build work.
- The main agent coordinates as CEO and brings material decisions to the founder. The founder delegates routine app, MCP, incentive, and design implementation decisions.
- Keep a separate company/ folder in the repository to preserve research, discussions, decisions, and important progress. Summarize; do not publish raw sessions or private account information.
- New implementation agents should use lower reasoning effort appropriate to bounded jobs; research agents medium; the coordinator handles critical reasoning and reviews integration.

## 2026-10-30 — latest direction

- Use T3: tRPC, Drizzle, Next.js, TypeScript, and Tailwind, with Supabase and Vercel tools.
- The primary agent must operate as CEO: hire/coordinate workers, review their work, and handle important decisions. Delegate bulk implementation.
- Keep company Markdown consistent and efficient. Later explicit founder decisions supersede earlier plans.
- Use higher reasoning for primary coordination, low reasoning for bounded workers, and medium reasoning for research.

## Evidence and uncertainty

Original source: the founder supplied an exported Reddit discussion. A researcher subsequently located the live thread; see the dated research memo. The discussion supports the founder's intended use case and objections worth testing. It does not establish demand, product-market fit, or verified debugging fixes.

## 2026-10-30 — clarified operating model and launch setup

- The founder explicitly requires T3: tRPC and Drizzle alongside Next.js, TypeScript, and Tailwind. Use managed Supabase and Vercel capabilities for the surrounding infrastructure.
- The founder increased agent concurrency; the active host reports 21 slots including the coordinator. Capacity does not justify creating unnecessary workers.
- The coordinator is CEO. The founder wants named engineers with durable system ownership, not agents named after isolated implementation tasks. The named team is recorded in team.md.
- The founder chose GitHub sign-in first. The exact Supabase pooler host was supplied safely as a URI template with a password placeholder, allowing a separate restricted runtime credential.

## 2026-10-30 — design reset, evidence and reusable company memory

- The founder rejected all three initial design previews. They requested Mobbin's plugin for reference discovery, liked TypeSafe AI's distinctive minimal feel, and supplied its Mobbin capture. They also liked PostHog's desktop interface and suggested a blend, later naming Windows 7 or XP. These are exploration constraints; no new visual target has been selected.
- The interface should communicate subtly through its visuals rather than explicitly laying out every product concept in text. Keep meaningful versions/results readable while reducing explanatory prose and competing content. See D012 and design.md.
- The founder endorsed feedback defining the reusable object as a minimal failing example, fixing change and before/after check with versions. Preserve unsuccessful reproductions and version-specific outcomes, and do not require full-session publication. See D013 for the accepted requirement and implementation limits.
- Design decisions, engineering choices and important work must be consolidated, stored and actually used. The company entrypoint and AGENTS.md startup/handoff practice implement that requirement (D014).
- The founder requested an MCP engineer specifically focused on getting data out, like Mobbin, so engineers can connect and forget. Rowan now owns that system; Maya retains shared backend rules. See D015.
- The founder expects the CEO to keep useful parallel work assigned, reassign completed owners promptly, and continue independent work around blockers. They explicitly requested properly defined company/roles that are captured and consulted. Role files and startup instructions implement D016.


## 2026-10-30 — actual reasoning, council and broader brand direction

- Aman requires actual high reasoning for all employees, medium for interns and extra-high for Codex (CEO). Prompt wording is insufficient; safe same-identity renewal at substantial-package handoffs must preserve ownership/evidence and active releases. D027 and the current people directory record policy versus actual transitions.
- Existing specialists, rather than uncontrolled hires, form the council: MCP integration, agent-facing UX and evidence/learning behavior. Morgan (Product manager) must continuously debate assumptions using Casey (Test user)/Robin (Test user) observations and record actual disagreement/model revision. Product retrieves/retests evidence rather than training model weights. Peer-level Markdown communication and precise escalation are required (D028).
- Aman rejects all three previous logos and requests a fresh, materially broader Mobbin-inspired complete brand foundation. Do not apply rejected marks; the accepted Quiet Desktop app direction remains. Brand work runs in parallel without a new layout or stopping full-MVP A/B/C work (D029).

- Subsequent brand feedback rejects the entire current guide presentation/language as “too AI-ish,” too text-heavy, insufficiently simple/minimal, weak on first impression/use and lacking old-Windows-PC feel. Fresh work should be a compact old-Windows workspace with identity in use and almost no instructional prose. This is not rejection of all current production code or approval of a replacement skin (D031).
