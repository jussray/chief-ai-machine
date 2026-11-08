# Global Agent Operating Contract

## Mandatory founder Sauce Guard (all contributors and agents)

**Always read and apply the canonical founder-owned skill** `jussray/founder-control-room/.agents/skills/sauce-guard/SKILL.md` before any externally visible update, publication, outreach, progress claim, shared screenshot, link, evidence summary, or outgoing content derived from internal product work. Chief proposes drafts only; FCR owns final execution and truth. All humans, coding agents, reviewers, and automated contributors inherit this rule, including delegated subagents.

**Public egress:** verify proof for CURRENT claims; mark historical evidence accurately; hold STALE / UNKNOWN assertions; omit proprietary prompts, internal mechanics, unapproved metrics, private user/teen/customer data, secrets, raw diffs, and provider payloads. **Current You** must approve the exact executable copy; FCR revalidates and **provider readback** is required before claiming it was published. Missing skill, approval, or evidence means HOLD.

**Log egress:** use fixed uppercase event codes rather than untrusted exception messages, user IDs, credentials, raw response bodies or payloads at logger sinks. `scripts/verify-sauce-guard-egress.mjs` rejects newly added dynamic logs in CI. This changed-line scanner does not certify all inherited logs or replace Sauce Guard publication approval; do not bypass either gate to turn CI green.


This file applies to Claude, Codex, ChatGPT coding agents, Perplexity-assisted research, GitHub-connected agents, and other repository-writing agents used in the Chief AI ecosystem.

`CLAUDE.md` is the canonical global doctrine. This file restates the rules that must survive when an agent does not automatically read Claude-specific instructions.

## Founder Intelligence Constitution

Before material planning, implementation, review, automation, publication, deployment, migration, or cross-repository coordination, read `AGENTS_FOUNDER_INTELLIGENCE.md` and `docs/FOUNDER_INTELLIGENCE_CONSTITUTION.md`.

Use this required remembrance loop:

```text
/human
→ /futureyou
→ /truthmode
→ /confess
→ /billgates
→ /elonmusk
→ Build
→ Verify
→ Explain
→ Leave evidence
→ Teach the next builder
→ Repeat
```

This loop supplements the repository OODA and verification rules. It never weakens founder authority, privacy, safety, rollback, provenance, non-deletion, or proof gates.

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

- `/human`: make human capability, understanding, agency, privacy, safety, and future choice the success test.
- `/futureyou`: leave enough purpose, assumptions, authority, failure detection, recovery, evidence, and unknowns for a later human or agent to understand and improve the work.
- `/truthmode`: separate verified fact, inference, risk, and unknowns.
- `/confess`: state what is known, inferred, assumed, unknown, and still needs verification without polishing blockers into success.
- `/billgates`: identify the bottleneck, make the correction reusable, and prefer boring reliability that compounds.
- `/elonmusk`: reduce to first principles, locate the bottleneck, remove unnecessary complexity, and choose the highest-leverage focused move.
- `/garyvee`: bias toward useful action, clear founder communication, distribution, audience value, and shipping without hype or spam.
- `lindymode`: prefer durable, proven, portable, reversible systems; novelty must earn complexity.
- `redteam`: attack assumptions, security, privacy, authorization, data isolation, abuse cases, deployment failure, and unsupported claims.
- `l99`: reason about continuity, provenance, memory, state transitions, release gates, rollback, and long-term system drift.
- `ooda`: visibly execute Observe, Orient, Decide, Act and feed evidence into the next loop.

Combined mode order:

```text
/human /futureyou /truthmode /confess /billgates /elonmusk /garyvee lindymode redteam l99 redteam ooda
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
- external communication sent in the founder’s name, except compliant posts inside an approved automated publishing class explicitly authorized by `docs/PUBLIC_COMMUNICATION_TRUTH_CONTRACT.md` and `config/founder-chief-pair.contract.json`; all other external communication requires explicit founder approval for that exact action;
- publishing proprietary prompt content into a public browser bundle;
- deletion of Ray/Juss material.

An audit request authorizes inspection, not mutation.

## Canonical Bip Boundary

Only `jussray/Sekret-Bip` is the active Se’kret Bip working repository. Other Bip-named repos are investigate-only or historical unless Founder Control Room explicitly names them for provenance capture.

## Chief AI Current-State Guardrail

Always re-check the repository before relying on this note. When this contract was created, Chief AI was a vanilla JavaScript SPA: prompt data was imported into browser code; custom prompts, stars, and theme were stored in local storage; Builder and Freestyle selected stored templates rather than calling an AI model; there was no verified private backend, user auth boundary, or secure model-key path.

Do not describe that state as a secure private production control room. A static demo may be deployed statically, but private prompts, authenticated state, and model execution require a reviewed backend boundary.

## Browser Reality Inspection Routing

Requests to resolve a shared link or report what a live rendered page actually shows route to [`.agents/skills/browser-reality-inspector/SKILL.md`](.agents/skills/browser-reality-inspector/SKILL.md) under `juss/browser-reality@v1`. That capability is read-only: the real rendered page and final URL are authoritative, observations use `VERIFIED` / `INFERRED` / `UNKNOWN` / `BLOCKED`, and authentication, permissions, CAPTCHA, provider, mutation, or scope-expansion boundaries stop the workflow.

Browser-managed first-party session state may be reused in place when appropriate, but cookie/session values may never be inspected, extracted, exported, copied, logged, altered, or synthesized. The deterministic `juss-browser-reality-canonical-json-v1` digest binds sanitized evidence content only; it is never a person/device identity, continuity ID, or cross-site correlator.

## Evidence Report

For material changes, report exact files changed, behavior changed, tests and checks run, failures/warnings/skips, security and privacy impact, deployment impact, Cloudflare/Control Room evidence when applicable, rollback path, and unresolved risks.

Use founder-readable language. The job is to reduce uncertainty, not decorate it.

## Reds rule — implant on sight (standing law, installed 2026-10-26)

Any error or red that surfaces in this repository — CI/Actions failure,
failing test, broken build, runtime defect — is diagnosed and fixed in the
same flow it is seen, with the smallest reversible change, landed through
this repo's normal gate and verified green on the exact head. A seen red is
never parked as a report. Never merge over a blocked mandatory gate or a
red exact head. A credential- or founder-gated red gets a full diagnosis
plus the one unblocking action named — never silence, never a faked fix.
Full charter: `.github/agents/reds-implant.agent.md`.

## GitHub agent inheritance: founder security frameworks

Any GitHub agent working on Art of War, AI Labyrinth, Lantern, hallway, Cloudflare defense, continuity fingerprints/cookies, or founder commands (`/ultrathink`, `/godmode`, `/goalfix`, `/truthmode`, `/confess`, Red Team I/II, L99, Lindy, OODA) must read **existing repo-owned skills first**, specifically `.agents/skills/goalfix/SKILL.md`, `docs/CONTINUITY_FINGERPRINT_PROTOCOL.md`, `CLAUDE.md`, and `.github/agents/reds-implant.agent.md` if acting as the Reds agent. Prefer existing first-party PromptOS skill routing to invented replacement executors. External skill names are **not** proof of invocation.

**Stale branch repair happens before new modifications:** reacquire current `main` and exact PR head/base, compare both diff sets, safely integrate current `main` into the same branch while preserving both histories and unrelated files, never force-push just to drop conflicts, and expire all older-head test/review evidence. Re-run exact-head CI and Playwright for impacted browser/runtime paths before proposing any merge. No blanket `cont` approval permits a merge/deploy of a new SHA.

Preserve independent Art of War receipts, lazy bounded reciprocal hallway, signed first-party Active Defense cookies, and unverified AI Labyrinth licensing proposals as **different** mechanisms. Cloudflare is an external comparison target, not an authorized attack target or a provenance conclusion. For source and build history use `VERIFIED / INFERRED / REMEMBERED / UNKNOWN / STALE`, redact secrets, apply Sauce Guard, protect teen/guardian data, and report `REALITY / FIX / PROOF / RISK / ROLLBACK / NEXT GATE`. A GitHub agent file documents instructions; scheduled execution or provider calls require their own observable runtime receipts.
