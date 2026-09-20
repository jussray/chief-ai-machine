# Founder Intelligence Agent Entry Point

Every AI agent working in this repository must read and apply [`docs/FOUNDER_INTELLIGENCE_CONSTITUTION.md`](docs/FOUNDER_INTELLIGENCE_CONSTITUTION.md) before material planning, implementation, review, automation, publication, deployment, migration, or cross-repository coordination.

Required loop:

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

Portable Juss OS command surface:

```text
/goalfix
/ultrathink
/truthmode
/confess
/redteam
/lindymode
/ooda
/visualize
```

These are reasoning, planning, and routing modes only. They never expand execution authority or weaken repository-local proof gates. In this repository, `/goalfix` routes to the repo-scoped `.agents/skills/goalfix/SKILL.md` contract rather than redefining it. `/visualize` may make structure, flow, evidence, or trade-offs easier to inspect, but it does not authorize browser, design, deployment, publishing, or production changes by itself.

## Codex native command adapter

When the current Codex host exposes native slash commands, use the live runtime palette and current official Codex behavior as the availability source. Do not assume that a command shown in an infographic, an older session, memory, or another Codex surface exists in the current host.

For repository work, use this command-assisted lane when those commands are actually available:

```text
/status
→ /permissions
→ /goal        (if available)
→ /plan        (if available and the change is nontrivial)
→ /skills      (if available and skills may help)
→ /mcp         (if available and external tools may help)
→ inspect / implement the smallest valid change
→ focused tests / Playwright when applicable
→ /review
→ persist exact-head evidence + rollback + unresolved unknowns
→ /compact     (only after durable receipts exist)
```

Native commands assist the governed workflow; they do not replace it:

- `/status` is session configuration evidence, not repository/runtime/product truth.
- `/permissions` confirms the active sandbox and writable roots. It may narrow what Codex can do but can never widen repository, Founder Control Room, founder, provider, merge, deployment, or publication authority.
- `/goal` and `/plan`, when present, must preserve the repository goal, stop condition, proof requirement, rollback, and authority ceiling. A native goal is not a substitute for checked-in instructions.
- `/skills` and `/mcp`, when present, reveal available capability only. A configured skill, server, or tool is not permission to use it for a consequential action.
- `/model` may change model/reasoning characteristics but never changes authority, evidence requirements, or the definition of done.
- `/review` is independent review evidence only. It is never merge, deploy, publish, or production authority.
- `/fork` and `/side`, when present, create context branches. Carry the task identity, but reacquire repository/provider fingerprints before consequential action and never silently inherit stale proof.
- `/resume`, when present, requires reacquiring current repo, branch/head, provider, review, and runtime state before continuing prior work.
- `/compact` may compress conversational context only after durable decisions, exact fingerprints, evidence IDs, blockers, rollback, and unresolved unknowns are persisted outside the compressed context.
- `/fast`, when present, may change speed or usage behavior but cannot widen scope, reduce required verification, or bypass spend/cost controls.
- `/init` is a bootstrap tool for repositories that lack governed agent instructions. Never use it to overwrite an existing `AGENTS.md` without explicit review of the replacement.
- `/memories`, when present, may assist continuity but never becomes the source of mandatory repository policy; checked-in `AGENTS.md`, skills, tests, and current provider evidence win.
- `/usage`, `/rename`, `/new`, `/archive`, `/pets`, or other host utilities are informational/session controls unless a current runtime explicitly documents more. They never grant execution authority.

If a command is absent, treat it as unavailable on that host and continue using the repository contract directly. Do not simulate a missing native command just to match a checklist.

### Attack / upgrade pass for Codex use

Before calling the Codex lane complete, attack the workflow itself:

1. Could a host/version difference make a named command unavailable?
2. Could `/permissions` or MCP/tool availability be mistaken for business authority?
3. Could `/review` greenwash missing tests, Playwright, CI, exact-head proof, or production evidence?
4. Could `/compact`, `/resume`, `/fork`, or `/side` silently carry stale proof or lose a blocker?
5. Could `/fast` or a model switch change cost/behavior while leaving the evidence plan stale?
6. Could generated or remembered instructions outrank current checked-in policy?

When the attack finds a real gap, patch the smallest governing contract or verification that prevents recurrence. Do not create a second command system beside the portable Juss OS surface.

## Canonical founder challenge stack

For nontrivial reasoning, capability composition, implementation planning, review, or cross-project coordination selected by authenticated founder/operator intent, use:

```text
ULTRATHINK
→ Red Team 1 — premise
→ Lindy mode
→ L99
→ Red Team 2 — implementation
→ OODA
→ Proof
→ Rollback / Next Gate
```

- **ULTRATHINK:** reconcile founder intent, current evidence, constraints, capability choices, and competing paths before selecting a bounded plan.
- **Red Team 1:** challenge the premise, evidence, scope, and whether the requested capability or change should exist.
- **Lindy mode:** prefer the smallest durable, reversible existing reasoning/capability carrier and stable contract over novelty or duplicate machinery.
- **L99:** bind provenance, subject/state fingerprints, scoped authority, evidence requirements, continuity, rollback, and long-term drift to the selected plan.
- **Red Team 2:** attack the chosen implementation or capability plan for authority leakage, security/privacy failures, stale assumptions, regression risk, unsupported provider behavior, overclaims, and missing recovery.
- **OODA:** observe current evidence, orient to Chief AI's planning/capability boundary, decide one bounded recommendation or plan change, act only where existing authority permits, and re-observe before continuing.
- **Proof / Rollback / Next Gate:** preserve the difference between a plan, provider execution, FCR authorization, runtime evidence, and founder outcome.

A failed pass narrows, changes, or stops the plan. Chief AI composes reasoning and capability; it does not acquire merge, deploy, publication, spending, provider mutation, credential, migration, destructive-write, or founder authority by invoking any mode.

## /ultrathink authority-aware repair

`/ultrathink` is a consequence-aware decision amplifier, not a second operating system and not an authority grant. For repository repair it composes the canonical founder challenge stack above, then routes execution through the existing `/goalfix` contract instead of creating a parallel repair framework.

Use this repair loop inside the canonical stack:

```text
FOUNDER INTENT
→ CURRENT AUTHORITATIVE STATE
→ CONSEQUENCE + AUTHORITY
→ PREMISE ATTACK
→ BOTTLENECK
→ SMALLEST REVERSIBLE MOVE
→ REAL-PATH PROOF
→ IMPLEMENTATION ATTACK
→ EVIDENCE UPDATE
→ NEXT GATE
```

Required behaviors:

- Reacquire the authoritative repository, target/base, and exact candidate SHA before making or trusting material claims.
- Keep source, build, CI, provider, runtime, browser, and outcome evidence as separate proof planes. Success or failure in one plane must not silently become a claim about another.
- When a check fails before the changed behavior executes, classify the boundary before editing source. A provider or authority failure is not automatically a code defect.
- Do not rerun an unchanged blocked gate merely to create another identical receipt. Rerun when the candidate, dependency, provider state, credential/policy relationship, or other material condition changed.
- Audit whether the current carrier actually owns the authority required for the next mutation. Authentication through a provider is not authority to edit that provider. Missing authority is `BLOCKED`, not permission to invent a workaround.
- Never weaken authentication, authorization, tests, Playwright, release gates, evidence requirements, or exact-head binding to manufacture green.
- If a newly discovered root cause is unrelated to an active focused PR, keep that PR focused and move the new repair to a separate focused branch or decision instead of silently expanding scope.
- Before creating a new governance or repair carrier, inspect active PRs/issues for an existing authoritative carrier and extend it when scope matches. Duplicate carriers are a governance defect, not extra safety.
- When exact head, base, provider state, or proof changes, update the durable evidence carrier so stale receipts cannot masquerade as current truth.
- Bind final proof to the final candidate SHA. If the head or relevant base moves, reacquire and re-prove the affected gates.
- Preserve Founder Control Room as the single founder operating system and execution/evidence/governance authority. Chief AI reasoning, skills, modes, and future add-ons remain coordinated subsystems serving one founder-intent loop rather than parallel operating systems.

`/ultrathink` never expands execution authority or weakens repository-local proof gates. In repository repair, `/ultrathink` composes `/goalfix`; it does not replace it.

The portable surface never authorizes merge, deploy, production rollback, migration, destructive writes, credential changes, billing or pricing changes, publication, external communication, or exposure of proprietary/private prompt content. `AGENTS.md`, `CLAUDE.md`, repository skills, exact-head checks, Playwright requirements, Founder Control Room release truth, and explicit founder gates remain authoritative and may be stricter.

This entrypoint supplements repository-local agent instructions and never weakens privacy, safety, approval, rollback, evidence, provenance, or non-deletion rules.
