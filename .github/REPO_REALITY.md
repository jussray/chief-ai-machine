# Repo Reality — verification and change-control contract

Status: **AUTHORED policy proposal**. This file does not itself prove that CI passed, branch rules are active, or a deployment is live.

## Operating invariants
1. Expected is not observed. User-reported is not independently reproduced.
2. Verification requires an explicit criterion, commit SHA, evidence source, and scope.
3. Never substitute a report, proposed patch, or green badge from an unrelated SHA for an implemented result.
4. Preserve product independence. One repository or agent does not acquire permission over another.
5. Do not read, disclose, publish, delete, merge, deploy, or change protected settings without the applicable authority.
6. Redact secrets, personal information, and sensitive evidence. A public PR must not expose private project data.

## Evidence vocabulary
- **AUTHORED:** drafted content or a directly observed write; not proof it executes.
- **OBSERVED:** inspected repository, run, artifact, or provider state with origin identified.
- **USER-REPORTED:** stated by a person; do not relabel as independently observed.
- **VERIFIED:** a named criterion passed in a bounded scope with supporting evidence.
- **INFERRED:** interpretation or hypothesis with assumptions identified.
- **UNKNOWN:** evidence is insufficient.

Work status: **NOT STARTED**, **DRAFTED**, **APPLIED**, **ATTEMPTED**, **PASSED**, **FAILED**, **BLOCKED**, **SKIPPED**. An applied patch is not a passed test.

## Pull requests and releases
Before merging, require:
- Reviewable changes on a named branch; no force updates or silent mutation of the default branch.
- A PR description containing **Scope**, **Verification**, **Evidence**, **Limits**, and **Rollback** sections. An automation can check the sections exist, but cannot verify the truth of the author's claims.
- A named, observed PR head SHA; the checks designated required by branch rules must pass **for that SHA**. A green run from another commit is not evidence for this head.
- No unresolved security, privacy, or authorization blockers. Sensitive repositories require stronger boundaries, not weaker ones.
- A repository-specific authorization and rollback plan for any production release. CI success does not grant deployment authority.

## Machine-check scope
The `Repo Reality Evidence` workflow proves only that its checked-out commit equals the expected event head SHA and that PR evidence fields are populated. **It is not a test-suite, security audit, independent evidence verification, or branch-protection substitute.** GitHub rulesets must separately require this check, plus existing project-specific CI and reviews, before a merge gate is fully enforced.

## Failure and recovery
Preserve failed-run evidence and the exact commit. Diagnose and repair in a review branch; rerun relevant checks against the new head. Record remaining blocked or unverified work. Do not claim the old successful run validates the new commit.

## Deployment and privacy
Default to least privilege and explicit owner authorization. Public front doors and internal authority are separate; do not publish internal receipts, credentials, private user data, or juvenile information into repository content, logs, or build artifacts.
