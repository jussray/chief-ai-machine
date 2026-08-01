---
name: review-verify-merge
description: Review a focused code change, verify required checks and the real user path, and merge only when the exact candidate head is safe. Use for “review merge cont,” “repair verify and merge,” PR merge gates, stale-check disputes, and pre-public-launch changes.
---

# Review Verify Merge

Treat `$ARGUMENTS` as the candidate goal. Merge follows evidence, never momentum.

1. Invoke `/repo-truth` to bind review to repo, target branch, PR, and exact head.
2. Read the focused diff and nearby behavior. Preserve unrelated changes.
3. Check correctness, regression, security/privacy, state transitions, failure handling, compatibility, tests, and rollback.
4. Red-team how it could pass tests yet fail in production.
5. Run cheapest valid checks, then focused tests. Invoke `/playwright-proof` for any UI/runtime path.
6. Confirm every required check belongs to the exact head. Separate application, test, skipped-proof, and runner failures.
7. Merge only when requested, mergeable, browser evidence exists when required, and no unresolved material risk remains. Exact-head gates must be green unless checked-in repository policy explicitly permits a classified runner-startup or no-job infrastructure-outage exception, sufficient alternative evidence satisfies that policy, and the merge remains permitted without bypassing protection.
8. Verify the target branch contains the result. Verify deployment separately if production state is part of the goal.

Never bypass protection, dismiss valid findings, rewrite history, or claim production success from merge alone. Return `REALITY`, `FIX`, `PROOF`, `RISK`, `ROLLBACK`, and `NEXT GATE` with exact identifiers.
