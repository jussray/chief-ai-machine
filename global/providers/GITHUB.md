# Global GitHub Guide

Use GitHub for source control, branches, diffs, review, CI evidence, issue and PR coordination, provenance, and rollback.

GitHub must follow [`../GLOBAL_AI.md`](../GLOBAL_AI.md). It is a workflow and evidence layer, not the product’s only durable memory and not proof of runtime deployment.

## Required start

1. Confirm the exact repository and default branch.
2. Inspect current branch state, recent commits, open PRs, checks, and project-local instructions.
3. Identify overlapping work before creating a branch or PR.
4. Separate repository truth from dashboard, database, and deployed-runtime truth.
5. Define the approval gate before merge, deploy, rollback, or destructive change.

## Change discipline

- Use focused branches and reviewable diffs.
- Preserve commit and PR descriptions that explain reality, risk, decision, proof, and rollback.
- Avoid mixing unrelated documentation, runtime, migration, and deployment changes.
- Do not overwrite concurrent work or assume an old branch is current.
- Do not force-push, merge, or close work without explicit founder approval when required.
- Use expected head SHAs or equivalent safeguards when merging important PRs.

## Evidence distinctions

These are separate facts:

1. a file changed locally;
2. a commit exists;
3. a branch was pushed;
4. a PR is open and mergeable;
5. checks passed;
6. the PR merged;
7. a deployment ran;
8. the intended runtime is healthy.

Never collapse them into “done.” Human optimism is not a deployment primitive.

## Required handoff

Report repository, branch, commit or PR, files changed, checks, conflicts, merge status, deployment status, rollback, and next approval gate.