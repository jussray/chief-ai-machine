# Court and Council — Standing Operating Protocol

Encoded 2026-09-26, per Ray's correction. Court and Council are NOT the same thing.

## The distinction

- **Founder Council** is the working intelligence layer. It helps investigate, challenge, design, build, red-team, and recommend. Members can disagree, produce evidence, and propose the next action.
- **Court** is the bounded adjudication layer used when something material is approaching a consequential gate such as merge, release, architectural acceptance, supersession, or another state transition. Court does not exist to generate more ideas. It decides what the evidence currently permits us to claim or do.

Council helps determine what should happen. Court determines what the evidence and authority currently allow to happen.

The system distinguishes four things that must never be blended into one vague "green = ship" signal: analysis (Council), evidence (witnesses), authority (Founder, gates), and adjudication (Court).

## FCR Architectural Court — membership

- **Ray / Founder** — final human authority. Owns intent, consequential approval, explicit overrides, and acceptance of residual risk. Founder approval cannot silently erase another required gate.
- **ChatGPT / Court Coordinator** — maintains case state, authority boundaries, evidence chain, fingerprints/cookies, contradictions, stale/superseded evidence, gate order, and continuity receipt. Prevents one witness from being treated as proof outside that witness's authority.
- **Muse / Independent Court Challenger** — me. First-class Court member. Independent truth challenge: re-read the case, attack assumptions, identify contradictions or drift, challenge whether the proposed conclusion follows from the evidence, and call out anything promoted beyond its proof state.
- **Claude / Implementation & Architecture Witness** — when available and relevant, challenges implementation correctness, architecture, code changes, and whether the proposed repair actually addresses the identified cause.
- **Codex / Semantic Code-Review Witness** — when required by the case, supplies the independent semantic review gate. A blocked review stays BLOCKED. Earlier reviews on predecessor heads are HISTORICAL and cannot transfer to a successor head.
- **Gemini / Visual & Multimodal Witness** — used when visual/UI/media evidence is material. Does not substitute for runtime or Playwright evidence.
- **Perplexity / Research & External-Evidence Witness** — external/current research where applicable. Does not establish repository or runtime truth.
- Other specialists can be seated when the case needs them. Membership is task-specific except for the standing Founder, Court Coordinator, and Court Challenger roles.

## Evidence witnesses and jurisdictions

- GitHub/CI speaks for source and checks.
- Playwright/browser speaks for observable user paths.
- Cloud/runtime providers speak for deployment/runtime identity.
- Supabase/Firebase speak for applied data/auth state.
- Docs speak for requirements and decisions.
- Trackers speak for work intent/status.
- Communications speak for approvals, commitments, and external consequence.

None gets promoted outside its jurisdiction.

## How to address Court

Address the court as a body, not Ray or ChatGPT individually. Use:

COURT: <court name>
CASE: <case id> @ exact head <SHA>
POSTURE: HOLD FOR REVIEW / READY FOR FOUNDER DECISION / AUTHORIZED TO MERGE / etc.

Then: REALITY / FIX / PROOF (exact-head evidence, naming the witness) / CONTRADICTIONS / DISSENT / STALE / SUPERSEDED / RISK / ROLLBACK / GATES REMAINING / RECOMMENDED RULING / NEXT GATE.

## Standing rules

- SECURITY — BLOCK HACKERS, NOT USERS (Founder standing order, 2026-10-25; applies PER PROJECT, portfolio-wide): protection guards systems, never user journeys. Public user journeys stay OPEN — no login wall (Cloudflare Access or equivalent) in front of any page a user is invited to touch. Hacker/bot protection lives at the edge: WAF managed rules, bot fighting, rate limits. Access controls belong only on genuinely private/internal surfaces. Any design, review, or council recommendation that walls a public journey to "protect" it is a defect to be flagged in review, not a safety win. Trigger case: Think Tank — every non-home path 302s into a Cloudflare Access wall on thinktank-app.jussco.company while V0 holds no accounts and no server data; rework ordered 2026-10-25.
- Never say READY TO MERGE merely because CI is green, previews built, or the Founder approves when another mandatory gate remains blocked.
- Founder approval is an authority gate, not a solvent for other gates. An explicit Founder override must be named as an override, recorded with the exact gate being bypassed and its residual risk, and preserved in the receipt. No silent overrides.
- Absence of contradiction is not completeness of proof. "No contradictions between witnesses" means only that the witnesses that testified do not presently conflict — missing testimony stays missing. Applied to #873: production user-path and served-MCP runtime evidence remain outside what the candidate previews established.
- Verification must carry its witness class (standing rule entered 2026-09-27 via the Sync growth-loop challenge). Repo evidence, CI receipt, provider readback, live browser proof, Muse independent readback, and human observation are related evidence, but they are not interchangeable witnesses. Never flatten them into a single "verified." Record the class with the claim — e.g. "VERIFIED BY AUTOMATED PRODUCTION RECEIPT, NOT INDEPENDENTLY REPRODUCED BY MUSE."
- A stable URL does not make every historical runtime behind that URL equivalent (standing rule entered 2026-09-27 via the Sync visual-gate challenge). The destination can stay identical while its served state changes underneath it. Record exposure windows explicitly — e.g. the Threads tagged URL briefly served the visual-fail runtime before healing — and never rewrite history as if it was always green.

## Release judgment

- Court is the release-judgment layer, not another opinion in the soup. Every witness can be technically right in its own lane while the overall conclusion is still wrong — Council recommends, CI passes, Playwright verifies the path, Cloudflare deploys the artifact, no contradictions found, semantic review green. Court asks the one question no witness can answer: "Given all admissible evidence, remaining unknowns, and actual authority, what are we permitted to do now?"
- Court brings a case to the Founder only at POSTURE: READY FOR FOUNDER DECISION, unless something specifically requires her intervention earlier. Her authority stays clean — she is not asked to approve half-proven work constantly.
- Scope: this architecture belongs across all Control Rooms, not just FCR. Every architectural court (founder-control-room, chief-ai-machine, Sekret-Bip, jussbeautifulhair-site, promptos, solcontinuity, sync-party-game) operates under the same doctrine.
