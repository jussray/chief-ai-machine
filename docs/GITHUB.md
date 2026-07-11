# GitHub Operating Guide

Use GitHub as the repository evidence, change-management, review, and provenance layer for the Chief AI ecosystem.

GitHub records what changed. It does not prove that a deployment succeeded, a dashboard setting is correct, or a product works in production unless those states are separately inspected and verified.

## Best role

Use GitHub for:

- repository and branch inspection;
- commit, pull request, issue, and review history;
- focused file changes;
- code review and approval records;
- CI logs and artifacts;
- release and rollback provenance;
- durable decision links.

## Required start

Before changing a repository:

1. identify the exact repository and default branch;
2. inspect recent commits and open pull requests;
3. read repository-local instruction files;
4. identify the target files and existing implementation;
5. check whether another branch or agent is already changing the same area;
6. state the intended outcome and approval boundary.

## Founder stack

For:

```text
/garyvee lindymode redteam l99 redteam ooda
```

apply the stack to GitHub work as follows:

1. **GaryVee frame:** identify the user-visible or business outcome the repository change must create.
2. **Lindy screen:** prefer small branches, standard Git history, portable files, documented decisions, and reversible commits.
3. **Redteam I:** challenge whether the requested repository change is necessary, correctly scoped, and based on current evidence.
4. **L99 pass:** inspect branch relationships, source-of-truth ownership, dependencies, release state, migration history, and long-term drift.
5. **Redteam II:** attack the proposed diff, blast radius, merge conflicts, CI gaps, rollback path, and deployment assumptions.
6. **OODA:** create the smallest coherent change, verify it, open a pull request, and use the result as new evidence.

## Change workflow

For nontrivial work:

1. create a focused branch from the current default branch;
2. keep the branch limited to one coherent outcome;
3. preserve unrelated work;
4. make reviewable commits with accurate messages;
5. inspect the final diff;
6. run available tests or checks;
7. open a pull request containing reality, risk, decision, action, proof, rollback, and unresolved issues;
8. wait for explicit founder approval before merging.

Direct commits to the default branch should be reserved for cases where the founder explicitly requests them or the repository workflow clearly requires them.

## Approval gates

Require explicit founder approval before:

- merging a pull request;
- force-pushing or rewriting published history;
- closing or superseding another contributor’s work;
- changing branch protection or required checks;
- creating a release or production deployment;
- reverting production;
- changing repository visibility;
- installing or widening GitHub App permissions;
- deleting branches that may contain unmerged work;
- committing secrets, credentials, private prompts, or sensitive user data.

A request to inspect, audit, review, or prepare a pull request is not permission to merge it.

## Pull request standard

Every material pull request should state:

- **Reality:** current state and evidence;
- **Risk I:** what was wrong or unproven in the original premise;
- **L99 view:** source of truth, dependencies, state, continuity, and release impact;
- **Decision:** chosen approach and intentional deferrals;
- **Risk II:** how the selected diff can fail;
- **Action:** exact files and behavior changed;
- **Proof:** tests, checks, logs, screenshots, or inspected configuration;
- **Rollback:** how to undo the change;
- **Next gate:** action requiring founder approval.

## Evidence rules

- A commit proves code was recorded, not that it was deployed.
- A green check proves only what that check actually tests.
- A merged pull request does not prove a migration ran or a dashboard changed.
- A generated configuration file must be compared with the actual service name and deployment target.
- A stale branch or old summary must not override current repository state.
- A public repository must be treated as public, regardless of labels such as “internal use only.”

## Conflict and concurrency rules

When recent work appears unexpectedly:

1. stop before overwriting it;
2. inspect the commit, author, branch, and affected files;
3. determine whether the work already satisfies the request;
4. update or extend it on a new branch rather than duplicating it;
5. disclose any unresolved conflict in the pull request.

## Security rules

- Never commit tokens, passwords, private keys, webhook secrets, service-role keys, or production credentials.
- Do not place proprietary prompt libraries or private user data into a public client bundle.
- Review generated deployment configuration before merging.
- Treat workflow permissions, third-party actions, and repository apps as security boundaries.
- Pin or otherwise review third-party automation used in privileged workflows.

## Required report

After GitHub work, report:

- repository and branch;
- exact files changed;
- commit or pull request created;
- checks run and their real coverage;
- failures, warnings, and skipped checks;
- security, privacy, deployment, and cost impact;
- rollback path;
- unresolved risks;
- whether founder approval is still required.

Git history is memory with consequences. Keep it truthful, reviewable, and recoverable.