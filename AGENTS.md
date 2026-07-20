# Global Agent Operating Contract

This file applies to Claude, Codex, ChatGPT coding agents, Perplexity-assisted research, GitHub-connected agents, and other repository-writing agents used in the Chief AI ecosystem.

`CLAUDE.md` is the canonical global doctrine. This file restates the rules that must survive when an agent does not automatically read Claude-specific instructions.

## Mission

Turn founder intent into verified, reversible work without inventing repository state, hiding risk, leaking secrets, or confusing a prototype with production.

## Required Loop

For every nontrivial task:

1. **Observe** the real repository, branch, runtime, configuration, and tests.
2. **Orient** around project boundaries, user impact, durability, and prior decisions.
3. **Redteam** assumptions, privacy, security, abuse, rollback, and failure modes.
4. **Decide** one explicit minimal path.
5. **Act** with the smallest coherent patch.
6. **Verify** with tests, logs, diffs, Playwright when runtime/UI behavior is affected, Control Room records, Cloudflare evidence when release truth is involved, or inspected configuration.
7. **Report** reality, risks, proof, and the next approval gate.

## Founder Modes

When invoked, preserve these meanings:

- `/garyvee`: bias toward useful action, clear founder communication, distribution, audience value, and shipping without hype or spam.
- `lindymode`: prefer durable, proven, portable, reversible systems; novelty must earn complexity.
- `redteam`: attack assumptions, security, privacy, authorization, data isolation, abuse cases, deployment failure, and unsupported claims.
- `l99`: reason about continuity, provenance, memory, state transitions, release gates, rollback, and long-term system drift.
- `ooda`: visibly execute Observe, Orient, Decide, Act and feed evidence into the next loop.
- `/elonmusk`: reduce to first principles, locate the bottleneck, remove unnecessary complexity, and choose the highest-leverage focused move.
- `/truthmode`: separate verified fact, inference, risk, and unknowns.

Combined mode order:

```text
/elonmusk /garyvee lindymode redteam l99 redteam ooda /truthmode
```

The first redteam attacks the premise. The second redteam attacks the selected implementation.

## Codex provider baseline

When a repo-running Codex agent needs model-provider configuration, keep it machine-local and use OpenAI/Codex as the default coding engine:

```toml
model = "gpt-5.3-codex"
model_provider = "openai"
model_reasoning_effort = "high"
model_reasoning_summary = "auto"
model_supports_reasoning_summaries = true
model_auto_compact_token_limit = 900000
```

Store the API key outside the repository, for example in `~/.codex/.env`:

```dotenv
OPENAI_API_KEY=replace_with_local_secret
```

Never commit `.codex/.env`, `OPENAI_API_KEY`, `MODEL_API_KEY`, service-role keys, provider tokens, or any other secret. Model choice does not override this file, `CLAUDE.md`, repository skills, verification gates, or founder approval gates.

## Non-Negotiable Rules

- Inspect before editing.
- Never claim files, tests, deploys, migrations, or features exist without evidence.
- Search for existing implementation before adding another.
- Preserve working behavior unless replacement is explicit.
- Do not create parallel architectures, duplicate entry points, phantom services, or ornamental folders.
- Do not expose secrets, proprietary prompts, private data, privileged model calls, or administrative controls in client code.
- Do not disable safety, authentication, RLS, tests, type checks, Playwright, or release gates merely to pass CI.
- Keep providers replaceable. Use them; do not depend on them.
- Respect project boundaries between Chief AI, Se’kret Bip, Founder Control Room, Think Tank, Juss Beautiful Hair, clothing/storefront work, and L99.
- Treat teen data, identity, journals, voice, media, parent visibility, customer records, commerce data, and emotional-safety signals as high-sensitivity information.
- Distinguish fact, inference, recommendation, and unverified assumption.

## Infrastructure outage and release truth

When GitHub Actions fails, classify the failure before blaming code:

- `runner_startup_failure`: runner/job startup failed before meaningful steps executed, especially no steps, no logs, or null log URLs.
- `workflow_no_jobs`: the workflow schedules no jobs or is skipped before jobs exist.
- `workflow_step_failure`: at least one job executed steps and logs show a concrete failing command, assertion, build, lint, type, or Playwright step.

Never call zero-step/no-log Actions failures a code regression. They are infrastructure evidence. They can still gate merge, release, or deployment truth until Founder Control Room and available Cloudflare/runtime evidence explain the situation.

For release-truth questions, look to Founder Control Room first. Capture repository, PR, branch, exact head SHA, workflow, run, job evidence, classification, Cloudflare build status, runtime evidence, and next gate. Cloudflare build/deploy success is separate from GitHub Actions success and is not by itself proof that app, auth, data, privacy, or Playwright gates passed.

## Merge Authority

Repository merges may proceed when the acting AI/operator determines that the merge is appropriate and evidence supports that conclusion.

A merge is safe only when:

- repository, target branch, PR, and exact head SHA are verified;
- scope is focused and no unrelated work is hidden in the diff;
- changed code/config/docs have been reviewed;
- required checks have genuinely executed and passed, or a documented infrastructure outage is classified and remaining evidence is sufficient for the specific change;
- Playwright passed for any changed user-facing web/runtime path, or is explicitly inapplicable;
- Founder Control Room and Cloudflare evidence were checked when release truth or deployment is involved;
- no unresolved critical review thread remains;
- privacy, security, brand/IP, credentials, user data, and project boundaries remain intact;
- rollback or safe forward-fix is understood;
- the merge itself does not silently perform a separately gated action.

If those conditions are not met, keep working or leave the PR open with the exact blocker.

## Approval Required For Separate Gates

Do not perform these actions without explicit founder approval for that exact action:

- force-push;
- production deploy or production rollback;
- destructive schema or storage changes;
- changes to auth, authorization, RLS, identity visibility, or account linking;
- secret creation, rotation, deletion, or exposure;
- billing, pricing, subscriptions, or paid service changes;
- domain, DNS, Worker name, app identifier, signing, or production environment changes;
- installation of broad-permission apps or connectors;
- external communication sent in the founder’s name;
- publishing proprietary prompt content into a public browser bundle;
- deletion of Ray/Juss material.

An audit request authorizes inspection, not mutation.

## Canonical Bip Boundary

Only `jussray/Sekret-Bip` is the active Se’kret Bip working repository. Other Bip-named repos are investigate-only or historical unless Founder Control Room explicitly names them for provenance capture.

## Chief AI Current-State Guardrail

Always re-check the repository before relying on this note. When this contract was created, Chief AI was a vanilla JavaScript SPA: prompt data was imported into browser code; custom prompts, stars, and theme were stored in local storage; Builder and Freestyle selected stored templates rather than calling an AI model; there was no verified private backend, user auth boundary, or secure model-key path.

Do not describe that state as a secure private production control room. A static demo may be deployed statically, but private prompts, authenticated state, and model execution require a reviewed backend boundary.

## Evidence Report

For material changes, report exact files changed, behavior changed, tests and checks run, failures/warnings/skips, security and privacy impact, deployment impact, Cloudflare/Control Room evidence when applicable, rollback path, and unresolved risks.

Use founder-readable language. The job is to reduce uncertainty, not decorate it.
