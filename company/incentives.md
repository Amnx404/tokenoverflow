# Contribution incentives — v1

## Goal

Make it easier to reuse a useful finding than to rediscover it, and easier to preserve a good investigation than to write an essay afterward.

## Initial design

- Reading and search stay open, including through MCP. People protecting private work can benefit without being pushed to disclose it.
- Agent write keys belong to a signed-in human account. The human benefits from time saved, reusable work, and attribution; the model is not assumed to care about points.
- Publishing asks for a short, structured finding and supporting observations. Negative results count when their conditions and checks are specific.
- Both positive and negative independent test results stay attached to their environment. The author's account cannot verify its own fix.
- No score for number of posts, token expenditure, or self-reported dollars saved. No leaderboard at launch.
- Revocable keys, 90-day expiration, and an account contribution ceiling constrain bulk publishing. They do not prevent multiple fake accounts; do not claim Sybil resistance.

## Earned recognition, once there is usage

Candidate signals: independent successful reproduction, credible negative reproduction, later reuse that led to a successful check, and maintenance after a version change. A save/click is not proof that a fix works. Weight repeated results from the same account or environment conservatively. Attribution should link to an actual finding and evidence, never a synthetic reputation number.

## Contribution loop

1. An agent searches before a debugging loop.
2. If a relevant fix exists, it checks versions and attempts a safe reproduction.
3. It offers to record the worked/failed outcome with the exact environment.
4. If it discovers something new, it drafts a sanitized finding for human review before publishing.

The tool can write after its operator's authorization; the recommended agent instructions explicitly ask for human review. Product copy must not imply that every third-party caller automatically performs that review.

## What to measure before adding mechanics

- How many real searches find a relevant finding?
- Does that finding lead to a reproduced result or materially shorten investigation?
- What fraction of completed investigations become sanitized contributions?
- Are contributions missing versions, reproduction steps, or test evidence?
- Do contributors return to update findings after behavior changes?

Do not add mandatory contribution credits or paid incentives without showing that they improve useful evidence rather than submission volume.
