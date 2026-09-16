# PR Continuity Law

<!-- pr-continuity-law:v1 -->

This repository treats pull-request continuity as a machine-enforced proof contract, not a manual cleanup habit.

## Canonical transition

```text
main moves
  -> trusted main workflow reacquires open PR graph
  -> same-repository PR branches receive conflict-free GitHub update-branch only through a workflow-triggering credential
  -> successor head becomes a new proof subject
  -> predecessor CI/review/runtime/Playwright evidence expires
  -> successor pull_request gates must visibly materialize on the new head
  -> merge/deploy authority remains separate
```

## Rules

1. `main` is the root authority for normal PR continuity. Stacked PRs are followed from `main` through their live base branches.
2. Rollover uses GitHub's history-preserving `update-branch` operation with `expected_head_sha`. It does not force-push, reset, rebase, delete, or guess through conflicts.
3. Only same-repository branches may be mutated automatically. Fork PRs fail closed.
4. Conflict, permission, race, malformed managed metadata, provider uncertainty, missing workflow-triggering credentials, or missing successor verification materialization is `BLOCKED`, never silently repaired.
5. Every successful head movement expires predecessor exact-head CI, review, runtime, provider, artifact, and browser proof.
6. Ancestry currentness is not proof completion. A current PR still needs the repository's normal exact-head checks and real-path evidence.
7. The managed `PR Continuity Receipt` in the PR body may update machine-owned marker content only. Human PR prose, including whitespace outside the markers, must be preserved byte-for-byte.
8. Continuity receipts never authorize merge, deploy, publish, provider mutation, spend, deletion, or authority expansion.
9. Write authority runs from trusted `main`. Pull-request head code receives read-only continuity verification.
10. Automatic rollover may use only a credential whose branch update can trigger successor `pull_request` workflows. The workflow fails before mutation when `PR_CONTINUITY_TOKEN` is unavailable, and the engine fails closed if successor verification checks do not materialize after a head move.
11. Rollback is ordinary Git history: revert the continuity implementation commit or stop the workflow. Do not rewrite feature history as rollback.

## Attack 20+

The executable contract in `test/pr-continuity.attack20.test.mjs` attacks ancestry, divergence, unknown comparison states, TOCTOU head movement, fork authority, managed-body preservation, malformed markers, proof-subject binding, merge/deploy authority leakage, stacked PR propagation, unrelated stacks, cycle termination, authority-plane separation, byte-for-byte prose preservation, and successor verification materialization. The workflow must pass these attacks before any rollover write step.

## Proof boundary

`CURRENT` means only that the live base is an ancestor of the exact live head. It does not mean tests passed, the runtime serves that SHA, Playwright passed, reviews are current, or merge is authorized.
