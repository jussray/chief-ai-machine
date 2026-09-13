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

The portable surface never authorizes merge, deploy, production rollback, migration, destructive writes, credential changes, billing or pricing changes, publication, external communication, or exposure of proprietary/private prompt content. `AGENTS.md`, `CLAUDE.md`, repository skills, exact-head checks, Playwright requirements, Founder Control Room release truth, and explicit founder gates remain authoritative and may be stricter.

## Necessary-fix execution default

Before returning a repair or implementation step as founder homework, read [`.control-room/necessary-fix-policy.json`](.control-room/necessary-fix-policy.json) and apply `policyId: necessary-fix-execution-default`.

- `execute-now` when the fix is necessary, reversible, inside the current approved scope, and current authority plus applicable evidence/exact-head requirements are satisfied.
- `proof-gated` when the action is reversible but Chief AI or Founder Control Room requires proof before integration. Collect the proof and continue through the existing gate instead of asking the founder to perform automatable verification.
- `founder-required` when the fix widens scope, publishes externally, communicates externally outside a separately approved communication class, spends money, is destructive or irreversible, expands authority, or crosses a stricter Chief AI rule.
- Compliant posts inside an approved automated publishing class explicitly authorized by `docs/PUBLIC_COMMUNICATION_TRUTH_CONTRACT.md` and `config/founder-chief-pair.contract.json` keep that standing authorization; this necessary-fix default must not convert them back into fresh founder homework.
- Incoming evidence may update or invalidate bidirectional continuity fingerprints/cookies; outgoing approved actions must update the corresponding markers and receipts. Those markers are non-secret continuity state and never authority.
- Provider acceptance is execution evidence, not outcome proof. Verify the outcome, update continuity, and identify the next gate before claiming completion.

## Exact-candidate merge approval canon

Merge capability may exist, but no merge is authorized by capability, review, implementation, green checks, mergeability, continuity markers, `approved`, `cont`, or previous-candidate approval alone.

Before every merge, require fresh explicit founder approval bound to the exact repository, PR number, current base SHA, and current head SHA. If that approval is absent, ambiguous, or stale, ask the founder and stop. Any base/head movement expires the approval and requires a new ask.

`merge_authority: true` means the merge capability is available. It never means `merge_approved: true`, and it must never be treated as an execution token.

This default never grants merge, deployment, migration, publication, external communication, destructive-write, credential, billing, or authority-expansion permission. Existing exact-head checks, Playwright requirements, Founder Control Room release truth, standing communication authorizations, and repository rules remain stronger.

This entrypoint supplements repository-local agent instructions and never weakens privacy, safety, approval, rollback, evidence, provenance, or non-deletion rules.
