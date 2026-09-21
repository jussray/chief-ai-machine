---
name: repo-truth
description: Establish the exact source-of-truth state of a software project before coding, review, deployment, or publication. Use when repository, branch, commit, PR, CI, deployment head, worktree state, or ownership may be ambiguous or stale.
---

# Repo Truth

Resolve repository reality for `$ARGUMENTS` before changing it.

1. Confirm repository owner/name and configured remotes.
2. Confirm target/current branch, local head, remote head, upstream relationship, and dirty/untracked files.
3. Identify open PRs containing or superseding the work. Distinguish merged history from active gates.
4. Inspect only checks attached to the exact candidate head. Record whether failures executed code or failed before steps ran.
5. Reconcile deployed commit with candidate head when deployment matters. A build of another SHA is not proof.
6. Preserve user changes. Do not switch, pull, rebase, reset, clean, stash, or mutate remotes without authorization and understood impact.
7. Apply the repository PR Continuity Law in `docs/PR_CONTINUITY.md`: when `main` advances, the existing same-repository PR branch must be rolled forward conflict-free before present-tense proof is reused. Any successor head is a new proof subject and predecessor CI, review, runtime, provider, artifact, and Playwright evidence expires.
8. Never create a replacement PR merely to escape stale ancestry. Conflict, fork authority, race, or provider uncertainty is `BLOCKED`, not permission to force, rebase, reset, or guess through history.

Classify evidence as `VERIFIED`, `INFERRED`, `UNKNOWN`, or `BLOCKED`. Treat stale checks, protection summaries, aliases, and cached dashboards as leads. Prefer SHA-linked evidence.

Report repo, branch, exact head, worktree condition, relevant PR, exact-head checks, deployment alignment, continuity state, and next safe gate. Do not claim code failure when the runner never executed code.
