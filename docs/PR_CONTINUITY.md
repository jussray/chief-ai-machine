# PR Continuity Law

<!-- pr-continuity-law:v1 -->

This repository treats pull-request continuity as a machine-enforced proof contract, not a manual cleanup habit.

```text
main moves -> trusted main reacquires open PR graph -> same-repo branches roll forward conflict-free -> successor head is a new proof subject -> predecessor CI/review/runtime/Playwright proof expires -> exact-head gates rerun -> merge/deploy authority remains separate
```

## Rules

1. `main` is the root authority; stacked PRs are followed through live base branches.
2. Rollover uses GitHub `update-branch` with `expected_head_sha`. Never force-push, reset, rebase, delete, or guess through conflicts.
3. Forks, conflicts, races, malformed managed metadata, and provider uncertainty fail closed.
4. Every head movement expires predecessor CI, review, runtime, provider, artifact, and browser proof.
5. `CURRENT` ancestry is not completion; ordinary exact-head and real-path gates still apply.
6. The machine-managed PR body block may change only between continuity markers; human prose is preserved.
7. Continuity receipts never authorize merge, deploy, publish, provider mutation, spend, deletion, or authority expansion.
8. Write authority runs only from trusted `main`; PR-head code receives read-only continuity verification.

## Chief-specific boundary

Chief may describe continuity, classify stale evidence, and preserve proposal lineage, but it remains proposal-only. PR continuity cannot become founder approval, execution authority, merge authority, deploy authority, provider authority, or a substitute for Founder Control Room verification.

## Attack 20

`test/pr-continuity.attack20.test.mjs` attacks ancestry, divergence, unknown state, TOCTOU, forks, body preservation, malformed markers, proof-subject binding, authority leakage, stacked propagation, unrelated stacks, and cycles before any write step.
