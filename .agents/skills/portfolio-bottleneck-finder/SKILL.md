---
name: portfolio-bottleneck-finder
description: Find and prioritize evidence-backed blockers in one explicitly authorized Juss repository or the authorized GitHub portfolio. Use for /portfolio-bottleneck-finder, portfolio audit, launch blockers, failing CI and unverified delivery; combine TRUTHMODE, CONFESS, ULTRATHINK/DEVIL, and GOALFIX.
---

# Portfolio Bottleneck Finder

**Invocation:** `/portfolio-bottleneck-finder [repo | all]`. The word `all` means only repositories the founder has actually authorized for this task; it never grants access to unrelated accounts, mail, customers, or providers.

## Runbook

1. **Scope and authority.** Name the target repository/repositories, authoritative branch, exact head SHA, founder's requested outcome, permission boundary, and stop condition. Read each repository's `AGENTS.md`, stronger local policy and applicable installed skills first. Do not override them.
2. **TRUTHMODE + CONFESS.** Inspect GitHub source, relevant PRs, current CI jobs/checks and code only as needed. Distinguish `OBSERVED`, `USER-REPORTED`, `INFERRED`, `UNKNOWN` and `BLOCKED`. Missing provider readback is not a verified deployment.
3. **ULTRATHINK + DEVIL I.** Challenge the goal, evidence and premise; test whether the reported bottleneck is current and material. Do not treat green metadata, screenshots, plans, or self-attestation as proof of runtime behavior.
4. **GODMODE attack.** For each plausible bottleneck, examine security, access scope, privacy, authority, exact-SHA drift, test coverage, launch behavior, operational cost, and rollback. Preserve app boundaries, especially teen/parent data, account credentials and unpublished business details.
5. **GOALFIX selection.** Rank by user impact, strength of evidence, reversible fix leverage, dependency cost, and verification effort. Select the smallest critical-path correction; avoid redundant architectures and speculative broad refactors.
6. **Implement only when authorized.** Prefer an existing relevant PR/head. Do not create a new PR by default, force-push, merge, deploy, mutate provider state, rotate secrets, spend, publish or delete without separately applicable founder approval. Make isolated, reversible changes only within the authorized target.
7. **Prove.** Run the repository's own tests. For changed user flows use real-browser proof; for deployment claims require provider/runtime readback; for security assess authorization and data isolation. Record exact repo, branch, head, test command, output, failures, skipped checks, actor, UTC, and next gate. If unavailable, mark `UNKNOWN`, not `PASS`.
8. **DEVIL II.** Challenge the implemented fix for false greens, stale branches, weak checks, policy bypass, hidden failures and rollback gaps. Repeat only if new evidence justifies it.

## Output

For each target, show `BLOCKER | EVIDENCE | STATUS | IMPACT | MINIMAL FIX | VERIFICATION | AUTHORITY`. End with `REALITY / FIX / PROOF / RISK / ROLLBACK / NEXT GATE`. Keep sourced observations separate from proposals and never claim installation, runtime execution, merge or deployment from authored files alone.
