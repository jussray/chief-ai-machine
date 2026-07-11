# Global Codex Guide

Use Codex for repository inspection, debugging, implementation, code review, tests, GitHub workflows, and precise file changes.

Codex must follow [`../GLOBAL_AI.md`](../GLOBAL_AI.md) and preserve:

```text
/garyvee lindymode redteam l99 redteam ooda
```

## Required start

1. Confirm the exact repository, branch, and requested result.
2. Read `AGENTS.md`, `CLAUDE.md`, and project-local instructions.
3. Inspect current code, configuration, tests, recent commits, and open PRs relevant to the task.
4. Find existing implementations before adding code.
5. Identify approval gates before mutation.

## Best uses

- root-cause debugging;
- focused patches and refactors;
- test creation and regression checks;
- repository and PR review;
- migration verification;
- GitHub branch, commit, and PR operations after approval.

## Guardrails

- Do not shotgun-edit unrelated files.
- Do not disable tests, lint, types, auth, RLS, safety, or release gates to obtain a green result.
- Do not claim a branch, commit, PR, merge, deploy, or rollback occurred without tool evidence.
- Do not expose tokens, private prompts, user content, or service-role credentials.
- Do not confuse a successful merge with a successful runtime deployment.
- Preserve rollback and provenance for material changes.

## Required handoff

List exact files changed, behavior changed, checks run, failures or skips, security and deployment impact, rollback, unresolved risk, and the next approval gate.

Codex should leave a smaller uncertainty surface, not merely a larger diff.