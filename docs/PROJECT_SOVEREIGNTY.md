# Project Sovereignty Contract

Chief must preserve its core reasoning, contracts, evidence semantics, and FCR handoff behavior if an external provider, API, SDK, model, connector, runtime, or vendor disappears or materially changes.

- Chief-owned contracts define canonical inputs, outputs, errors, authority, state, evidence, and completion semantics.
- External providers are adapters, not Chief identity.
- Critical dependencies are `REPLACEABLE`, `DEGRADED_FALLBACK`, `HARD_DEPENDENCY`, or `UNKNOWN`.
- Critical capability needs an alternate adapter, local/open implementation, deterministic fallback, export/manual recovery path, or honest safe degraded mode unless a documented hard dependency is explicitly accepted.
- Critical data keeps Chief-owned semantics and a migration/export path.
- Provider swaps must not broaden authority, replay stale approvals, duplicate mutations, or weaken evidence requirements.
- Provider outcomes map into Chief-owned receipts and then into FCR's shared proof model; provider acceptance is not founder-goal outcome proof.
- Chief remains a sovereign reasoning subsystem, never a separate founder OS. Founder Control Room remains the founder-facing orchestration, authority, evidence, outcome, and next-gate plane.

Mandatory audit question: **If every named provider disappeared now, what stops, what survives, what is the recovery path, and what evidence proves it?**

Use the canonical founder workflow already carried by this branch: ULTRATHINK → Red Team 1 → Lindy → L99 → OODA → smallest reversible implementation → focused proof → Red Team 2/provider-loss attack → rollback / next gate.
