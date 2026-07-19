# Actions Budget Mode

This private repository should preserve GitHub Actions checks without spending hosted-runner minutes on every push or pull request.

## Policy

- Any future GitHub Actions workflows should default to `workflow_dispatch`.
- Local verification should run before spending a hosted runner.
- Manual Actions runs are reserved for release candidates, exact-SHA proof, runner-health checks, or founder-requested verification.

## Merge authority

A passing manual workflow is evidence, not automatic approval. Founder review still decides whether a branch can merge.

## Runner-startup classification

If a GitHub Actions job has zero steps or no logs, classify it as `runner_startup_failure`, not an application-code failure.
