---
name: goalfix
description: Find the real blocker behind a software goal, preserve the existing PR/carrier, apply the smallest reversible fix, roll current main forward, expire predecessor proof, verify the refreshed exact head, review the final diff, and merge only when repository governance authorizes it. Use for /goalfix, /fixfast, /repair-verify-merge, ULTRATHINK repair requests, failing tests, broken deployments, regressions, and focused implementation work.
---

# Goalfix

Treat `$ARGUMENTS` as the finish line. Seek, build, fix, verify, review, and merge without wandering.

## End-to-end continuity loop

Run:

`REACQUIRE → CLASSIFY → REPAIR → ROLL FORWARD → EXPIRE PROOF → VERIFY → PLAYWRIGHT → REVIEW → MERGE GATE → POST-MERGE TRUTH`

1. **Reacquire:** inspect the authoritative repo, current `main`, existing PR/carrier, base/head SHAs, mergeability, metadata, reviews, review threads, checks, rulesets, and relevant runtime/provider state.
2. **Classify:** mark evidence `VERIFIED`, `INFERRED`, `UNKNOWN`, `BLOCKED`, `STALE`, or `CLEARED`. Missing or skipped is not automatically false. Predecessor proof is not current proof.
3. **Repair:** isolate one causal blocker and apply the smallest reversible source or metadata fix. Preserve the existing carrier. Do not create a source commit for a metadata-only failure.
4. **Roll forward:** if `main` moved, bring current `main` into the same carrier using the smallest repository-allowed history-preserving method. If already current, do not create a no-op sync commit.
5. **Expire proof:** any head/base/code/metadata mutation creates a new exact candidate and expires predecessor exact-head proof for present-tense authority.
6. **Verify:** run touched-area lint/typecheck, focused tests, integration/contract proof, exact-head CI, and provider/runtime readback as applicable.
7. **Playwright:** invoke `/playwright-proof` for UI/runtime work and prove the affected real path, not only page load. If no browser path exists, mark it `INAPPLICABLE` with a reason.
8. **Review:** inspect the final diff, security/privacy/authority boundaries, test coverage, unresolved threads, independent approvals, all required status contexts, CodeQL, and provider/runtime gates on the final head.
9. **Merge gate:** merge only when the user requested it or checked-in policy grants standing authority and every applicable gate is green. Use the expected head SHA so a moving carrier fails closed. Never weaken a ruleset or required check to obtain green.
10. **Post-merge truth:** re-read the merged PR and current `main`, record the actual landed merge/main SHA, and separately verify deployment/runtime identity when production truth matters.

Treat `ULTRATHINK/steal` as deeper reasoning, not a larger patch. Extract causal mechanisms and synthesize an original solution. Do not copy protected expression, branding, private material, secrets, or incompatible code.

Return `REALITY`, `FIX`, `PROOF`, `RISK`, `ROLLBACK`, and one `NEXT GATE`.
