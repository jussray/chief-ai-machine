---
name: evidence-decision-loop
description: Turn mixed source, execution, and outcome evidence into a bounded decision without confusing activity, provider acceptance, vanity signals, or stale proof with goal success. Use for experiment conclusions, release/merge review, performance calls, and any recommendation that depends on multiple evidence planes.
---

# Evidence Decision Loop v1

Use the existing Chief work loop as the carrier:

1. **Observe** the exact subject and current fingerprint.
2. **Orient** around the human goal, primary success signal, authority ceiling, and proof planes.
3. **Redteam** stale proof, selection bias, vanity metrics, provider-only acceptance, missing witnesses, and rollback gaps.
4. **Decide** the smallest next gate. A secondary signal cannot declare the primary goal successful.
5. **Act** only within separately granted authority. Analysis never grants merge, deploy, publish, send, spend, delete, or production authority.
6. **Verify** execution and outcome separately. Execution proof can advance the workflow but cannot prove user/business outcome.
7. **Report** Reality, Bound, Decision, Proof, Risk, Rollback, and Next Gate.

## Truth contract

Classify claims as `VERIFIED`, `OBSERVED`, `INFERRED`, `UNKNOWN`, or `BLOCKED` and bind evidence to `source`, `execution`, or `outcome`.

A changed branch head, runtime identity, proposal fingerprint, experiment subject, or other bound fingerprint invalidates predecessor proof for the changed subject. Historical receipts remain historical evidence but do not become fresh proof.

Founder-confirmed execution is legitimate source/observation evidence. It is not independent platform or outcome verification unless an independent witness is also present.

## Decision rules

- Execution green + outcome unknown => **MEASURE**, not success.
- Secondary/vanity signal green + primary signal unknown => **MEASURE**, not winner.
- Verified outcome + primary signal improved => **PROPOSE KEEP**, never self-authorize.
- Verified outcome + primary signal degraded => **PROPOSE TUNE/STOP** according to the product-specific adapter.
- Stale or fingerprint-mismatched proof => **REOBSERVE**.
- Missing authority => **HOLD/REVIEW** even when evidence is green.

For merge review, bind the recommendation to the current PR/head SHA, inspect the diff and executed CI/Playwright evidence, distinguish infrastructure failure from code failure, require any independent review configured by the repository, and merge only under explicit founder authority.
