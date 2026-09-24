# Founder AI Council Contract

Status: active control-room documentation for `jussray/chief-ai-machine`.

The Council is a multi-model reasoning and review layer. It does not replace current repository/provider/runtime evidence or the founder's exact authority gate.

## Resident Council invariant

The Council is resident in two places at once:

1. **Founder assistant host**: ChatGPT or a successor founder-facing host carries standing Council selection, challenge, reconciliation, continuity, and evidence discipline for founder work.
2. **This project Control Room**: this repository carries the project-local Council contract and machine-readable residency contract at `.control-room/council-residency.contract.json`.

These are two residences of the same logical Founder Council, not one centralized executor. Project agents must read the residency contract with this file before material Council work.

Default invocation is automatic when Council participation is materially useful. Route the smallest useful task-specific set of seats rather than waking every provider by default. Product-user workflows may invoke the Council behind the scenes only when project policy allows it; users receive the governed product outcome, not raw Council deliberation, founder controls, provider credentials, or cross-project private data.

A named Council seat counts as **live** only when an actual connector/API/runtime call is verified by provider evidence. Simulated role analysis must never be labeled as a live provider response.

All execution remains inside the owning Control Room's local authority membrane. Cross-project Council reasoning may coordinate evidence and recommendations, but cross-project mutation must be handed to the Control Room that owns the affected system.

## Members

- **Founder**: final human authority for separately gated actions.
- **Chief AI**: orchestration, decomposition, specialist synthesis, and goal-state framing; never self-authorizes execution.
- **Codex / ChatGPT**: debugging, code review, data analysis, implementation support, and repository operations.
- **Claude / Claude Code**: long-context analysis, architecture, careful refactors, implementation, and documentation.
- **Muse**: first-class governed Council challenger for cross-provider drift, independent review, and bounded implementation. Prefer Standard / non-contributor mode for proprietary portfolio context unless explicitly authorized otherwise.
- **Perplexity**: current public research and source discovery; public-web evidence does not substitute for private runtime truth.
- **Other eligible providers**: may participate only when local policy/registry says they are eligible.

## Rules

1. Evidence outranks model opinion.
2. Council consensus does not authorize mutation.
3. Preserve meaningful dissent.
4. Parallel reasoning is allowed; mutation is serialized through one bounded path.
5. Every Council round binds to repository/project, current branch/head when relevant, provider surfaces, truth age, authority ceiling, and stop condition.
6. No Council member inherits approval from another member.
7. Secrets, private user/customer data, raw private provider payloads, and protected sauce stay out of Council evidence packets.
8. A model may propose a merge, deploy, migration, DNS/provider change, publication, send, delete, or spend. It may not silently authorize one.

## Automatic founder lenses

Apply the canonical FCR lenses as provider-neutral reasoning tools: truth/confess, ULTRATHINK, Product Design, Data Analytics, Redteam I, Lindy, L99, OODA, value/outcome reasoning, first principles, Redteam II, and re-observation/loop.

## Council round packet

Each member distinguishes `VERIFIED`, `INFERRED`, `UNKNOWN`, and `BLOCKED`.

The synthesis returns:

- `REALITY`: verified state now
- `COUNCIL`: conclusions plus meaningful dissent
- `FIX`: smallest reversible selected action
- `PROOF`: evidence required or obtained
- `RISK`: unresolved failure modes
- `ROLLBACK`: safe reversal
- `NEXT GATE`: one exact founder decision/action

When GitHub, Supabase, and Cloudflare are involved, triangulate source -> data/auth boundary -> deployment/runtime -> user outcome. No layer certifies the next merely by being green.
