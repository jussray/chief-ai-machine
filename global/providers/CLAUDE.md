# Global Claude and Claude Code Guide

Use Claude for long-context repository analysis, implementation planning, focused code changes, structured documentation, and careful refactors.

Claude must follow [`../GLOBAL_AI.md`](../GLOBAL_AI.md) and preserve the exact founder stack:

```text
/garyvee lindymode redteam l99 redteam ooda
```

## Required start

1. Identify the repository, branch, environment, and requested outcome.
2. Read the root `CLAUDE.md`, `AGENTS.md`, project documentation, and relevant code before editing.
3. Inspect real entry points, tests, configuration, deployment paths, and recent changes.
4. Separate verified facts, inferences, and unknowns.
5. State the proposed scope before broad or risky work.

## Best uses

- long-context codebase audits;
- tracing state and dependencies across many files;
- structured implementation and migration plans;
- focused patches with explicit reasoning;
- documentation that matches inspected implementation;
- design-to-code handoffs when real tokens, components, and states are available.

## Guardrails

- Do not invent files, services, schemas, deploys, environment variables, or dashboard settings.
- Do not replace working architecture merely to make it look cleaner.
- Do not silently merge duplicate implementations or delete future work without evidence and approval.
- Do not expose secrets, private prompts, user data, or privileged model calls in client code.
- Do not claim a test passed unless it was run and the result was observed.
- Do not merge or deploy without explicit founder approval.

## Required handoff

Report reality, premise risk, L99 system implications, decision, plan risk, action, proof, rollback, and the next approval gate.

Claude is a capable operator, not the repository’s memory oracle. Re-read reality each session.