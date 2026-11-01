# Build

Scaffolding, setup, and the incremental grind, done with the same discipline as a repair: nothing lands without a plan and evidence. This is the shipping counterpart to goalfix.

## Spec before code
For a new feature, write the spec or PRD first and save it to a file (`docs/prd-<feature>.md`) so every later prompt references one source of truth. Cover: problem + success metrics, behavior as given/when/then across happy path and failure states, API contract (inputs, outputs, error shapes), data/schema changes, non-goals, and an acceptance checklist that can be verified line by line. The spec is the source of truth, not the code — if reality forces a deviation, stop, update the spec, get sign-off, then continue.

## Ground the AI in the real repo
When generating a CLAUDE.md, detect the conventions that are actually in the code — don't invent generic rules. Capture what the project is in two lines, the stack and versions that matter, the real dev/build/test/lint commands, where things live and why, the hard non-negotiables, and the gotchas a new engineer hits in week one. If unsure about a rule, ask rather than inventing it.

## Plan before touching files
Read every file the task touches and note what each does now. Map current vs target behavior. Propose 2-3 approaches with real tradeoffs (complexity, risk, blast radius), pick one, justify it briefly, then break it into steps small enough to verify one at a time — each with its own check, riskiest unknowns first. Flag anything touching auth, payments, or prod data for explicit sign-off. Show the plan and wait before writing code.

## Wiring integrations (directly relevant to your MCP work)
For an MCP server or external service: check for an official or well-maintained existing server first and name the source. If one exists, use the exact install command and scope the config to the project. Route secrets through env vars — never hardcode keys in the config. Verify the connection by calling one tool end-to-end and showing the output. Document each tool in one line so future sessions know when to reach for it.

For a database: pick the client that fits the stack and justify it in one line; name env vars in `.env.example` and never commit real values; add RLS if it's multi-tenant; then prove it — seed one row, read it back, show the output.

## Grind the build in small increments
Once the plan is approved, work in the smallest increments that can each be tested and committed on their own. Define the increment in 1-3 lines before writing code: what it does, which files it touches, and what "done" looks like as a testable outcome. Keep a TODO ledger at the project root with the current increment, the completed increments, and what is blocked and why.

Read the existing file first and never write blind. Make the smallest change that achieves the increment, with no boilerplate comments and no license headers unless requested. Prefer proven, boring technology. Test immediately after every change: if the test fails, fix and retest, and do not move to the next increment until it passes. If the same approach fails twice, stop, document the blocker, and suggest an alternative instead of pushing through.

After each working increment, commit the checkpoint: one line on what changed, one line on what was tested, one line on the next smallest increment. Run regression-stagnation-guard after each increment to catch drift early, and reach for truth-research-optimizer when a library, API, or approach needs verifying.

Watch output size the way you watch correctness. Under 500 tokens is green and you continue normally. Between 500 and 1500 is yellow: check whether the response could be shorter and trim it. Over 1500 is red: stop, break the work into smaller increments, and ask whether this could have been a file write plus three lines of summary.

## Dynamic by default (Ray standing order, 2026-10-25)
Builds move: ship the jussco.company motion system (smooth scroll; load-in rise stagger .5–.8s cubic-bezier(.2,.7,.2,1); hero breathe + parallax; scroll reveals; hover/tap transitions .25–.4s; staggered sequences) unless Ray's blueprint shows a static design. CSS-first under scriptless CSPs (keyframes + scroll/view timelines in @supports); content never hidden waiting on animation; `prefers-reduced-motion` kill switch always; transform/opacity only. Never on crisis/safety surfaces or checkout paths.

## The through-line
Sequence work so the thing compiles and runs after every step. Riskiest unknowns first. Prove each stage with real output before moving on — the same evidence-first rule goalfix uses for fixes applies to builds.

## Available connectors

- Use `muse.connector_search` to find other connectors and `muse.skill_search` to find related skills.

- If nothing here fits, look on the web for a maintained API or MCP server and set it up with [Custom Connectors and MCPs](/opt/muse/skills/custom-connector-setup/SKILL.md), or build a custom connector.
