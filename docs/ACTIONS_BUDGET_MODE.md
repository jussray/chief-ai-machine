# Actions Budget Mode

This repository should preserve GitHub Actions checks without spending hosted-runner minutes or model-provider budget on routine review fan-out. Repository visibility is provider-managed state and must be re-read from GitHub rather than inferred from this document.

## Policy

- Any future GitHub Actions workflows should default to `workflow_dispatch`.
- Local verification should run before spending a hosted runner.
- Manual Actions runs are reserved for release candidates, exact-SHA proof, runner-health checks, or founder-requested verification.
- Paid semantic peer-review fan-out is paused by founder cost-control policy.
- Claude, Codex/OpenAI, Gemini, Perplexity, DeepSeek, and other model providers may still be used for focused `research`, `propose`, or `implement` work when the task explicitly needs that provider and the repository/runtime already has the corresponding secure provider-held key or authorized connector.
- Do not invoke multiple paid models merely to review one another while this mode is active.
- Prefer deterministic repository checks, focused tests, lint/typecheck, Playwright, provider readback, exact-head evidence, and founder review over billable semantic-review duplication.
- Never read, print, copy, move, rotate, recreate, or expose provider secrets in order to satisfy this policy. Call only secure configured key references through the repository's approved server-side/runtime path.

## Review evidence

A passing deterministic or manually dispatched workflow is evidence for review when it proves the relevant claim. Founder review records the final status for the exact branch and SHA.

A model-provider response is evidence only for the bounded task it actually performed. It never creates merge, deploy, publish, spend, secret, or founder authority.

## Runner-startup classification

If a GitHub Actions job has zero steps or no logs, classify it as `runner_startup_failure`, not an application-code failure.

## Resume condition

Paid semantic peer review remains paused until the founder explicitly re-enables it. Re-enabling review does not weaken exact-head proof, deterministic checks, Playwright, security, privacy, or founder authority gates.
