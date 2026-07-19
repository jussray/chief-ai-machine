# Codex Operating Guide

Use Codex for focused code edits, tests, Playwright verification, CI triage, repository operations, and small reversible implementation work across the Chief AI ecosystem.

Codex must read `AGENTS.md`, `CLAUDE.md` when present, and any project-local instructions before acting.

## Required stack

```text
/elonmusk /garyvee lindymode redteam l99 redteam ooda /truthmode
```

Do not collapse the two redteam passes. The first attacks the premise; the second attacks the selected implementation.

## Work rule

Continue the requested task until it is done or a real blocker is reached. Do not stop at a plan when a focused implementation, verification, or documentation update is available.

## CI and outage classification

When GitHub Actions fails, classify the evidence before blaming code:

- `runner_startup_failure`: runner/job startup failed before meaningful steps executed, especially no steps, no logs, or null log URLs.
- `workflow_no_jobs`: the workflow schedules no jobs or is skipped before jobs exist.
- `workflow_step_failure`: at least one job executed steps and logs show a concrete failing command, assertion, build, lint, type, or Playwright step.

Never claim a code regression from zero-step/no-log jobs. Treat those as infrastructure evidence. An infrastructure outage can still gate release truth until Founder Control Room and any available Cloudflare/runtime evidence explain the state.

## Playwright

For UI, route, browser, release, onboarding, checkout, auth-flow, or runtime behavior changes, verify with Playwright on the exact changed head. If Playwright is inapplicable, say why. If Playwright cannot run because of outage, secrets, browser dependencies, or infrastructure, record that as a blocker rather than code blame.

## Founder Control Room and Cloudflare

Look to Founder Control Room first for release-truth interpretation. Capture repository, PR, branch, exact head SHA, workflow, run, job evidence, classification, Cloudflare build/deploy status, runtime evidence, and next gate.

Cloudflare build/deploy success is separate from GitHub Actions success. Cloudflare success is not proof that Playwright, auth, data, privacy, Supabase, Worker, or app runtime gates passed.

## Merge authority

Merge when it is the correct evidence-backed integration step, not merely because a PR exists or a badge looks green.

A merge is safe only when repository, target branch, PR, and exact head SHA are verified; scope is focused; changed files have been reviewed; required checks genuinely executed and passed or a documented infrastructure outage is classified with sufficient remaining evidence; Playwright passed for changed user-facing web/runtime paths or is explicitly inapplicable; Founder Control Room and Cloudflare evidence were checked when release truth or deployment is involved; no unresolved critical review remains; privacy, security, brand/IP, credentials, user data, and project boundaries remain intact; rollback is understood; and the merge itself does not silently perform a separately gated action.

## Canonical Bip boundary

Only `jussray/Sekret-Bip` is the active Se’kret Bip working repository. Other Bip-named repositories are investigate-only or historical unless Founder Control Room explicitly names them for provenance capture.
