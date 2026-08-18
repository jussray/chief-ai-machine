# ChatGPT Operating Contract — chief-ai-machine

This file governs ChatGPT, API-assisted sessions, Codex tasks, and connector-backed work in `jussray/chief-ai-machine`.

Before nontrivial work, also read:

- [`AGENTS.md`](AGENTS.md)
- [`CLAUDE.md`](CLAUDE.md)
- [`AGENTS_FOUNDER_INTELLIGENCE.md`](AGENTS_FOUNDER_INTELLIGENCE.md)
- [`docs/FOUNDER_INTELLIGENCE_CONSTITUTION.md`](docs/FOUNDER_INTELLIGENCE_CONSTITUTION.md)
- [`docs/PUBLIC_COMMUNICATION_TRUTH_CONTRACT.md`](docs/PUBLIC_COMMUNICATION_TRUTH_CONTRACT.md)
- [`config/founder-chief-pair.contract.json`](config/founder-chief-pair.contract.json)

Repository/provider/runtime evidence inspected now outranks stale prose, old PR descriptions, old SHAs, old issue summaries, and chat memory. A document may preserve historical truth without remaining current authority.

## Repository identity and authority

**Repository:** `jussray/chief-ai-machine`

**Role:** Chief AI is the founder cognition, synthesis, capability-composition, recommendation, and public-story proposal layer in the Founder Control Room / Chief AI pair.

**Execution boundary:** Chief AI may recommend or prepare actions. Founder Control Room remains the governance/execution authority for governed portfolio mutations and publication. Chief AI must never turn a recommendation, model output, analytics result, or remembered preference into execution authority.

**Runtime truth:** Resolve current runtime, deployment, provider, storage, and security state at use time. Do not freeze a durable “current architecture,” deployment SHA, provider state, or release claim into this file. Historical implementation notes in `AGENTS.md` or `CLAUDE.md` are context, not proof that the same state still exists.

## Canonical workflow

Use these reasoning lenses with serialized authority:

```text
Goal
-> Reality
-> ULTRATHINK
-> Product Design + Data Analytics
-> Redteam I
-> Lindy
-> L99
-> OODA
-> Hormozi
-> Bill Gates
-> Elon Musk
-> Implement
-> Proof
-> Redteam II
-> Documentation / temporal truth review
-> Review
-> Merge gate
-> post-merge re-observation
-> next bottleneck
```

Reasoning may run in parallel. Repository writes, merges, deployments, provider mutations, credentials, publication, spending, destructive changes, and external communication remain serialized behind their applicable authority and evidence gates.

- **Redteam I** attacks the premise, authority, evidence, and necessity.
- **Lindy** prefers portable, explicit, reversible mechanisms that survive provider/tool churn.
- **L99** maps authority, state, provenance, evidence lifetime, privacy, rollback, and the next gate.
- **OODA** re-observes after meaningful edits, proof, merges, provider changes, and truth transitions.
- **Hormozi** tests whether the change increases useful founder/customer value without inventing demand or metrics.
- **Bill Gates** finds the bottleneck and turns the correction into a reusable control.
- **Elon Musk** questions requirements, removes unnecessary complexity, simplifies what remains, shortens the proof loop, and automates only stable paths.
- **Redteam II** attacks the selected implementation for false greens, stale truth, correlated evidence, privilege expansion, leakage, duplicate execution, and rollback gaps.

## 5W1H — required before material action

- **Who** owns the decision, execution authority, affected users, and data.
- **What** exact outcome must change, plus non-goals and work/history to preserve.
- **Where** exact repository, branch, environment, runtime, provider, and data boundary.
- **When** lifecycle state, ordering, truth age, use boundary, and rollback window.
- **Why** verified founder/product need and supporting evidence.
- **How** smallest reversible implementation, permissions, proof, rollback, and stop condition.

## Truth Decay / Truth Lease / FutureYou safety

A fact can be true when observed and unsafe when reused later. Identity hashes prove what was checked; they do not prove reality underneath the claim stayed unchanged.

At consequential merge, deploy, schedule, publish, provider, completion-claim, analytics, and launch boundaries:

1. identify the exact claim and its load-bearing dependencies;
2. re-observe the authoritative repository/provider/runtime/analytics source;
3. classify the claim as `CURRENT`, `HISTORICAL`, `STALE`, `SUPERSEDED`, or `UNKNOWN`;
4. use present-tense operational language only for `CURRENT` claims;
5. preserve prior evidence as historical provenance without promoting it back into current authority;
6. treat missing, conflicting, malformed, or over-age evidence as `UNKNOWN`, never success;
7. never let Current You preference override contradictory objective evidence; and
8. never let FutureYou, model memory, old documentation, or an earlier green packet silently renew truth or authorize execution.

Use the repository's stronger domain-specific exact-head, runtime, publication, or provider gates when they are stricter than a generic Truth Lease.

## Founder-owned product progress publishing / Sauce Guard

Chief AI should help the founder talk publicly about verified progress on the founder's own products without exposing the private recipe.

Canonical separation:

```text
verified product evidence
-> Chief proposes a public-safe, channel-native story
-> Sauce Guard removes private machinery
-> every public claim receives proposal-bound temporal semantics
-> Current You approves the exact executable proposal
-> FCR revalidates truth at execution time
-> FCR direct adapter or bounded approved orchestration executes
-> provider readback proves external outcome
-> FCR records the outcome receipt
-> observation-only analytics inform the next proposal
```

Public-safe content may explain:

- what changed;
- the user/founder problem it solves;
- what was learned or corrected;
- why the change matters;
- approved public proof; and
- the honest next gate.

Keep behind the curtain:

- proprietary implementation mechanics and private prompts;
- raw diffs, internal notes, chain-of-thought, credentials, and provider payloads;
- private workflow artifacts or internal evidence references;
- private customer/user data, security-sensitive detail, and unreleased roadmap detail; and
- private analytics or metrics not separately approved and verified for public use.

Chief must preserve the canonical public-claim temporal classes used by the Founder–Chief publishing contract: `historical_version`, `current_repo_state`, `current_runtime`, and `metric`. Chief proposes/classifies; it does not self-certify runtime or metric truth.

## Product Design gate

For changed user-facing product surfaces:

1. define the user and intended outcome;
2. inspect existing product/visual truth before redesigning;
3. preserve loading, empty, partial, error, denied, blocked, stale, superseded, unknown, and success states where applicable;
4. make the next gate visible instead of collapsing all evidence into one green badge;
5. verify responsive, keyboard, focus, screen-reader naming, contrast, motion, and touch behavior; and
6. use targeted Playwright evidence tied to the exact candidate SHA before calling UI/runtime behavior done.

Design evidence proves the observed experience only. It does not prove provider configuration, authorization, database state, deployment identity, publication, or business outcomes.

## Data Analytics gate

Analytics is observation-only. Use it to distinguish:

- capability from configuration;
- configuration from execution;
- execution from provider outcome;
- current truth from historical/stale/superseded/unknown truth;
- content/distribution failure from conversion failure; and
- product value from vanity activity.

Prefer sanitized counts, rates, comparable windows, state transitions, elapsed time, and proof coverage. Analytics may rank or inform the next public-safe story proposal. It may not renew truth, approve publication, widen authority, or turn a stale metric into a current claim.

## Non-negotiable boundaries

- Inspect current source before relying on this document's product-state prose.
- Never invent files, tests, deploys, provider settings, publication outcomes, users, demand, revenue, or metrics.
- Never expose proprietary prompts, credentials, private data, raw provider payloads, raw diffs, or privileged model calls in public/client output.
- Keep Chief AI, Se’kret Bip, Founder Control Room, Think Tank, Juss Beautiful Hair, StoryEngine/L99, and other product boundaries explicit.
- Search for existing implementation before adding another system.
- Do not weaken tests, type checks, lint, authentication, safety, privacy, Playwright, truth gates, or release gates to make CI green.
- Provider/build success, exact runtime identity, user-path proof, publication outcome, and business outcome are separate evidence layers.
- Multiple agents interpreting the same underlying evidence are correlated interpretation, not independent proof.

## Branch, review, and merge discipline

- Re-read current `main` immediately before branching and again before merge.
- Use one focused branch/PR per logical repair; preserve unrelated work and history.
- Never push ordinary implementation directly to `main`.
- Pin exact candidate head evidence. If the head or load-bearing base/provider state moves, earlier proof becomes historical until reacquired.
- Playwright is required for changed user-facing UI/runtime paths; do not perform browser theater for a docs-only contract change.
- Review changed files in context and resolve material findings on the final exact head.
- A merge does not silently authorize deployment, credentials, DNS, database migration, auth/RLS changes, publication, spending, or destructive work.
- After merge, resolve the resulting exact `main`, re-observe affected provider/runtime/documentation truth, and mark superseded evidence so it cannot masquerade as current authority.

## Approval gates

Follow the stricter approval/standing-authorization rules in `AGENTS.md`, `CLAUDE.md`, `docs/PUBLIC_COMMUNICATION_TRUTH_CONTRACT.md`, and `config/founder-chief-pair.contract.json`.

In particular, do not independently authorize force-pushes, production deployment/rollback, auth/RLS changes, secret lifecycle actions, destructive storage changes, billing, domains/DNS, broad-permission connectors, or external communication outside an explicitly approved publishing class.

## Verification order

Use the cheapest valid proof first:

1. focused static/contract check;
2. focused unit/integration test;
3. typecheck/lint/build when relevant;
4. targeted Playwright for changed UI/runtime behavior;
5. exact-head CI/provider proof when the claim depends on it;
6. post-merge re-observation before current-state or launch claims.

## Output format

Return:

**REALITY · FIX · PROOF · RISK · ROLLBACK · NEXT GATE**

Include exact repo/branch/SHA, files touched, checks actually run, preserved work/history, truth age or superseded state, provider/runtime evidence when relevant, and blocked/unknown evidence.
