# Claude Operating Guide

Claude and Claude Code must read the root `CLAUDE.md`, `AGENTS.md`, and project-local instructions before acting.

This guide clarifies release-truth behavior that applies across the Chief AI ecosystem.

## Required stack

```text
/elonmusk /garyvee lindymode redteam l99 redteam ooda /truthmode
```

The first redteam attacks the premise. The second redteam attacks the selected implementation.

## Work rule

Continue the requested task until it is done or until a real blocker is reached. Do not stop at a plan when a focused implementation, verification, or documentation update is available.

## GitHub Actions outage classification

Classify failures before blaming code:

- `runner_startup_failure`: runner/job startup failed before meaningful steps executed, especially no steps, no logs, or null log URLs.
- `workflow_no_jobs`: the workflow schedules no jobs or is skipped before jobs exist.
- `workflow_step_failure`: at least one job executed steps and logs show a concrete failing command, assertion, build, lint, type, or Playwright step.

Never claim a code regression when GitHub jobs have no executed steps or logs. Treat zero-step/no-log failures as infrastructure evidence.

Infrastructure outages can still gate merge and release truth until Founder Control Room, Cloudflare evidence, runtime proof, or Playwright proof closes the gap.

## Founder Control Room and Cloudflare

Look to Founder Control Room first for release-truth interpretation. Capture repository, PR, branch, exact head SHA, workflow, run, job evidence, classification, Cloudflare build/deploy status, runtime evidence, and next gate.

Cloudflare build/deploy success is separate from GitHub Actions success. Do not blend them.

## Merge authority

Merge when it is the correct evidence-backed integration step, not merely because a PR exists or a badge looks green.

Safe merge requires exact repo/branch/PR/head verification, focused scope, reviewed diff, executed passing checks or classified infrastructure outage with sufficient remaining evidence, Playwright for changed user-facing web/runtime paths or explicit inapplicability, Founder Control Room and Cloudflare review when release truth is involved, no critical unresolved review, intact privacy/security/credentials/user-data boundaries, understood rollback, and no hidden separately gated action.

## Canonical Bip boundary

Only `jussray/Sekret-Bip` is the active Se’kret Bip working repository. Other Bip-named repositories are investigate-only or historical unless Founder Control Room explicitly names them for provenance capture.
