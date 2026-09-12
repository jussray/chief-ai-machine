---
name: goalfix
description: Use for repository repair, implementation blockers, CI failures, focused product fixes, and “repair, verify, and merge” work. Inspect the authoritative repo first, isolate one root cause, make the smallest reversible patch, preserve the existing PR/carrier, roll current main forward, expire stale proof, prove the refreshed exact candidate with real-path evidence, review the final diff, and merge only when repository governance authorizes it.
metadata:
  version: "1.2.0"
  owner: "Juss"
  category: "engineering"
---

# Goalfix

## Mission

Turn founder intent into the smallest verified implementation that moves the real product goal forward.

Do not wander, rewrite the whole project, invent repository state, weaken gates to manufacture green, create replacement PRs to escape stale work, or call work done without proof.

Codex explicit invocation is `$goalfix`. Natural-language triggers also include `/goalfix`, `/fixfast`, `/repair-verify-merge`, `ULTRATHINK`, and requests to repair, verify, review, and merge a focused change.

## End-to-end carrier law

Repository work runs as one continuity loop:

`REACQUIRE → CLASSIFY → REPAIR → ROLL FORWARD → EXPIRE PROOF → VERIFY → PLAYWRIGHT → REVIEW → MERGE GATE → POST-MERGE TRUTH`

Rules:

- Reacquire current `main`, the existing PR/carrier, exact PR head, mergeability, reviews, threads, checks, rulesets, and relevant runtime/provider state before acting.
- Continue the existing PR/carrier unless the founder explicitly authorizes a different lineage or the repository proves the carrier cannot be safely continued.
- When `main` advances, bring current `main` into the same carrier with the smallest history-preserving method allowed by repository policy, then treat the resulting head as a new candidate.
- Any code, metadata, base, merge, rebase, or head mutation expires predecessor exact-head proof for present-tense authority.
- Never inherit green from a predecessor SHA. Re-run the required proof against the refreshed exact head.
- A failed gate caused by stale PR metadata may be repaired by correcting the metadata when source code is not the cause. Do not create a source commit merely to make a metadata gate green.
- Required provider/repository governance must stay fail-closed. Never weaken a ruleset, required check, review requirement, CodeQL boundary, or provider policy to obtain a merge.

## Preflight

Before broad reading, establish:

```text
AUTHORITATIVE REPO:
EXISTING PR / CARRIER:
TARGET BASE / CURRENT MAIN SHA:
CURRENT HEAD SHA:
CURRENT GOAL:
SUSPECTED FAILURE AREA:
FIRST FILES / LOGS / TESTS NEEDED:
PROOF REQUIRED:
ROLLBACK:
STOP CONDITION:
```

Start narrow. Prefer the exact error, failing test, workflow job/step, affected route, recent diff, PR metadata, and relevant configuration before whole-repo scanning.

If repository evidence can answer a question, inspect it before asking the founder.

## Truth states

Use these states without blurring them:

- `VERIFIED`: directly established by current authoritative evidence.
- `INFERRED`: supported by evidence but not directly proven.
- `UNKNOWN`: evidence is absent, stale, inaccessible, or insufficient.
- `BLOCKED`: the next valid action requires a missing dependency, permission, secret, provider state, approval, or proof.
- `STALE`: evidence was valid for an older base/head/runtime identity but no longer authorizes a present-tense claim.
- `CLEARED`: a previously material blocker was rechecked on current authority and is no longer blocking.

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

### 1. Reacquire and observe

Inspect only the sources that can establish current reality, including:

- repository and repo instructions
- current `main` SHA and target branch
- existing PR/carrier, base SHA, exact head SHA, mergeability, draft state, metadata, reviews, review threads, and changed files
- current check-runs/statuses and failing workflow job/step logs
- active repository rulesets / merge policy
- deployment/runtime evidence
- database or provider state when relevant
- Playwright evidence for affected browser paths

Classify evidence as `VERIFIED`, `INFERRED`, `UNKNOWN`, `BLOCKED`, `STALE`, or `CLEARED`.

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
- preserve the existing carrier
- no unrelated refactors
- no duplicate authority or parallel architecture
- no deletion without explicit authority
- no hidden fallback that suppresses a real failure
- no source patch for a metadata-only failure
- no merge of an obsolete candidate
- sequence multiple blockers instead of piling them into one patch

### 4. Act

Patch only the required files or metadata.

For code:

- keep the diff small
- implement missing behavior instead of merely documenting it
- add or update the narrowest useful regression proof
- preserve fail-closed security and authority boundaries
- avoid speculative dependencies and abstractions
- do not suppress tests, lint, type checks, release gates, or meaningful warnings

For PR metadata:

- roll the body/title forward to the actual current base/head and current proof state when stale text is itself driving a gate
- preserve historical provenance while clearly marking predecessor proof `STALE`
- do not claim a skipped, absent, queued, or predecessor check is current green

### 5. Roll forward and expire proof

Before final verification:

1. Re-read current `main`.
2. Re-read the PR base/head.
3. If `main` moved, roll it into the same carrier using the repository-allowed history-preserving method.
4. Re-read the resulting exact head.
5. Expire all predecessor exact-head proof.
6. Run proof only against the refreshed exact head.

If current `main` is already the PR base authority, record that the carrier is current and do not create a no-op sync commit.

### 6. Verify

Use the cheapest valid proof first, then escalate:

1. touched-area static/type validation
2. focused lint
3. focused unit test
4. focused integration/contract test
5. targeted Playwright for browser-visible/runtime flows
6. broader affected suite
7. exact-head CI
8. deployment/runtime receipt when production truth matters
9. provider/repository governance readback when merge authority depends on it

Never list intended tests as executed proof.

### Playwright rule

Playwright is required when the change can affect browser-visible UI, navigation, authentication, onboarding, interaction, runtime identity, or another user-facing web/runtime path.

Verify the affected path, not merely page load. Inspect useful screenshots, traces, console/network failures, route transitions, and visible state when available.

For work with no meaningful browser path, mark Playwright `INAPPLICABLE` and state why instead of manufacturing browser proof.

### 7. Red-team final candidate

Before merge review, try to invalidate the fix:

- Did this solve the root cause?
- Can stale state appear current?
- Can expected evidence appear observed?
- Can provider acceptance be mistaken for completion?
- Can a mock create false confidence?
- Can authorization, privacy, migrations, or rollback fail?
- Is all proof tied to the final candidate SHA?
- Did a later metadata/base/head mutation expire earlier proof?
- Did current `main` move again?

If a material problem appears, return to Act and create a new exact candidate on the same carrier.

### 8. Merge review

Review the final diff and governance state, not a predecessor snapshot.

Check:

- all changed files belong to the intended goal
- no unrelated refactor or authority expansion slipped in
- security/privacy/network boundaries fail closed
- tests actually cover the repaired cause
- Playwright covers the real user path when applicable
- current base/head identity is exact
- review threads are resolved
- required independent approval is present when repository policy demands it
- all required status contexts have materialized on the final head
- skipped required checks are blockers unless repository policy explicitly defines them as acceptable
- CodeQL/provider/runtime requirements are satisfied when required

### 9. Merge gate

“Repair, verify, and merge” means all three.

Before merge require, when applicable:

- focused diff reviewed
- exact candidate SHA identified
- branch based on acceptable current `main`
- relevant tests actually executed and green
- required Playwright evidence green
- required CI green on the exact head
- meaningful review findings resolved
- rollback understood
- production claims backed by production evidence
- repository/founder approval rules satisfied

Use the expected head SHA when executing a merge so a moving carrier fails closed.

Do not equate `code-ready`, `PR-open`, `workflow-started`, `deploy-requested`, `provider-accepted`, or predecessor green with verified, merged, deployed, or production-live.

### 10. Post-merge truth

After a successful merge:

- re-read the PR as merged
- record the landed merge/main SHA rather than assuming the PR head became `main`
- re-read current `main`
- treat the landed main SHA as the new source authority
- distinguish repository merge from deployment/runtime activation
- when production matters, verify runtime identity and the real path after merge

## Git convention

For new Codex branches use:

`codex/{feature}-{date}`

But do not create a new branch or replacement PR when an existing focused carrier can be safely continued.

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
- predecessor proof expired by a later head/base change

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
What could still be wrong. Use UNKNOWN/BLOCKED/STALE where appropriate.

ROLLBACK:
Smallest safe reversal.

NEXT GATE:
One exact founder decision or next action.
```

No victory lap. No fake green. No token theater.
