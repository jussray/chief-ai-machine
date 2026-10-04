---
name: goalfix
description: Use for repository repair, implementation blockers, CI failures, focused product fixes, and “repair, verify, and merge” work. Inspect the authoritative repo first, isolate one root cause, make the smallest reversible patch, prove the exact candidate with real-path evidence, and report REALITY/FIX/PROOF/RISK/ROLLBACK/NEXT GATE. Do not use for simple explanation-only questions or broad speculative rewrites.
metadata:
  version: "1.1.0"
  owner: "Juss"
  category: "engineering"
---

# Goalfix

## Mission

Turn founder intent into the smallest verified implementation that moves the real product goal forward.

Do not wander, rewrite the whole project, invent repository state, weaken gates to manufacture green, or call work done without proof.

Codex explicit invocation is `$goalfix`. Natural-language triggers also include `/goalfix`, `/fixfast`, `/repair-verify-merge`, `ULTRATHINK`, and requests to repair, verify, review, and merge a focused change.

## Preflight

Before broad reading, establish:

```text
AUTHORITATIVE REPO:
TARGET BASE / CURRENT SHA:
CURRENT GOAL:
SUSPECTED FAILURE AREA:
FIRST FILES / LOGS / TESTS NEEDED:
PROOF REQUIRED:
ROLLBACK:
STOP CONDITION:
```

Start narrow. Prefer the exact error, failing test, workflow job/step, affected route, recent diff, and relevant configuration before whole-repo scanning.

If repository evidence can answer a question, inspect it before asking the founder.

## Truth states

Use these states without blurring them:

- `VERIFIED`: directly established by current authoritative evidence.
- `INFERRED`: supported by evidence but not directly proven.
- `UNKNOWN`: evidence is absent, stale, inaccessible, or insufficient.
- `BLOCKED`: the next valid action requires a missing dependency, permission, secret, provider state, approval, or proof.

Missing, null, skipped, unavailable, and unobserved are not automatically false.

Expected identity must never masquerade as observed identity.

## Operating loop

Use:

`founder value → lindy → redteam → L99 → redteam → OODA`

Interpret it as:

1. Identify the founder/user outcome that matters.
2. Prefer the durable fix that will still make sense later.
3. Attack the premise: should this change exist?
4. Resolve authority, state, evidence, rollback, and compounding value.
5. Attack the selected implementation and its failure modes.
6. Observe → orient → decide → act → verify → observe again.

## Work order

### 1. Observe

Inspect only the sources that can establish current reality, such as:

- repository and repo instructions
- target/base branch and exact SHA
- PR and recent diff
- failing CI job/step
- deployment/runtime evidence
- database or provider state when relevant
- Playwright evidence for affected browser paths

Separate VERIFIED, INFERRED, UNKNOWN, and BLOCKED.

### 2. Orient

Map:

`GOAL → CURRENT STATE → BOTTLENECK → SMALLEST VALID MOVE`

Resolve 5W1H:

- Who owns the decision/authority?
- What behavior must change?
- Where is the authoritative source?
- When should work stop, rerun, merge, deploy, or roll back?
- Why does this serve the founder, user, product, or business?
- How will the change be proven and reversed?

### 3. Decide

Choose one focused fix.

Rules:

- one root cause before many symptoms
- smallest reversible patch
- preserve unrelated work
- use existing architecture before creating new systems
- no unrelated refactors
- no duplicate authority or parallel architecture
- no deletion without explicit authority
- no hidden fallback that suppresses a real failure
- no merge of an obsolete candidate
- sequence multiple blockers instead of piling them into one patch

### 4. Act

Patch only the required files.

For code:

- keep the diff small
- implement missing behavior instead of merely documenting it
- add or update the narrowest useful regression proof
- preserve fail-closed security and authority boundaries
- avoid speculative dependencies and abstractions
- do not suppress tests, lint, type checks, release gates, or meaningful warnings

### 5. Verify

Use the cheapest valid proof first, then escalate:

1. touched-area static/type validation
2. focused lint
3. focused unit test
4. focused integration/contract test
5. targeted Playwright for browser-visible/runtime flows
6. broader affected suite
7. exact-head CI
8. deployment/runtime receipt when production truth matters

Never list intended tests as executed proof.

### Playwright rule

Playwright is required when the change can affect browser-visible UI, navigation, authentication, onboarding, interaction, or another user-facing web/runtime path.

Verify the affected path, not merely page load. Inspect useful screenshots, traces, console/network failures, route transitions, and visible state when available.

For work with no meaningful browser path, mark Playwright `INAPPLICABLE` and state why instead of manufacturing browser proof.

### 6. Red-team

Before merge, try to invalidate the fix:

- Did this solve the root cause?
- Can stale state appear current?
- Can expected evidence appear observed?
- Can provider acceptance be mistaken for completion?
- Can a mock create false confidence?
- Can authorization, privacy, migrations, or rollback fail?
- Is all proof tied to the final candidate SHA?

If a material problem appears, return to Act.

### 7. Merge gate

“Repair, verify, and merge” means all three.

Before merge require, when applicable:

- focused diff reviewed
- exact candidate SHA identified
- branch still based on acceptable current authority
- relevant tests actually executed and green
- required Playwright evidence green
- required CI green
- meaningful review findings resolved
- rollback understood
- production claims backed by production evidence
- repository/founder approval rules satisfied

Do not equate `code-ready`, `PR-open`, `workflow-started`, `deploy-requested`, or `provider-accepted` with verified, merged, deployed, or production-live.

If the base moves, re-evaluate/replay as needed and prove the refreshed exact head.

## Git convention

For new Codex branches use:

`codex/{feature}-{date}`

Keep PRs focused. Prefer squash merge when repository policy permits. A new root cause gets a new focused decision rather than silent scope expansion.

## Production truth

A repository merge proves repository state, not automatically production state.

When production matters, distinguish:

`SOURCE → BUILD → DEPLOY → LIVE IDENTITY → HEALTH → REAL PATH → OUTCOME`

Require appropriate evidence at each relevant layer.

## Confess / truthmode

Before claiming completion, disclose material uncertainty such as:

- tests not executed
- browser proof unavailable
- provider state inaccessible
- deployment not verified
- production not changed
- branch stale or checks queued
- result based only on static inspection
- required credential/approval missing
- mock or fallback used instead of the real path

Do not polish blockers into success.

## Final report

Return only:

```text
REALITY:
What is verified right now.

FIX:
What changed, including files/commit/PR when applicable.

PROOF:
Executed tests, checks, Playwright, logs, screenshots, traces, artifacts, or runtime receipts.

RISK:
What could still be wrong. Use UNKNOWN/BLOCKED where appropriate.

ROLLBACK:
Smallest safe reversal.

NEXT GATE:
One exact founder decision or next action.
```

No victory lap. No fake green. No token theater.
