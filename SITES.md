---
schema: juss/chatgpt-sites-repository-binding@v1
project_id: chief-ai-machine
canonical_repository: jussray/chief-ai-machine
canonical_branch: main
authority_repository: jussray/founder-control-room
site_identity_status: unverified
site_origin: null
---

# ChatGPT Sites repository binding — Chief AI Machine

This file defines the repository-side contract for a ChatGPT `@Sites` surface representing Chief AI Machine. It does not create a Site, prove a Site is connected, or prove publication.

## Canonical source

The Site must treat `jussray/chief-ai-machine` as the only canonical Chief AI repository and resolve the current `main` head at use time. Current repository/provider/runtime evidence outranks Site snapshots, old PRs, generated summaries, and chat memory.

Before material planning, editing, publication, deployment, cross-repository coordination, or a current-state claim, read and apply the current versions of:

- `AGENTS.md`
- `AGENTS_FOUNDER_INTELLIGENCE.md`
- `CHATGPT.md`
- `CLAUDE.md`
- `docs/FOUNDER_INTELLIGENCE_CONSTITUTION.md`
- `docs/PUBLIC_COMMUNICATION_TRUTH_CONTRACT.md`
- `config/founder-chief-pair.contract.json`
- `.control-room/repository.manifest.json`

Stricter repository-local rules always win.

## Read contract

A Site may render public-safe Chief AI state only from the canonical repository and current evidence. It must distinguish recommendation from authority, source from runtime, execution from outcome, and current from historical/stale/superseded/unknown evidence.

Never expose raw prompts, saved drafts, clipboard content, provider responses, API keys, private user identity, raw private logs, proprietary routing mechanics, or other Sauce Guard material in a public Site.

## Write contract

A Site may prepare Chief AI changes only through a focused branch and pull request created from freshly resolved `main`.

It must not push ordinary implementation directly to `main`, force-push, delete founder material, bypass required checks, or let model output grant itself execution authority. Every write must preserve exact repository/base/head identity, changed paths, verification state, rollback, and next gate.

A repository write or merge never silently authorizes deployment, publication, credentials, DNS, billing, provider mutation, or external communication.

## Publication contract

Chief AI is the cognition, synthesis, capability-composition, recommendation, and public-story proposal layer. Founder Control Room remains the governed execution and publication authority for portfolio actions.

The ChatGPT Site identity for Chief AI is currently `UNVERIFIED` in repository evidence. No slug, hostname, project ID, or generated URL may be guessed. Until the Sites runtime verifies the exact identity, live Site publication must remain blocked.

After identity verification, publication must bind to the intended exact repository state, re-read this authority chain, apply Sauce Guard, preserve the Founder Control Room/Chief pair boundary, and capture an observable Site artifact. A draft, save, commit, PR, merge, workflow trigger, or deployment on another provider is not ChatGPT Sites publication proof.

## Pair-drift rule

A material Site contract or founder-facing behavior change in Chief AI must be reviewed against Founder Control Room. If the two sides no longer agree on roles, authority, evidence, or publication semantics, report `pair drift` and make synchronization the next gate rather than silently continuing.

## Stop conditions

Stop on unverified Site identity, stale head, unreadable authority files, pair drift, private/proprietary-content risk, or a separately gated deployment/publication/provider action without current authority.
